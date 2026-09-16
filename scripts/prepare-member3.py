"""Read-only import of delivered predictions and compact same-batch replay context.

This small-data presentation adapter does not replace the Spark DWD/DWS pipeline.
Run from any directory: python scripts/prepare-member3.py (requires pyarrow).
"""
import hashlib
import json
import math
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pyarrow.parquet as pq

WEB = Path(__file__).resolve().parents[1]
WORK = WEB.parent
DELIVERY = WORK / '成员3交付成员4/member3_交付成员4_字段说明与预测_20260915/member4'
RAW = WORK / 'phase2-data-generator/output/beijing-development-seed-20260914'
BJ = timezone(timedelta(hours=8))
HOUR = timedelta(hours=1)
IDS = [f'BJS-S{i:04}' for i in range(1, 9)]

def dt(value):
    return datetime.fromisoformat(value).astimezone(BJ)

def spark_time(value):
    # Spark TIMESTAMP physical values are UTC instants, despite Arrow's tz=None.
    return value.to_pydatetime().replace(tzinfo=timezone.utc).astimezone(BJ)

def iso(value):
    return value.isoformat(timespec='seconds')

def read(name):
    rows = []
    for file in sorted((RAW / name).glob('*.jsonl')):
        rows.extend(json.loads(line) for line in file.read_text(encoding='utf8').splitlines() if line.strip())
    assert rows, f'Missing raw table: {name}'
    assert all(r.get('dataset_id') == RAW.name for r in rows), name
    return rows

stations = {r['station_id']: r for r in read('dim_station')}
piles = read('dim_pile')
capacity = {sid: sum(p['rated_power_kw'] for p in piles if p['station_id'] == sid) for sid in stations}
pile_counts = Counter(p['station_id'] for p in piles)
metrics = json.loads((DELIVERY / 'metrics_e1.json').read_text(encoding='utf8'))
cutoff = dt(metrics['training_data_cutoff'].replace(' ', 'T') + '+08:00')
forecasts, sources = {}, []
for folder in sorted(DELIVERY.glob('predictions_asof_*.parquet')):
    rows = pq.read_table(folder).to_pylist()
    origins = {spark_time(r['forecast_origin']) for r in rows}
    assert len(origins) == 1
    origin = origins.pop()
    assert origin >= cutoff
    assert origin.strftime('%Y%m%d%H%M%S') in folder.name, 'Parquet timezone mismatch'
    grouped = defaultdict(list)
    for r in rows:
        assert r['dataset_id'] == RAW.name
        sid = r['station_id']
        assert sid in stations
        start, end = spark_time(r['interval_start']), spark_time(r['interval_end'])
        assert start == origin + (r['h'] - 1) * HOUR and end == start + HOUR
        assert spark_time(r['free_piles_time']) == end
        load, free = r['predicted_load_kw'], r['predicted_free_piles']
        assert load is None or math.isfinite(load) and 0 <= load <= capacity[sid] + 1e-6
        assert free is None or isinstance(free, int) and 0 <= free <= pile_counts[sid]
        assert load is None or math.isclose(r['capacity_ratio'], load / capacity[sid], abs_tol=1e-8)
        grouped[sid].append({'h': r['h'], 'intervalStart': iso(start), 'intervalEnd': iso(end),
            'predictedLoadKw': load, 'predictedFreePiles': free, 'capacityRatio': r['capacity_ratio'],
            'weatherCode': None, 'temperatureC': None})
    assert set(grouped) == set(stations), 'Missing station forecasts'
    for points in grouped.values():
        points.sort(key=lambda p: p['h'])
        assert [p['h'] for p in points] == list(range(1, 25))
    assert {r['weather_status'] for r in rows} == {'without_weather'}
    forecasts[iso(origin)] = grouped
    for file in sorted(folder.glob('*.parquet')):
        sources.append({'file': str(file.relative_to(WORK)), 'sha256': hashlib.sha256(file.read_bytes()).hexdigest()})
assert len(forecasts) == 3

# Energy is additive across interval overlaps. Exact duplicate telemetry is counted once.
hour_energy = defaultdict(float)
seen, duplicates, telemetry_rows = set(), 0, {}
for r in read('fact_pile_telemetry'):
    key = (r['pile_id'], r['interval_start'], r['interval_end'])
    canonical = json.dumps(r, sort_keys=True)
    if key in seen:
        assert telemetry_rows[key] == canonical, 'Conflicting telemetry; requires DWD output'
        duplicates += 1
        continue
    seen.add(key)
    telemetry_rows[key] = canonical
    start, end = dt(r['interval_start']), dt(r['interval_end'])
    assert end > start and r['energy_delta_kwh'] >= 0
    hour = start.replace(minute=0, second=0, microsecond=0)
    while hour < end:
        overlap = (min(end, hour + HOUR) - max(start, hour)).total_seconds()
        hour_energy[(r['station_id'], hour)] += r['energy_delta_kwh'] * overlap / (end-start).total_seconds()
        hour += HOUR

