import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { api } from '@/api'
import { useDashboardStore } from './dashboard'
import type { DashboardContext, MetricSeries, OverviewData, PredictionData, StationStatus } from '@/types/api'
import type { OrderSummary } from '@/lib/operations'
interface StationBundle { overview:OverviewData; history:MetricSeries; energy:MetricSeries; prediction:PredictionData|null; orders:Record<number,OrderSummary|null> }
interface NetworkSnapshot { context:DashboardContext; stations:StationStatus[]; bundles:Record<string,StationBundle> }
export function useNetworkData(){
 const store=useDashboardStore();const snapshot=shallowRef<NetworkSnapshot|null>(null)
 const loading=ref(false),error=ref('');let sequence=0
 const current=computed(()=>snapshot.value?.bundles[store.state.stationId] || snapshot.value?.bundles[''])
 async function refresh(){
  const token=++sequence,time=store.state.asOf;loading.value=true;error.value=''
  try{
   const [context,stations]=await Promise.all([api.getContext(time),api.getStations(time)])
   const entries=await Promise.all(['',...stations.map(s=>s.stationId)].map(async id=>{
    const [overview,history,energy,prediction,day,week]=await Promise.all([
     api.getOverview(time,id),api.getSeries('load',time,id),api.getSeries('energy',time,id),api.getPrediction(24,time,id),
     api.getOrders(time,24,id).catch(()=>null),api.getOrders(time,168,id).catch(()=>null),
    ])
    return [id,{overview,history,energy,prediction,orders:{24:day,168:week}}] as const
   }))
   if(token!==sequence)return
   snapshot.value={context,stations,bundles:Object.fromEntries(entries)}
   if(store.state.stationId && !snapshot.value.bundles[store.state.stationId])store.setStation('')
  }catch{if(token===sequence)error.value='暂时无法更新数据，当前保留上次成功结果。'}
  finally{if(token===sequence)loading.value=false}
 }
 watch(()=>store.state.asOf,refresh,{immediate:true})
 onBeforeUnmount(()=>sequence++)
 return {snapshot,current,loading,error,refresh}
}
