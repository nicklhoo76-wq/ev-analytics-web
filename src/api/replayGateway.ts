import replay from '@/data/member3-replay.json'
import { useDashboardStore } from '@/stores/dashboard'
import type { DashboardGateway, DataMeta, PredictionPoint, StationStatus } from '@/types/api'
import type { OrderSummary } from '@/lib/operations'

interface ReplayBundle {
  history: {time:string;value:number;quality:'complete'}[]
  todayEnergyKwh:number
  todayNetRevenueYuan:number
  orders:Record<string,OrderSummary>
  prediction:PredictionPoint[]
}
const snapshots = replay.snapshots as unknown as Record<string,{stations:StationStatus[];bundles:Record<string,ReplayBundle>}>
function snapshot(asOf:string) {
  if(useDashboardStore().state.scenario==='error') throw new Error('REPLAY_UNAVAILABLE')
  const value=snapshots[asOf]
  if(!value)throw new Error('REPLAY_TIME_UNAVAILABLE')
  return value
}
function scope(asOf:string,stationId?:string) {
  const value=snapshot(asOf)
  const stations=stationId?value.stations.filter(s=>s.stationId===stationId):value.stations
  if(!stations.length)throw new Error('STATION_UNAVAILABLE')
  return {stations,bundles:stations.map(s=>value.bundles[s.stationId])}
}
function meta(asOf:string):DataMeta {
  return {datasetId:replay.datasetId,batchId:replay.datasetId,source:'synthetic',sourceLabel:'北京同批次回放与Spark MLlib预测',clockMode:'replay',asOf,dataCutoff:asOf,generatedAt:asOf,isStale:useDashboardStore().state.scenario==='stale',qualityStatus:'complete',coverageRatio:1,isFixture:true}
}
function sumPoints(points:(number|null)[]):number|null {
  return points.some(p=>p===null)?null:points.reduce<number>((a,b)=>a+(b??0),0)
}
export const replayGateway:DashboardGateway={
  async getContext(asOf=replay.availableAsOf[1]!) {
    snapshot(asOf)
    return {meta:meta(asOf),datasetName:'北京充电网络',availableRange:{start:replay.availableAsOf[0]!,end:replay.availableAsOf.at(-1)!},availableAsOf:replay.availableAsOf,predictionAvailable:useDashboardStore().state.scenario!=='no-prediction',modelMetricsAvailable:true,weatherStatus:'unavailable'}
  },
  async getStations(asOf){return snapshot(asOf).stations},
  async getOverview(asOf,stationId){
    const {stations,bundles}=scope(asOf,stationId)
    const sum=(key:'idlePiles'|'usingPiles'|'reservedPiles'|'faultPiles'|'unknownPiles'|'pileTotal'|'loadKw'|'installedCapacityKw')=>stations.reduce((a,s)=>a+s[key],0)
    return {activeOrders:sum('usingPiles'),idlePiles:sum('idlePiles'),reservedPiles:sum('reservedPiles'),faultPiles:sum('faultPiles'),unknownPiles:sum('unknownPiles'),totalPiles:sum('pileTotal'),loadKw:sum('loadKw'),installedCapacityKw:sum('installedCapacityKw'),stationCount:stations.length,todayEnergyKwh:bundles.reduce((a,b)=>a+b.todayEnergyKwh,0),todayNetRevenueYuan:bundles.reduce((a,b)=>a+b.todayNetRevenueYuan,0),meta:meta(asOf)}
  },
  async getSeries(metric,asOf,stationId){
    const {bundles}=scope(asOf,stationId)
    const supported=metric==='load'||metric==='energy'
    return {metric,unit:metric==='energy'?'kWh':'kW',meta:meta(asOf),points:bundles[0]!.history.map((p,i)=>({time:p.time,value:supported?sumPoints(bundles.map(b=>b.history[i]?.value??null)):null,quality:supported?'complete':'unavailable'}))}
  },
  async getPrediction(hours,asOf,stationId){
    const {stations,bundles}=scope(asOf,stationId)
    if(useDashboardStore().state.scenario==='no-prediction')return null
    const capacity=stations.reduce((a,s)=>a+s.installedCapacityKw,0)
    const points=bundles[0]!.prediction.slice(0,hours).map((p,i)=>{
      const predictedLoadKw=sumPoints(bundles.map(b=>b.prediction[i]?.predictedLoadKw??null))
      return {...p,predictedLoadKw,predictedFreePiles:sumPoints(bundles.map(b=>b.prediction[i]?.predictedFreePiles??null)),capacityRatio:capacity&&predictedLoadKw!==null?predictedLoadKw/capacity:null}
    })
    return {stationId:stationId||null,hours,forecastOrigin:asOf,modelVersion:replay.modelVersion,featureVersion:replay.featureVersion,predictionMethod:'frozen_random_forest',engine:'Spark MLlib',featureSet:'E1',weatherStatus:'without_weather',coverageStations:stations.length,totalStations:stations.length,points,meta:meta(asOf)}
  },
  async getOrders(asOf,windowHours,stationId){
    const {bundles}=scope(asOf,stationId)
    const orders=bundles.map(b=>b.orders[String(windowHours)])
    if(orders.some(o=>!o))return null
    const result:OrderSummary={asOf,windowHours,total:0,statuses:{},types:{}}
    for(const o of orders){
      result.total+=o!.total
      for(const key of ['statuses','types'] as const)for(const [name,count] of Object.entries(o![key]))result[key][name]=(result[key][name]||0)+count
    }
    return result
  },
  async getWeather(){return []},
  async getWeatherImpact(){return []},
  async getModelMetrics(){return []},
  async getPipeline(){throw new Error('PIPELINE_NOT_PUBLISHED')},
}