state_rows = read('fact_pile_state_snapshot')
state_events = read('fact_pile_state_event')
orders = read('fact_order')
order_map = {r['order_id']: r for r in orders}
order_events = defaultdict(list)
for r in read('fact_order_event'):
    order_events[r['order_id']].append(r)
revenue = read('fact_revenue_event')
state_keys = {'idle':'idlePiles','using':'usingPiles','reserved':'reservedPiles','fault':'faultPiles','unknown':'unknownPiles'}

snapshots = {}
for as_of, prediction in forecasts.items():
    origin = dt(as_of)
    latest = {}
    for r in state_rows:
        when = dt(r['snapshot_time'])
        if when <= origin and (r['pile_id'] not in latest or when > latest[r['pile_id']][0]):
            latest[r['pile_id']] = (when, r['state'])
    for r in sorted(state_events, key=lambda r: (r['event_time'], r['state_event_id'])):
        when = dt(r['event_time'])
        if when <= origin and (r['pile_id'] not in latest or when >= latest[r['pile_id']][0]):
            latest[r['pile_id']] = (when, r['new_state'])
    view_stations, bundles = [], {}
    for sid in IDS:
        s = stations[sid]
        counts = Counter(latest.get(p['pile_id'], (None, 'unknown'))[1] for p in piles if p['station_id'] == sid)
        assert set(counts) <= set(state_keys)
        count_fields = {field: counts[state] for state, field in state_keys.items()}
        station = {'stationId':sid,'stationName':s['station_name'],'district':s['district'],'sceneType':s['scene_type'],
            'longitude':s['longitude'],'latitude':s['latitude'],'pileTotal':pile_counts[sid], **count_fields,
            'loadKw':hour_energy[(sid, origin-HOUR)],'installedCapacityKw':capacity[sid],
            'occupancyRate':counts['using']/pile_counts[sid], 'utilizationRate':counts['using']/pile_counts[sid],
            'coverageRatio':1-counts['unknown']/pile_counts[sid], 'nextHourIdle':prediction[sid][0]['predictedFreePiles'], 'updatedAt':as_of}
        assert sum(count_fields.values()) == station['pileTotal']
        view_stations.append(station)
        windows = {}
        for hours in (24, 168):
            selected = [r for r in orders if r['station_id']==sid and origin-timedelta(hours=hours)<=dt(r['created_at'])<origin]
            statuses, types = Counter(), Counter()
            for r in selected:
                events = sorted((e for e in order_events[r['order_id']] if dt(e['event_time'])<=origin), key=lambda e:(e['event_time'],e['order_event_id']))
                statuses[events[-1]['event_type'] if events else 'created'] += 1
                types[r.get('tariff_id') or 'unknown'] += 1
            windows[hours] = {'asOf':as_of,'windowHours':hours,'total':len(selected),'statuses':dict(statuses),'types':dict(types)}
        midnight = origin.replace(hour=0, minute=0, second=0, microsecond=0)
        bundles[sid] = {'history':[{'time':iso(origin-timedelta(hours=24-i)), 'value':hour_energy[(sid, origin-timedelta(hours=24-i))], 'quality':'complete'} for i in range(24)],
            'todayEnergyKwh':sum(value for (station_id, hour),value in hour_energy.items() if station_id==sid and midnight<=hour<origin),
            'todayNetRevenueYuan':sum(r['amount_cents'] for r in revenue if order_map[r['order_id']]['station_id']==sid and midnight<=dt(r['occurred_at'])<origin)/100,
            'orders':windows,'prediction':prediction[sid]}
    snapshots[as_of] = {'stations':view_stations,'bundles':bundles}

out = {'datasetId':RAW.name,'availableAsOf':sorted(snapshots),'trainingDataCutoff':iso(cutoff),
    'modelVersion':'load_rf_v1 / free_rf_v1','featureVersion':metrics['feature_version'],
    'snapshots':snapshots}
(WEB/'src/data/member3-replay.json').write_text(json.dumps(out,ensure_ascii=False,separators=(',',':'),allow_nan=False),encoding='utf8')
(WEB/'src/data/member3-metrics.json').write_text(json.dumps(metrics,ensure_ascii=False,separators=(',',':'),allow_nan=False),encoding='utf8')
report = {'origins':sorted(snapshots),'deliveredStations':len(stations),'displayedStations':IDS,'validatedPredictionRows':len(snapshots)*len(stations)*24,
    'displayedPredictionRows':len(snapshots)*len(IDS)*24,'removedExactTelemetryDuplicates':duplicates,'predictionSources':sources,
    'historicalSource':str(RAW.relative_to(WORK)), 'historicalMethod':'local small-data telemetry interval overlap + state snapshot/event reconstruction; not published ADS',
    'weatherModel':'E1 without_weather; E2 evaluation only','checks':['origin >= train cutoff','UTC physical timestamp converted to Beijing','24 unique consecutive hours','free_piles_time == interval_end','load/free capacity constraints','capacity_ratio matches same-batch pile dimension','state conservation']}
(WEB/'docs/member3-import-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
print(f'Imported {report["validatedPredictionRows"]} predictions; displayed {report["displayedPredictionRows"]}; {len(snapshots)} replay origins.')
