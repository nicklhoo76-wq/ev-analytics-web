import type {
  DashboardContext,
  DataMeta,
  ModelMetric,
  PipelineData,
  PredictionData,
  SeriesPoint,
  StationStatus,
  WeatherImpactGroup,
  WeatherPoint,
} from '@/types/api'

export const availableAsOf = [
  '2023-04-04T12:00:00+08:00',
  '2023-04-09T20:00:00+08:00',
  '2023-04-30T23:00:00+08:00',
]

export function createMeta(asOf: string, stale = false): DataMeta {
  return {
    datasetId: 'beijing-development-seed-20260914',
    batchId: 'beijing-development-seed-20260914',
    source: 'synthetic',
    sourceLabel: '北京模拟业务数据 · 深圳公开数据校准',
    clockMode: 'replay',
    asOf,
    dataCutoff: asOf,
    generatedAt: '2026-09-14T16:49:41+08:00',
    isStale: stale,
    qualityStatus: 'complete',
    coverageRatio: 1,
    isFixture: true,
  }
}

export function contextFixture(asOf: string, stale = false): DashboardContext {
  return {
    meta: createMeta(asOf, stale),
    datasetName: '北京充电运营模拟集 · development',
    availableRange: {
      start: '2023-04-01T00:00:00+08:00',
      end: '2023-05-01T00:00:00+08:00',
    },
    availableAsOf,
    predictionAvailable: true,
    modelMetricsAvailable: false,
    weatherStatus: 'synthetic',
  }
}

export const stationsFixture: StationStatus[] = [
  { stationId: 'BJS-S0001', stationName: '北京模拟新能源充电站001', district: '海淀区', sceneType: 'office', pileTotal: 3, idlePiles: 1, usingPiles: 2, reservedPiles: 0, faultPiles: 0, unknownPiles: 0, loadKw: 82.4, installedCapacityKw: 191, occupancyRate: .67, utilizationRate: .58, coverageRatio: 1, nextHourIdle: 2, updatedAt: '2023-04-09T20:00:00+08:00' },
  { stationId: 'BJS-S0002', stationName: '北京模拟新能源充电站002', district: '朝阳区', sceneType: 'commercial', pileTotal: 4, idlePiles: 1, usingPiles: 2, reservedPiles: 1, faultPiles: 0, unknownPiles: 0, loadKw: 116.7, installedCapacityKw: 251, occupancyRate: .50, utilizationRate: .63, coverageRatio: 1, nextHourIdle: 1, updatedAt: '2023-04-09T20:00:00+08:00' },
  { stationId: 'BJS-S0003', stationName: '北京模拟新能源充电站003', district: '丰台区', sceneType: 'mixed', pileTotal: 2, idlePiles: 2, usingPiles: 0, reservedPiles: 0, faultPiles: 0, unknownPiles: 0, loadKw: 0, installedCapacityKw: 71, occupancyRate: 0, utilizationRate: .31, coverageRatio: 1, nextHourIdle: 2, updatedAt: '2023-04-09T20:00:00+08:00' },
  { stationId: 'BJS-S0004', stationName: '北京模拟新能源充电站004', district: '石景山区', sceneType: 'residential', pileTotal: 2, idlePiles: 0, usingPiles: 2, reservedPiles: 0, faultPiles: 0, unknownPiles: 0, loadKw: 18.5, installedCapacityKw: 29, occupancyRate: 1, utilizationRate: .72, coverageRatio: 1, nextHourIdle: 1, updatedAt: '2023-04-09T20:00:00+08:00' },
  { stationId: 'BJS-S0005', stationName: '北京模拟新能源充电站005', district: '房山区', sceneType: 'residential', pileTotal: 2, idlePiles: 1, usingPiles: 0, reservedPiles: 0, faultPiles: 1, unknownPiles: 0, loadKw: 0, installedCapacityKw: 127, occupancyRate: 0, utilizationRate: .23, coverageRatio: 1, nextHourIdle: 1, updatedAt: '2023-04-09T20:00:00+08:00' },
  { stationId: 'BJS-S0006', stationName: '北京模拟新能源充电站006', district: '大兴区', sceneType: 'transit', pileTotal: 5, idlePiles: 2, usingPiles: 3, reservedPiles: 0, faultPiles: 0, unknownPiles: 0, loadKw: 141.3, installedCapacityKw: 378, occupancyRate: .60, utilizationRate: .69, coverageRatio: 1, nextHourIdle: 1, updatedAt: '2023-04-09T20:00:00+08:00' },
  { stationId: 'BJS-S0007', stationName: '北京模拟新能源充电站007', district: '通州区', sceneType: 'residential', pileTotal: 3, idlePiles: 2, usingPiles: 1, reservedPiles: 0, faultPiles: 0, unknownPiles: 0, loadKw: 6.8, installedCapacityKw: 40, occupancyRate: .33, utilizationRate: .42, coverageRatio: 1, nextHourIdle: 2, updatedAt: '2023-04-09T20:00:00+08:00' },
  { stationId: 'BJS-S0008', stationName: '北京模拟新能源充电站008', district: '顺义区', sceneType: 'transit', pileTotal: 4, idlePiles: 2, usingPiles: 2, reservedPiles: 0, faultPiles: 0, unknownPiles: 0, loadKw: 126.2, installedCapacityKw: 262, occupancyRate: .50, utilizationRate: .61, coverageRatio: 1, nextHourIdle: 2, updatedAt: '2023-04-09T20:00:00+08:00' },
]

