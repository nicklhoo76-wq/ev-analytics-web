import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'

const root = process.cwd()
const batchDir = path.resolve(root, '..', '用户4交付', 'result_store', 'beijing-gb-v2-seed-20260916', 'batches', 'gb_v2b_20260916_1200_ads_v2')
const outFile = path.resolve(root, 'src', 'data', 'member4-replay.json')

const readJson = file => JSON.parse(fs.readFileSync(path.join(batchDir, file), 'utf8'))
const manifest = readJson('batch_manifest.json')
const metrics = readJson('metrics_e1.json')
const mlRun = readJson('ml_run_manifest.json')
const availableAsOf = manifest.available_as_of
const stationsByAsOf = new Map()
const overviewByAsOf = new Map()
const predictionsByAsOf = new Map()
const seriesByAsOfStationMetric = new Map()
const ordersByAsOfStationWindow = new Map()

const toMs = value => new Date(value).getTime()
const asOfWindows = availableAsOf.map(asOf => ({
  asOf,
  end: toMs(asOf),
  start24: toMs(asOf) - 24 * 3600_000,
  start168: toMs(asOf) - 168 * 3600_000,
}))

async function readJsonl(file, onRow) {
  const rl = readline.createInterface({ input: fs.createReadStream(path.join(batchDir, file), { encoding: 'utf8' }), crlfDelay: Infinity })
  for await (const line of rl) {
    if (line.trim()) onRow(JSON.parse(line))
  }
}

const asQuality = value => value === 'partial' || value === 'unavailable' ? value : 'complete'
const stationKey = row => row.station_id
const asOfKey = row => row.as_of_time || row.forecast_origin
const bundleKey = (asOf, stationId, suffix) => `${asOf}::${stationId}::${suffix}`
const score = value => ({ n: value?.n ?? 0, mae: value?.mae ?? 0, rmse: value?.rmse ?? 0 })
const seriesBlock = value => ({
  model: score(value?.model),
  baselinePrevDay: score(value?.baseline_prev_day),
  commonSampleCount: value?.common_sample_count ?? 0,
  sameSample: true,
  perHorizon: value?.per_horizon || [],
  perStation: (value?.per_station || []).map(item => ({ stationId: item.station_id, n: item.n, mae: item.mae, rmse: item.rmse })),
})
const modelMetric = (experiment, targetName, unit, block) => ({
  experiment,
  modelVersion: metrics.model_versions?.join(' / ') || 'load_rf_v1 / free_rf_v1',
  targetName,
  horizonHours: 24,
  algorithm: 'RandomForest',
  engine: 'Spark MLlib',
  sampleCount: block?.model?.n ?? 0,
  mae: block?.model?.mae ?? 0,
  rmse: block?.model?.rmse ?? 0,
  baselineMae: block?.baseline_prev_day?.mae ?? 0,
  withWeather: experiment === 'E2',
  testRange: `${metrics.split?.test_start || ''} ~ ${metrics.split?.data_end_exclusive || ''}`,
  metricUnit: unit,
  perHorizon: block?.per_horizon || [],
  perStation: (block?.per_station || []).map(item => ({ stationId: item.station_id, n: item.n, mae: item.mae, rmse: item.rmse })),
})

await readJsonl('ads_overview.jsonl', row => {
  overviewByAsOf.set(row.as_of_time, row)
})

await readJsonl('ads_station_status.jsonl', row => {
  const list = stationsByAsOf.get(row.as_of_time) || []
  list.push({
    longitude: row.longitude,
    latitude: row.latitude,
    stationId: row.station_id,
    stationName: row.station_name,
    district: row.district,
    sceneType: row.scene_type || 'mixed',
    pileTotal: row.pile_total,
    idlePiles: row.idle_piles,
    usingPiles: row.using_piles,
    reservedPiles: row.reserved_piles,
    faultPiles: row.fault_piles,
    unknownPiles: row.unknown_piles,
    loadKw: row.load_kw,
    installedCapacityKw: row.installed_capacity_kw,
    occupancyRate: row.occupancy_rate,
    utilizationRate: row.utilization_rate,
    coverageRatio: row.coverage_ratio,
    nextHourIdle: null,
    updatedAt: row.as_of_time,
    todayEnergyKwh: row.today_energy_kwh,
    todayNetRevenueYuan: row.today_net_revenue_yuan,
  })
  stationsByAsOf.set(row.as_of_time, list)
})

await readJsonl('ads_predictions.jsonl', row => {
  const key = bundleKey(row.forecast_origin, row.station_id, 'prediction')
  const list = predictionsByAsOf.get(key) || []
  list.push({
    h: row.h,
    intervalStart: row.interval_start,
    intervalEnd: row.interval_end,
    predictedLoadKw: row.predicted_load_kw,
    predictedFreePiles: row.predicted_free_piles,
    capacityRatio: row.capacity_ratio,
    weatherCode: null,
    temperatureC: null,
  })
  predictionsByAsOf.set(key, list)
})

await readJsonl('ads_series.jsonl', row => {
  if (row.granularity !== 'hour') return
  if (row.metric !== 'load' && row.metric !== 'energy') return
  const rowEnd = toMs(row.interval_end)
  for (const window of asOfWindows) {
    if (rowEnd <= window.end && rowEnd > window.start24) {
      const key = bundleKey(window.asOf, row.station_id, row.metric)
      const list = seriesByAsOfStationMetric.get(key) || []
      list.push({ time: row.interval_start, value: row.value, quality: asQuality(row.quality_status) })
      seriesByAsOfStationMetric.set(key, list)
    }
  }
})

