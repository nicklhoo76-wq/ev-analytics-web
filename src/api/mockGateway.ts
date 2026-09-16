import { useDashboardStore } from '@/stores/dashboard'
import orderWindows from '@/data/order-summaries.json'
import type { DashboardGateway, MetricSeries, OverviewData } from '@/types/api'
import {
  contextFixture,
  createMeta,
  historyFixture,
  modelMetricsFixture,
  pipelineFixture,
  predictionFixture,
  stationsFixture,
  weatherFixture,
  weatherImpactFixture,
} from '@/mocks/fixtures'

const delay = (ms = 120) => new Promise(resolve => setTimeout(resolve, ms))

export const mockGateway: DashboardGateway = {
  async getOrders(asOf, windowHours, stationId) {
    const window = orderWindows.find(w=>w.asOf===asOf && w.windowHours===windowHours)
    if(!window)return null
    const allowed = new Set(stationId ? [stationId] : stationsFixture.map(s=>s.stationId))
    const result = {asOf,windowHours,total:0,statuses:{} as Record<string,number>,types:{} as Record<string,number>}
    for(const item of window.stations.filter(s=>allowed.has(s.stationId))){
      result.total+=item.total
      for(const [key,value] of Object.entries(item.statuses))result.statuses[key]=(result.statuses[key]||0)+(value || 0)
      for(const [key,value] of Object.entries(item.types))result.types[key]=(result.types[key]||0)+(value || 0)
    }
    return result
  },
  async getContext(asOf) {
    await delay()
    const { state } = useDashboardStore()
    if (state.scenario === 'error') throw new Error('RESULT_STORE_UNAVAILABLE')
    return contextFixture(asOf || state.asOf, state.scenario === 'stale')
  },
  async getOverview(asOf, stationId) {
    await delay()
    const source = stationId ? stationsFixture.filter(item => item.stationId === stationId) : stationsFixture
    // The station list is a compact UI fixture (8 of 20 stations). City totals mirror
    // the published ADS overview instead of incorrectly summing only the visible sample.
    const aggregate = stationId ? {
      totalPiles: source.reduce((sum, item) => sum + item.pileTotal, 0),
      activeOrders: source.reduce((sum, item) => sum + item.usingPiles, 0),
      idlePiles: source.reduce((sum, item) => sum + item.idlePiles, 0),
      reservedPiles: source.reduce((sum, item) => sum + item.reservedPiles, 0),
      faultPiles: source.reduce((sum, item) => sum + item.faultPiles, 0),
      unknownPiles: source.reduce((sum, item) => sum + item.unknownPiles, 0),
      loadKw: source.reduce((sum, item) => sum + item.loadKw, 0),
      installedCapacityKw: source.reduce((sum, item) => sum + item.installedCapacityKw, 0),
    } : { totalPiles: 40, activeOrders: 12, idlePiles: 23, reservedPiles: 3, faultPiles: 2, unknownPiles: 0, loadKw: 492.7, installedCapacityKw: 1350 }
    const data: OverviewData = {
      activeOrders: aggregate.activeOrders,
      idlePiles: aggregate.idlePiles,
      reservedPiles: aggregate.reservedPiles,
      faultPiles: aggregate.faultPiles,
      unknownPiles: aggregate.unknownPiles,
      totalPiles: aggregate.totalPiles,
      loadKw: Number(aggregate.loadKw.toFixed(1)),
      installedCapacityKw: aggregate.installedCapacityKw,
      todayEnergyKwh: Number((1672.8 * (stationId ? source.reduce((a,s)=>a+s.installedCapacityKw,0)/stationsFixture.reduce((a,s)=>a+s.installedCapacityKw,0) : 1)).toFixed(1)),
      todayNetRevenueYuan: Number((2348.7 * (stationId ? source.reduce((a,s)=>a+s.installedCapacityKw,0)/stationsFixture.reduce((a,s)=>a+s.installedCapacityKw,0) : 1)).toFixed(1)),
      stationCount: source.length,
      meta: createMeta(asOf, useDashboardStore().state.scenario === 'stale'),
    }
    return data
  },
  async getStations() {
    await delay()
    return stationsFixture
  },
  async getSeries(metric, asOf, stationId) {
    await delay()
    const units: Record<MetricSeries['metric'], string> = { load: 'kW', energy: 'kWh', net_revenue: '元', sessions_started: '次', utilization: '%', idle_piles: '个' }
    const station = stationsFixture.find(s=>s.stationId===stationId)
    const totalCapacity = stationsFixture.reduce((a,s)=>a+s.installedCapacityKw,0)
    const scale = station ? station.installedCapacityKw / totalCapacity : 1
    const phase = station ? Number(station.stationId.slice(-2))*.55 : 0
    const points = historyFixture(metric, asOf).map((p,i)=>({ ...p, value: p.value === null ? null : Number((p.value*scale*(1+Math.sin(i/4+phase)*.18)).toFixed(2)) }))
    return { metric, unit: units[metric], points, meta: createMeta(asOf) }
  },
  async getPrediction(hours, asOf, stationId) {
    await delay()
    const scenario = useDashboardStore().state.scenario
    if(scenario === 'no-prediction') return null
    const result = predictionFixture(hours, asOf, stationId)
    const station = stationsFixture.find(s=>s.stationId===stationId)
    if(station) {
      const capacity = stationsFixture.reduce((a,s)=>a+s.installedCapacityKw,0)
      result.points = result.points.map(p=>({ ...p, predictedLoadKw: Number(((p.predictedLoadKw ?? 0)*station.installedCapacityKw/capacity).toFixed(1)), predictedFreePiles: Math.min(station.pileTotal,Math.max(0,Math.round((p.predictedFreePiles ?? 0)/25*station.pileTotal))) }))
    }
    return result
  },
  async getWeather(asOf) {
    await delay()
    return weatherFixture(asOf)
  },
  async getWeatherImpact() {
    await delay()
    return weatherImpactFixture
  },
  async getModelMetrics() {
    // 模拟模式不伪造训练指标：正式指标只在 api 模式由发布产物提供
    throw new Error('MODEL_METRICS_NOT_PUBLISHED')
  },
  async getPipeline() {
    await delay()
    return pipelineFixture(useDashboardStore().state.asOf)
  },
}