function hourPoints(asOf: string, count: number, forward: boolean, base: number, amplitude: number): SeriesPoint[] {
  const anchor = new Date(asOf).getTime()
  return Array.from({ length: count }, (_, index) => {
    const offset = forward ? index + 1 : index - count + 1
    const time = new Date(anchor + offset * 3600_000).toISOString()
    const wave = Math.sin((index / Math.max(1, count - 1)) * Math.PI * 2 - 1.1)
    const evening = Math.max(0, Math.sin((index / Math.max(1, count - 1)) * Math.PI))
    return { time, value: Math.max(0, Number((base + amplitude * wave + amplitude * .55 * evening).toFixed(2))), quality: 'complete' }
  })
}

export function historyFixture(metric: 'load' | 'energy' | 'net_revenue' | 'sessions_started' | 'utilization' | 'idle_piles', asOf: string): SeriesPoint[] {
  const profiles = {
    load: [238, 112], energy: [172, 68], net_revenue: [720, 240], sessions_started: [3.2, 2.1],
    utilization: [.42, .18], idle_piles: [21, 7],
  } as const
  const [base, amplitude] = profiles[metric]
  return hourPoints(asOf, 24, false, base, amplitude)
}

export function predictionFixture(hours: 1 | 6 | 24, asOf: string, stationId?: string): PredictionData {
  const origin = new Date(asOf).getTime()
  const points = Array.from({ length: hours }, (_, index) => {
    const start = new Date(origin + index * 3600_000)
    const end = new Date(origin + (index + 1) * 3600_000)
    const load = Math.max(82, 286 + 105 * Math.sin((index + 1) / 3.4) + (index > 11 ? -46 : 0))
    const free = Math.max(5, Math.round(23 - load / 24))
    return {
      intervalStart: start.toISOString(),
      intervalEnd: end.toISOString(),
      predictedLoadKw: Number(load.toFixed(1)),
      predictedFreePiles: free,
      capacityRatio: Number((load / 1350).toFixed(3)),
      weatherCode: index === 3 || index === 4 ? 'rain' : 'cloudy',
      temperatureC: Number((19.4 - index * .18).toFixed(1)),
    }
  })
  return {
    stationId: stationId || null, hours, forecastOrigin: asOf, modelVersion: null, featureVersion: null,
    predictionMethod: 'interface_fixture', engine: '等待 Spark MLlib 结果', featureSet: 'contract_preview',
    weatherStatus: 'synthetic_fixture', coverageStations: stationId ? 1 : 20, totalStations: 20,
    points, meta: createMeta(asOf),
  }
}

