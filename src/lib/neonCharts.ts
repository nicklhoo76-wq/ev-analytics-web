import type { EChartsOption } from 'echarts'
import type { MetricSeries, PredictionData, StationStatus, WeatherImpactGroup } from '@/types/api'
export const palette = ['#55e6ee', '#9a86ff', '#ffa96a', '#f56f98', '#536985']
// api 模式下 asOf 在首次响应前为空，直接格式化会抛 RangeError
const safeDate = (v?: string | null): Date | null => {
  if (!v) return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}
const hhmm = new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', hour12: false })
export const hour = (v: string) => { const d = safeDate(v); return d ? hhmm.format(d) : '—' }
// 14 个站点只落在 10 个区县（海淀/朝阳/丰台/石景山各 2 站），
// 因此任何以区县开头的标签都会出现重复词。站号才是唯一标识，全部以站号为主。
export const stationNumber = (s: { stationId: string }) => s.stationId.slice(-3)
export const stationAxisLabel = (s: { stationId: string; district: string }) =>
  `${stationNumber(s)} ${s.district.trim().replace(/区$/, '')}`
const axis = { axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: '#8b9cbd', fontSize: 10 }, splitLine: { lineStyle: { color: '#203048', type: 'dashed' as const } } }
const base: EChartsOption = { color: palette, backgroundColor: 'transparent', textStyle: { color: '#90a4c4', fontFamily: 'Microsoft YaHei UI, sans-serif' }, grid: { top: 32, bottom: 22, left: 40, right: 12 }, tooltip: { trigger: 'axis', backgroundColor: '#122139', borderColor: '#395577', textStyle: { color: '#e8f4ff' } }, animationDuration: 650 }
export function trend(history: MetricSeries | null, forecast: PredictionData | null, thresholdKw?:number): EChartsOption {
 const past = history?.points || []; const next = forecast?.points || []
 return { ...base, legend: { right: 0, top: 0, textStyle: { color: '#91a4c6', fontSize: 10 } }, xAxis: { ...axis, type: 'category', boundaryGap: false, data: [...past.map(p => hour(p.time)), ...next.map(p => hour(p.intervalStart))] }, yAxis: { ...axis, type: 'value', name: 'kW', min:0, max:thresholdKw===undefined?undefined:({max}: {max:number})=>Math.ceil(Math.max(max,thresholdKw)*1.08/50)*50, splitNumber: 3, nameTextStyle: { color: '#8095b7' } }, series: [
 { name: '历史负荷', type: 'line', smooth: .25, showSymbol: false, data: [...past.map(p => p.value), ...next.map(() => null)], lineStyle: { width: 2.5 }, areaStyle: { color: '#55e6ee', opacity: .08 } },
 { name: '未来预测', type: 'line', markLine: {silent:true, symbol:'none', label:{formatter:'预警阈值 {c} kW',color:'#ffa96a',fontSize:9,position:'insideEndTop'},lineStyle:{color:'#ffa96a',type:'dashed',width:1.5},data:thresholdKw!==undefined?[{yAxis:Number(thresholdKw.toFixed(1))}]:[]}, smooth: .25, showSymbol: next.length === 1, data: [...past.map(() => null), ...next.map(p => p.predictedLoadKw)], lineStyle: { type: 'dashed', width: 2.5 }, areaStyle: { opacity: .07 } },
 ] }
}
export function ring(stations: StationStatus[]): EChartsOption {
 const keys = ['idlePiles','usingPiles','reservedPiles','faultPiles','unknownPiles'] as const
 return { ...base, tooltip: { trigger: 'item', formatter: '{b}：{c} 个 ({d}%)' }, series: [{ type: 'pie', radius: ['65%','87%'], center: ['50%','50%'], label: { show: false }, itemStyle: { borderRadius: 5, borderColor: '#101c32', borderWidth: 3 }, data: keys.map((k,i) => ({ name: ['空闲','充电','预约','故障','未知'][i], value: stations.reduce((sum,s) => sum+s[k],0) })) }] }
}
export function bars(labels: string[], values: (number|null)[], unit: string, color = palette[0]): EChartsOption {
 return { ...base, color: [color], grid: {...base.grid as object, bottom:unit==='%'?38:22}, xAxis: { ...axis, type: 'category', data: labels, ...(unit==='%'?{axisLabel:{...axis.axisLabel,interval:0,rotate:30,fontSize:9}}:{}) }, yAxis: { ...axis, type: 'value', name: unit, min:0, max:unit==='%'?100:undefined, splitNumber: 3, minInterval: unit === '个' ? 1 : undefined }, series: [{ type: 'bar', barMaxWidth: 16, data: values, itemStyle: { borderRadius: [4,4,0,0] } }] }
}
export function freeComparison(stations:StationStatus[],future:(number|null)[],hours:number):EChartsOption {
 return {...base, grid:{top:35,bottom:38,left:32,right:10},legend:{top:0,right:0,textStyle:{color:'#91a4c6',fontSize:10}},xAxis:{...axis,type:'category',data:stations.map(stationAxisLabel),axisLabel:{...axis.axisLabel,interval:0,rotate:25,fontSize:9}},yAxis:{...axis,type:'value',name:'个',min:0,minInterval:1,splitNumber:3},series:[{id:'free-now',name:'当前空闲',type:'bar',data:stations.map(s=>s.idlePiles),barMaxWidth:13,itemStyle:{borderRadius:[3,3,0,0]}},{id:'free-future',name:`${hours}h后预计`,type:'bar',data:future,barMaxWidth:13,itemStyle:{borderRadius:[3,3,0,0]}}]}
}
export function heat(stations: StationStatus[], rows: MetricSeries[]): EChartsOption {
 return { ...base, tooltip: { trigger:'item', renderMode:'richText', confine:true, backgroundColor:'#122139', borderColor:'#395577', textStyle:{color:'#e8f4ff'}, formatter: (params:unknown)=>{ const p=params as {value:number[]};const [x,y,value]=p.value;const station=stations[y];const time=rows[y]?.points[x]?.time;return [(station?.district||'').trim(),station?.stationName || '',station?.stationId || '', time ? new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(time))+' 起1小时' : '', '平均负荷 '+value.toFixed(2)+' kW'].join('\n') } }, axisPointer:{show:false}, grid: { left: 67, right: 8, top: 6, bottom: 22 }, xAxis: { ...axis, type: 'category', splitLine: { show: false }, data: (rows[0]?.points || []).map(p => hour(p.time)), axisLabel: { color: '#8b9cbd', fontSize: 9, interval: 5 } }, yAxis: { ...axis, type: 'category', splitLine: { show: false }, data: stations.map(stationAxisLabel), axisLabel: { color: '#8b9cbd', fontSize: 9, interval: 0 } }, visualMap: { show: false, min: 0, max: Math.max(1,...rows.flatMap(r => r.points.map(p=>p.value ?? 0))), inRange: { color: ['#162439','#284465','#367f9d','#55e6ee'] } }, series: [{ type: 'heatmap', data: rows.flatMap((r,y)=>r.points.flatMap((p,x)=>p.value == null ? [] : [[x,y,p.value]])), itemStyle: { borderWidth: 3, borderColor: '#0e192c', borderRadius: 3 }, emphasis: { focus:'none', itemStyle: { borderColor: '#c8f8ff',borderWidth:2 } } }] }
}
export function weather(groups: WeatherImpactGroup[]): EChartsOption { return bars(groups.map(g=>g.label),groups.map(g=>g.avgLoadKw),'kW',palette[1]) }