await readJsonl('ads_order_events.jsonl', row => {
  const eventTime = toMs(row.event_time)
  for (const window of asOfWindows) {
    for (const hours of [24, 168]) {
      const start = hours === 24 ? window.start24 : window.start168
      if (eventTime > start && eventTime <= window.end) {
        const key = bundleKey(window.asOf, row.station_id, String(hours))
        const summary = ordersByAsOfStationWindow.get(key) || { asOf: window.asOf, windowHours: hours, total: 0, statuses: {}, types: {} }
        summary.total += 1
        summary.statuses[row.event_type] = (summary.statuses[row.event_type] || 0) + 1
        summary.types[row.tariff_id] = (summary.types[row.tariff_id] || 0) + 1
        ordersByAsOfStationWindow.set(key, summary)
      }
    }
  }
})

const snapshots = {}
for (const asOf of availableAsOf) {
  const stations = (stationsByAsOf.get(asOf) || []).sort((a, b) => a.stationId.localeCompare(b.stationId))
  const bundles = {}
  for (const station of stations) {
    const history = (seriesByAsOfStationMetric.get(bundleKey(asOf, station.stationId, 'load')) || []).sort((a, b) => a.time.localeCompare(b.time))
    const energy = (seriesByAsOfStationMetric.get(bundleKey(asOf, station.stationId, 'energy')) || []).sort((a, b) => a.time.localeCompare(b.time))
    const prediction = (predictionsByAsOf.get(bundleKey(asOf, station.stationId, 'prediction')) || []).sort((a, b) => a.h - b.h).map(({ h, ...point }) => point)
    bundles[station.stationId] = {
      history,
      energy,
      todayEnergyKwh: station.todayEnergyKwh ?? 0,
      todayNetRevenueYuan: station.todayNetRevenueYuan ?? 0,
      orders: {
        24: ordersByAsOfStationWindow.get(bundleKey(asOf, station.stationId, '24')) || { asOf, windowHours: 24, total: 0, statuses: {}, types: {} },
        168: ordersByAsOfStationWindow.get(bundleKey(asOf, station.stationId, '168')) || { asOf, windowHours: 168, total: 0, statuses: {}, types: {} },
      },
      prediction,
    }
    delete station.todayEnergyKwh
    delete station.todayNetRevenueYuan
    station.nextHourIdle = prediction[0]?.predictedFreePiles ?? null
  }
  snapshots[asOf] = { stations, bundles, overview: overviewByAsOf.get(asOf) }
}

const output = {
  datasetId: manifest.dataset_id,
  batchId: manifest.batch_id,
  sourceLabel: '北京真实ADS回放与Spark MLlib预测',
  availableAsOf,
  trainingDataCutoff: metrics.split?.val_start,
  modelVersion: metrics.model_versions?.join(' / ') || 'load_rf_v1 / free_rf_v1',
  featureVersion: metrics.feature_version || 'v1',
  modelEvaluation: {
    items: [
      modelMetric('E1', 'load_kw', 'kW', metrics.load),
      modelMetric('E1', 'idle_pile_count', '个', metrics.free),
      modelMetric('E2', 'load_kw', 'kW', metrics.e2?.load),
      modelMetric('E2', 'idle_pile_count', '个', metrics.e2?.free),
    ],
    datasetId: manifest.dataset_id,
    mlRunId: mlRun.run_id,
    sparkVersion: metrics.spark_version,
    featureVersion: metrics.feature_version || 'v1',
    split: {
      valStart: metrics.split?.val_start,
      testStart: metrics.split?.test_start,
      dataEndExclusive: metrics.split?.data_end_exclusive,
    },
    testSampleCount: metrics.test_feature_complete_samples_e1,
    constraints: {
      loadClipTriggers: metrics.constraints?.load_clip_triggers ?? 0,
      freeClipTriggers: metrics.constraints?.free_clip_triggers ?? 0,
      note: metrics.constraints?.note || '',
    },
    comparison: {
      load: seriesBlock(metrics.load),
      free: seriesBlock(metrics.free),
    },
    weatherExperiment: {
      status: metrics.e2?.status || 'unavailable',
      commonSampleCount: metrics.e2?.common_sample_count ?? 0,
      coverageRatio: metrics.e2?.weather_coverage_ratio ?? 0,
      coveredHorizons: metrics.e2?.load?.per_horizon?.map(item => item.h) || [],
      totalHorizons: 24,
      load: score(metrics.e2?.load?.model),
      free: score(metrics.e2?.free?.model),
      e1OnCommon: {
        load: { model: score(metrics.e2?.e1_on_common?.load?.model) },
        free: { model: score(metrics.e2?.e1_on_common?.free?.model) },
      },
      note: '天气增强只覆盖已归档天气预报的共同样本，不代表全时域效果。',
    },
    evaluationNote: metrics.constraints?.note || '评估误差在约束前(raw prediction)计算。',
  },
  snapshots,
}

fs.writeFileSync(outFile, `${JSON.stringify(output)}\n`, 'utf8')
console.log(`Wrote ${path.relative(root, outFile)} with ${availableAsOf.length} snapshots and ${Object.keys(snapshots[availableAsOf[0]]?.bundles || {}).length} stations.`)
