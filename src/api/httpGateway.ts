import type { DashboardGateway } from '@/types/api'
import { useDashboardStore } from '@/stores/dashboard'

const base = import.meta.env.VITE_API_BASE || '/api/v1'

async function request<T>(path: string, params: Record<string, string | number | undefined> = {}): Promise<T> {
  const url = new URL(`${base}${path}`, window.location.origin)
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') url.searchParams.set(key, String(value))
  })
  const response = await fetch(url, { headers: { Accept: 'application/json' } })
  const payload = await response.json().catch(() => null)
  if (!response.ok) throw new Error(payload?.error_code || `HTTP_${response.status}`)
  return camelize(payload && typeof payload === 'object' && 'data' in payload ? payload.data : payload) as T
}

function camelize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(camelize)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, child]) => [key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase()), key === 'statuses' || key === 'types' ? child : camelize(child)]))
}

const common = (asOf?: string) => {
  const { state } = useDashboardStore()
  return { dataset_id: state.datasetId, batch_id: state.batchId, as_of: asOf || state.asOf }
}

export const httpGateway: DashboardGateway = {
  getOrders: (asOf,windowHours,stationId) => request('/analytics/orders', {...common(asOf),window_hours:windowHours,station_id:stationId}),
  getContext: asOf => request('/context', common(asOf)),
  async getOverview(asOf, stationId) {
    const data = await request<any>('/dashboard/overview', { ...common(asOf), station_id: stationId })
    const counts = data.statusCounts || {}
    return { ...data, activeOrders: data.activeOrders ?? counts.using ?? 0, idlePiles: data.idlePiles ?? counts.idle ?? 0, reservedPiles: data.reservedPiles ?? counts.reserved ?? 0, faultPiles: data.faultPiles ?? counts.fault ?? 0, unknownPiles: data.unknownPiles ?? counts.unknown ?? 0, totalPiles: data.totalPiles ?? counts.total ?? 0, installedCapacityKw: data.installedCapacityKw ?? 0, stationCount: data.stationCount ?? 0 }
  },
  async getStations(asOf) {
    const data = await request<any>('/dashboard/station-status', common(asOf))
    return (data.items || data).map((item: any) => ({ ...item, stationName: item.stationName || item.name, sceneType: item.sceneType || 'mixed', occupancyRate: item.occupancyRate ?? 0, utilizationRate: item.utilizationRate ?? 0, coverageRatio: item.coverageRatio ?? 1, nextHourIdle: item.nextHourIdle ?? null }))
  },
  async getSeries(metric, asOf, stationId) {
    const data = await request<any>('/analytics/series', { ...common(asOf), metric, station_id: stationId, granularity: 'hour' })
    return { ...data, points: data.points.map((point: any) => ({ ...point, time: point.time || point.intervalStart })) }
  },
  async getPrediction(hours, asOf, stationId) {
    try { return await request('/predictions/load', { ...common(asOf), hours, station_id: stationId }) }
    catch (error) { if (error instanceof Error && error.message === 'PREDICTION_NOT_AVAILABLE') return null; throw error }
  },
  async getWeather(asOf) {
    const data = await request<any>('/weather', { ...common(asOf), hours: 24 })
    return data.points || data.forecast || []
  },
  getWeatherImpact: () => request('/analytics/weather-impact', { ...common(), group_by: 'temperature_band' }),
  async getModelMetrics() {
    const data = await request<any>('/models/evaluation', common())
    return data.items || data.metrics || (Array.isArray(data) ? data : [])
  },
  getPipeline: () => request('/pipeline/latest', common()),
}