export function weatherFixture(asOf: string): WeatherPoint[] {
  const origin = new Date(asOf).getTime()
  return Array.from({ length: 24 }, (_, index) => ({
    time: new Date(origin + index * 3600_000).toISOString(),
    temperatureC: Number((19.2 - Math.abs(index - 9) * .22 + Math.sin(index / 3)).toFixed(1)),
    precipMm: index >= 3 && index <= 5 ? Number((1.2 + index * .35).toFixed(1)) : 0,
    weatherCode: index === 4 ? 'rain' : index > 15 ? 'clear' : 'cloudy',
  }))
}

export const weatherImpactFixture: WeatherImpactGroup[] = [
  { label: '[0,10)°C', sampleCount: 160, avgLoadKw: 16.2, avgEnergyKwh: 14.7, coverageRatio: 1 },
  { label: '[10,20)°C', sampleCount: 3210, avgLoadKw: 14.4, avgEnergyKwh: 13.1, coverageRatio: 1 },
  { label: '[20,30)°C', sampleCount: 8460, avgLoadKw: 15.8, avgEnergyKwh: 14.2, coverageRatio: 1 },
  { label: '[30,+∞)°C', sampleCount: 640, avgLoadKw: 17.1, avgEnergyKwh: 15.4, coverageRatio: 1 },
]

export const modelMetricsFixture: ModelMetric[] = []

export function pipelineFixture(asOf: string): PipelineData {
  return {
    datasetId: 'beijing-development-seed-20260914', seed: 20260914, rawRows: 383284,
    rawBytes: 106350741, hdfsBytes: 106401324, replicationFactor: 1, sourceFiles: 15,
    dateRange: '2023-04-01—2023-04-30', trainingHours: 14400, weatherCoverageRatio: 1,
    stages: [
      { name: 'ODS', status: 'complete', detail: '15张原始业务表已进入HDFS', rowCount: 383284, durationSeconds: 12, jobId: null },
      { name: 'DWD', status: 'complete', detail: '去重117条，修复5条负功率', rowCount: 383167, durationSeconds: 84, jobId: 'application_20260914_0012' },
      { name: 'DWS', status: 'complete', detail: '站点小时网格与天气关联完成', rowCount: 57600, durationSeconds: 71, jobId: 'application_20260914_0013' },
      { name: 'MLlib', status: 'waiting', detail: '等待成员3提交预测与评估结果', rowCount: null, durationSeconds: null, jobId: null },
      { name: 'ADS', status: 'complete', detail: '7张展示表已生成，预测表为空结构', rowCount: 18240, durationSeconds: 33, jobId: 'application_20260914_0014' },
      { name: 'Published', status: 'complete', detail: '小型ADS已复制到结果库', rowCount: 18240, durationSeconds: 4, jobId: null },
    ],
    quality: [
      { code: 'Q02', label: '完全重复', before: 117, after: 0, action: '保留一条，丢弃重复' },
      { code: 'Q04', label: '负功率', before: 5, after: 0, action: '按区间电量重算' },
      { code: 'Q06', label: '连接器温度缺失', before: 11, after: 11, action: '保留空值并标记' },
      { code: 'Q01', label: '解析失败', before: 0, after: 0, action: '无隔离记录' },
    ],
    tables: [
      { layer: 'ODS', tableName: 'fact_pile_telemetry', rowCount: 25095, primaryKey: 'pile_id + interval_start', status: 'ready' },
      { layer: 'DWD', tableName: 'dwd_pile_telemetry', rowCount: 24978, primaryKey: 'pile_id + interval_start', status: 'ready' },
      { layer: 'DWS', tableName: 'dws_station_hour_operation', rowCount: 14400, primaryKey: 'station_id + hour_start', status: 'ready' },
      { layer: 'DWS', tableName: 'dws_model_features', rowCount: 14400, primaryKey: 'station_id + hour_start', status: 'ready' },
      { layer: 'ADS', tableName: 'ads_overview', rowCount: 3, primaryKey: 'as_of_time', status: 'published' },
      { layer: 'ADS', tableName: 'ads_station_status', rowCount: 60, primaryKey: 'station_id + as_of_time', status: 'published' },
      { layer: 'ADS', tableName: 'ads_predictions', rowCount: 0, primaryKey: 'station_id + origin + target', status: 'published' },
    ],
    meta: createMeta(asOf),
  }
}
