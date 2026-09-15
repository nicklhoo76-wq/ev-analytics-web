import type { PredictionData, StationStatus } from '@/types/api'
export interface OrderSummary { asOf:string; windowHours:number; total:number; statuses:Record<string,number>; types:Record<string,number> }
export interface LoadAlert {stationId:string;stationName:string;start:string;end:string;peakKw:number;thresholdKw:number;peakRatio:number}
export function buildAlerts(stations:StationStatus[], forecasts:Record<string,PredictionData|null>, percent:number):LoadAlert[]{
 const alerts:LoadAlert[]=[];
 for(const station of stations){
  if(station.installedCapacityKw<=0)continue;
  const thresholdKw=station.installedCapacityKw*percent/100;
  let active:LoadAlert|null=null;
  for(const point of forecasts[station.stationId]?.points || []){
   if(point.predictedLoadKw!==null && point.predictedLoadKw>thresholdKw){
    if(active && active.end===point.intervalStart){ active.end=point.intervalEnd;active.peakKw=Math.max(active.peakKw,point.predictedLoadKw);active.peakRatio=active.peakKw/station.installedCapacityKw; }
    else { active={stationId:station.stationId,stationName:station.stationName,start:point.intervalStart,end:point.intervalEnd,peakKw:point.predictedLoadKw,thresholdKw,peakRatio:point.predictedLoadKw/station.installedCapacityKw};alerts.push(active); }
   }else active=null;
  }
 }
 return alerts.sort((a,b)=>b.peakRatio-a.peakRatio || Date.parse(a.start)-Date.parse(b.start));
}
export const statusNames:Record<string,string>={created:'未计费',billed:'待支付',paid:'已支付',refund_requested:'退款审核',refund_approved:'已退款',waiver_requested:'免单审核',waiver_approved:'已免单'};
export const typeNames:Record<string,string>={'BJS-TOU-VALLEY':'谷时电价','BJS-TOU-FLAT':'平时电价','BJS-TOU-PEAK':'峰时电价'};
