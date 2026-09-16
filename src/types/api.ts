export type Role = 'user' | 'admin'
export type QualityStatus = 'complete' | 'partial' | 'unavailable'
export type PileState = 'idle' | 'using' | 'reserved' | 'fault' | 'unknown'
export type MockScenario = 'normal' | 'no-prediction' | 'stale' | 'error'

export interface DataMeta {
  datasetId: string
  batchId: string
  source: 'synthetic'
  sourceLabel: string
  clockMode: 'replay'
  asOf: string
  dataCutoff: string
  generatedAt: string
  isStale: boolean
  qualityStatus: QualityStatus
  coverageRatio: number
  isFixture: boolean
}

export interface DashboardContext {
  meta: DataMeta
  datasetName: string
  availableRange: { start: string; end: string }
  availableAsOf: string[]
  predictionAvailable: boolean
  modelMetricsAvailable: boolean
  weatherStatus: 'synthetic' | 'unavailable'
}

export interface OverviewData {
  activeOrders: number
  idlePiles: number
  reservedPiles: number
  faultPiles: number
  unknownPiles: number
  totalPiles: number
  loadKw: number
  installedCapacityKw: number
  todayEnergyKwh: number
  todayNetRevenueYuan: number
  stationCount: number
  meta: DataMeta
}

export interface StationStatus {
  longitude?: number
  latitude?: number
  stationId: string
  stationName: string
  district: string
  sceneType: 'office' | 'residential' | 'transit' | 'commercial' | 'mixed'
  pileTotal: number
  idlePiles: number
  usingPiles: number
  reservedPiles: number
  faultPiles: number
  unknownPiles: number
  loadKw: number
  installedCapacityKw: number
  occupancyRate: number
  utilizationRate: number
  coverageRatio: number
  nextHourIdle: number | null
  updatedAt: string
}

export interface SeriesPoint {
  time: string
  value: number | null
  quality: QualityStatus
}

export interface MetricSeries {
  metric: 'load' | 'energy' | 'net_revenue' | 'sessions_started' | 'utilization' | 'idle_piles'
  unit: string
  points: SeriesPoint[]
  meta: DataMeta
}

export interface PredictionPoint {
  intervalStart: string
  intervalEnd: string
  predictedLoadKw: number | null
  predictedFreePiles: number | null
  capacityRatio: number | null
  weatherCode: string | null
  temperatureC: number | null
}

export interface PredictionData {
  stationId: string | null
  hours: 1 | 6 | 24
  forecastOrigin: string
  modelVersion: string | null
  featureVersion: string | null
  predictionMethod: string
  engine: string
  featureSet: string
  weatherStatus: string
  coverageStations: number
  totalStations: number
  points: PredictionPoint[]
  meta: DataMeta
}

export interface WeatherPoint {
  time: string
  temperatureC: number
  precipMm: number
  weatherCode: 'clear' | 'cloudy' | 'rain' | 'storm'
}

export interface WeatherImpactGroup {
  label: string
  sampleCount: number
  avgLoadKw: number
  avgEnergyKwh: number
  coverageRatio: number
}

export interface ModelMetric {
  experiment: 'E0' | 'E1' | 'E2'
  modelVersion: string
  targetName: 'load_kw' | 'idle_pile_count'
  horizonHours: 1 | 6 | 24
  algorithm: string
  engine: string
  sampleCount: number
  mae: number
  rmse: number
  baselineMae: number
  withWeather: boolean
  testRange: string
  metricUnit: string
  perHorizon: Array<{ h: number; n: number; mae: number; rmse: number }>
  perStation: Array<{ stationId: string; n: number; mae: number; rmse: number }>
}

export interface PipelineStage {
  name: 'ODS' | 'DWD' | 'DWS' | 'MLlib' | 'ADS' | 'Published'
  status: 'complete' | 'waiting' | 'failed' | 'unknown'
  detail: string
  rowCount: number | null
  durationSeconds: number | null
  jobId: string | null
}

export interface QualityItem {
  code: string
  label: string
  before: number
  after: number
  action: string
}

export interface LayerTable {
  layer: 'ODS' | 'DWD' | 'DWS' | 'ADS'
  tableName: string
  rowCount: number
  primaryKey: string
  status: 'published' | 'ready'
}

export interface PipelineData {
  datasetId: string
  seed: number
  rawRows: number
  rawBytes: number
  hdfsBytes: number
  replicationFactor: number
  sourceFiles: number
  dateRange: string
  stages: PipelineStage[]
  quality: QualityItem[]
  tables: LayerTable[]
  trainingHours: number
  weatherCoverageRatio: number
  meta: DataMeta
}

export interface DashboardGateway {
  getOrders(asOf: string, windowHours: 24 | 168, stationId?: string): Promise<import('@/lib/operations').OrderSummary | null>
  getContext(asOf?: string): Promise<DashboardContext>
  getOverview(asOf: string, stationId?: string): Promise<OverviewData>
  getStations(asOf: string): Promise<StationStatus[]>
  getSeries(metric: MetricSeries['metric'], asOf: string, stationId?: string): Promise<MetricSeries>
  getPrediction(hours: 1 | 6 | 24, asOf: string, stationId?: string): Promise<PredictionData | null>
  getWeather(asOf: string): Promise<WeatherPoint[]>
  getWeatherImpact(): Promise<WeatherImpactGroup[]>
  getModelMetrics(): Promise<ModelMetric[]>
  getPipeline(): Promise<PipelineData>
}
