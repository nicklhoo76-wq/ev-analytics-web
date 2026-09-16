<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Activity, ArrowUpRight, Expand, LocateFixed, Moon, Pause, Play, RotateCcw, Sun, X, Zap } from 'lucide-vue-next'
import BaseChart from '@/components/BaseChart.vue'
import ModelEvaluation from '@/components/ModelEvaluation.vue'
import StationMap from '@/components/StationMap.vue'
import AvailabilityPanel from '@/components/AvailabilityPanel.vue'
import ChargingWindow from '@/components/ChargingWindow.vue'
import OrderPanel from '@/components/OrderPanel.vue'
import AnimatedValue from '@/components/AnimatedValue.vue'
import { useDashboardStore } from '@/stores/dashboard'
import { useNetworkData } from '@/stores/useNetworkData'
import { bars, freeComparison, heat, hour, palette, setChartTheme, stationAxisLabel, trend } from '@/lib/neonCharts'
import { buildAlerts } from '@/lib/operations'
import type { PredictionData, StationStatus } from '@/types/api'

const store=useDashboardStore(),route=useRoute()
const admin=computed(()=>route.meta.role!=='user')
const {snapshot,current,loading,error,refresh:load}=useNetworkData()
const stations=computed(()=>snapshot.value?.stations || [])
const context=computed(()=>snapshot.value?.context)
const overview=computed(()=>current.value?.overview)
const horizon=ref<1|6|24>(24),orderWindow=ref<24|168>(24)
const prediction=computed(()=>{const p=current.value?.prediction;return p?{...p,hours:horizon.value,points:p.points.slice(0,horizon.value)}:null})
const history=computed(()=>current.value?.history||null),energy=computed(()=>current.value?.energy||null)
const selected=computed(()=>stations.value.find(s=>s.stationId===store.state.stationId))
const scope=computed(()=>selected.value?[selected.value]:stations.value)
const sum=(key:'idlePiles'|'usingPiles'|'reservedPiles'|'faultPiles'|'unknownPiles'|'pileTotal'|'loadKw'|'installedCapacityKw')=>scope.value.reduce((a,s)=>a+s[key],0)
const capacity=computed(()=>sum('installedCapacityKw')),loadKw=computed(()=>sum('loadKw')),total=computed(()=>sum('pileTotal')),idle=computed(()=>sum('idlePiles'))
const useRate=computed(()=>total.value?Math.round(sum('usingPiles')/total.value*100):0)
const stationLabel=(s:StationStatus)=>`${s.stationId.slice(-3)}站 · ${s.district.trim()}`
const select=(id:string)=>store.setStation(id)
const ranked=computed(()=>[...stations.value].sort((a,b)=>admin.value?b.loadKw-a.loadKw:b.idlePiles/Math.max(1,b.pileTotal)-a.idlePiles/Math.max(1,a.pileTotal)))
const best=computed(()=>prediction.value?.points.filter(p=>p.predictedFreePiles!==null).reduce<PredictionData['points'][number]|null>((a,p)=>!a||p.predictedFreePiles!>a.predictedFreePiles!?p:a,null))
const peak=computed(()=>prediction.value?.points.some(p=>p.predictedLoadKw!==null)?Math.max(...prediction.value.points.map(p=>p.predictedLoadKw??0)):null)
const recommendations=computed(()=>[...(prediction.value?.points||[])].filter(p=>p.predictedFreePiles!==null).sort((a,b)=>b.predictedFreePiles!-a.predictedFreePiles!).slice(0,4))
// 预测空闲曲线几乎不动时，"推荐时点"没有区分度，必须如实说明而不是给出任意排名
const freeAmplitude=computed(()=>{const values=(prediction.value?.points||[]).map(p=>p.predictedFreePiles).filter((v):v is number=>v!==null);return values.length?Math.max(...values)-Math.min(...values):0})
const forecastFlat=computed(()=>(prediction.value?.points.length||0)>1&&freeAmplitude.value<2)
const bestLabel=computed(()=>forecastFlat.value?'多个时点并列':(best.value?hour(best.value.intervalEnd):'—'))
const metrics=computed(()=>admin.value?[
 {label:'覆盖站点',value:scope.value.length,unit:'座',sub:`${total.value} 个充电位`},
 {label:store.dataMode==='mock'?'当前负荷':'最近完整小时负荷',value:loadKw.value.toFixed(1),unit:'kW',sub:`装机 ${capacity.value} kW`},
 {label:'今日充电量',value:overview.value?.todayEnergyKwh?.toFixed(1)??'—',unit:'kWh',sub:'截至所选时点'},
 {label:'当前空闲',value:idle.value,unit:'个',sub:`${useRate.value}% 正在充电`},
 {label:'今日净营收',value:overview.value?.todayNetRevenueYuan?.toFixed(1)??'—',unit:'元',sub:'当日净额'},
]:[
 {label:'可用充电位',value:idle.value,unit:'个',sub:`共 ${total.value} 个充电位`},
 {label:'有空闲位的站点',value:scope.value.filter(s=>s.idlePiles>0).length,unit:'座',sub:`覆盖 ${scope.value.length} 座站点`},
 {label:'推荐充电时点',value:bestLabel.value,unit:'',sub:forecastFlat.value?`各时点预计空闲差异不足 2 个（${freeAmplitude.value} 个）`:'预计空闲数量最多'},
 {label:'预计空闲峰值',value:best.value?.predictedFreePiles??'—',unit:'个',sub:`未来 ${horizon.value} 小时`},
])
let savedThreshold=80
try{const value=Number(localStorage.getItem('ev-load-threshold'));if(value>=10&&value<=100)savedThreshold=value}catch{}
const threshold=ref(savedThreshold)
watch(threshold,value=>{try{localStorage.setItem('ev-load-threshold',String(value))}catch{}})
const thresholdKw=computed(()=>capacity.value*threshold.value/100)
const forecasts=computed(()=>Object.fromEntries(stations.value.map(s=>{const p=snapshot.value?.bundles[s.stationId]?.prediction;return [s.stationId,p?{...p,hours:horizon.value,points:p.points.slice(0,horizon.value)}:null]})))
const alerts=computed(()=>buildAlerts(scope.value,forecasts.value,threshold.value))
const forecastCoverage=computed(()=>scope.value.filter(s=>forecasts.value[s.stationId]?.points.some(p=>p.predictedLoadKw!==null)).length)
const userComparison=computed(()=>{theme.value;return freeComparison(scope.value,scope.value.map(s=>forecasts.value[s.stationId]?.points.at(-1)?.predictedFreePiles??null),horizon.value)})
// 全网阈值是"全部站点装机之和"，量级远高于实际负荷；此时画阈值线会把曲线压平，故只在同量级时绘制。
const loadDataMax=computed(()=>Math.max(0,...(history.value?.points||[]).map(p=>p.value??0),...(prediction.value?.points||[]).map(p=>p.predictedLoadKw??0)))
const thresholdInScale=computed(()=>capacity.value>0&&thresholdKw.value>0&&thresholdKw.value<=loadDataMax.value*3)
const loadChart=computed(()=>{theme.value;return trend(history.value,prediction.value,thresholdInScale.value?thresholdKw.value:undefined)})
const idleChart=computed(()=>{theme.value;return bars((prediction.value?.points||[]).map(p=>hour(p.intervalEnd)),(prediction.value?.points||[]).map(p=>p.predictedFreePiles),'个')})
// 热力图按站号排序，方便和可用性面板、下拉框里的编号一一对照。
// ECharts 类目纵轴把数组第一项画在最下方，因此反向传入，让 001 在最上方、014 在最下方。
const heatStations=computed(()=>[...stations.value].sort((a,b)=>a.stationId.localeCompare(b.stationId)).reverse())
const heatChart=computed(()=>{theme.value;return heat(heatStations.value,heatStations.value.map(s=>snapshot.value!.bundles[s.stationId].history))})
const energyChart=computed(()=>{theme.value;return bars(energy.value?.points.map(p=>hour(p.time))||[],energy.value?.points.map(p=>p.value)||[],'kWh','#9a86ff')})
const comparison=computed(()=>{theme.value;return bars(stations.value.map(stationAxisLabel),stations.value.map(s=>s.pileTotal?Math.round(s.idlePiles/s.pileTotal*100):null),'%','#9a86ff')})
const paused=ref(window.matchMedia('(prefers-reduced-motion: reduce)').matches)
const savedTheme=localStorage.getItem('ev-ui-theme')
const theme=ref<'light'|'dark'>(savedTheme==='dark'?'dark':'light')
watch(theme,value=>localStorage.setItem('ev-ui-theme',value))
watch(theme,value=>setChartTheme(value),{immediate:true})
const detail=ref(false),evaluation=ref(false)
let restoreFocus:HTMLElement|null=null
watch(detail,async open=>{if(open){restoreFocus=document.activeElement as HTMLElement;await nextTick();document.querySelector<HTMLButtonElement>('.drawer button')?.focus()}else restoreFocus?.focus()})
function trapFocus(e:KeyboardEvent){if(e.key==='Escape'){detail.value=false;return}if(e.key!=='Tab')return;const buttons=Array.from(document.querySelectorAll<HTMLButtonElement>('.drawer button'));const first=buttons[0],last=buttons.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus()}}
function pointer(event:MouseEvent){const el=event.currentTarget as HTMLElement,r=el.getBoundingClientRect();el.style.setProperty('--px',`${event.clientX-r.left}px`);el.style.setProperty('--py',`${event.clientY-r.top}px`)}
async function fullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen()}catch{error.value='当前浏览器不支持全屏显示。'}}
const fullTime=(value:string)=>{const d=new Date(value);return Number.isNaN(d.getTime())?'—':new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(d)}
</script>

<template>
 <div class="nexus" :class="{paused,passenger:!admin,'theme-light':theme==='light','theme-dark':theme==='dark'}" @mousemove="pointer">
  <div class="ambient" aria-hidden="true"></div>
  <header class="masthead">
   <a class="identity" href="#" @click.prevent="select('')"><span class="logo"><Zap :size="25"/></span><span><strong>充能脉络</strong><small>城市能源 · 洞见每一刻</small></span></a>
   <nav class="role-tabs" aria-label="展示视角"><RouterLink to="/admin/overview" :class="{active:admin}">全域态势<span>运营视角</span></RouterLink><RouterLink to="/user/overview" :class="{active:!admin}">充电时空<span>出行视角</span></RouterLink></nav>
   <div class="head-actions"><span class="city"><LocateFixed :size="14"/>北京</span><button @click="theme=theme==='light'?'dark':'light'" :aria-label="theme==='light'?'切换深色主题':'切换浅色主题'"><Moon v-if="theme==='light'" :size="16"/><Sun v-else :size="16"/></button><button @click="paused=!paused" :aria-label="paused?'播放动态效果':'暂停动态效果'"><Play v-if="paused" :size="16"/><Pause v-else :size="16"/></button><button @click="fullscreen" aria-label="切换全屏"><Expand :size="17"/></button></div>
  </header>
  <div class="toolbar"><div class="view-heading"><i></i><h1>{{admin?'城市充电网络，全景洞察':'让下一次充电，恰逢其时'}}</h1></div><div class="filters"><button v-if="admin" class="evaluation-open" @click="evaluation=true;detail=true">模型评估</button><label>数据时点<select v-model="store.state.asOf"><option v-for="time in context?.availableAsOf||[store.state.asOf]" :key="time" :value="time">{{time.slice(0,10)}} {{hour(time)}}</option></select></label><label>站点<select v-model="store.state.stationId"><option value="">全部站点</option><option v-for="s in stations" :key="s.stationId" :value="s.stationId">{{stationLabel(s)}}</option></select></label><button @click="load" aria-label="刷新数据"><RotateCcw :size="14" :class="{spinning:loading}"/></button></div></div>
  <nav class="station-switcher" aria-label="站点快速切换"><button :class="{active:!store.state.stationId}" :aria-pressed="!store.state.stationId" @click="select('')">全网站点</button><span class="switch-divider"></span><button v-for="s in stations" :key="s.stationId" :class="{active:store.state.stationId===s.stationId}" :aria-pressed="store.state.stationId===s.stationId" @click="select(s.stationId)">{{stationLabel(s)}}</button><small v-if="loading" role="status">更新中</small></nav>
  <div v-if="error" class="error-message" role="alert">{{error}}<button @click="load">重试</button></div>
  <section class="numbers" :class="{'four-metrics':!admin}" aria-label="核心指标"><article v-for="(m,i) in metrics" :key="m.label" :style="{'--accent':palette[i%palette.length]}"><span>{{m.label}}</span><div><strong><AnimatedValue :value="m.value"/></strong><em>{{m.unit}}</em></div><small><i></i>{{m.sub}}</small></article></section>
  <main class="command-grid" :aria-busy="loading">
   <OrderPanel v-if="admin" :summary="current?.orders[orderWindow]?.summary||null" :failed="!current||current.orders[orderWindow]?.failed===true" :window-hours="orderWindow" @window="orderWindow=$event"/>
   <section class="visual-core">
    <div class="core-top"><span><Activity :size="14"/>{{admin?'北京 · 站点空间分布':'未来 · 充电窗口'}}</span><span>{{selected?stationLabel(selected):'全网站点'}}<button v-if="selected" class="back-global" @click="select('')">返回全网</button></span></div>
    <StationMap v-if="admin" :stations="stations" :selected-id="store.state.stationId" :mock="store.dataMode==='mock'" :theme="theme" @select="select"/>
    <ChargingWindow v-else :prediction="prediction" :flat="forecastFlat"/>
   </section>
   <section class="glass forecast-panel"><div class="panel-title"><h2>{{admin?'负荷趋势与预测':'当前与未来空闲对比'}}</h2><div class="horizons"><button v-for="h in ([1,6,24] as const)" :key="h" :class="{active:horizon===h}" @click="horizon=h">{{h}}h</button></div></div><label v-if="admin" class="threshold-control">预警阈值<input v-model.number="threshold" type="range" min="10" max="100" step="5" aria-label="负荷预警阈值"/><b>{{threshold}}%</b><small>装机容量</small></label><BaseChart :option="admin?loadChart:userComparison" :height="191" :aria-label="admin?'历史及未来负荷走势与预警阈值':'站点当前与未来空闲数量对比'"/><div class="chart-summary"><span v-if="admin">预计峰值 <b>{{peak?.toFixed(1)??'—'}} <small>kW</small></b></span><span v-else>当前与 {{horizon}}h 后的预计数量</span><span>推荐时点 <b>{{bestLabel}}</b></span></div><div v-if="forecastFlat" class="chart-note">该时域预测空闲变化仅 {{freeAmplitude}} 个，各时点几乎并列，推荐不具备区分度。</div><div v-if="admin&&capacity>0&&!thresholdInScale" class="chart-note">全网阈值 {{thresholdKw.toFixed(0)}} kW 远高于当前负荷，图中暂不绘制阈值线；预警按站点单独判定。</div><div v-if="!prediction&&!admin" class="quiet-empty">暂无该时段预测</div></section>
   <section class="glass ranking-panel"><div class="panel-title"><h2>{{admin?'站点负荷排行':'推荐充电站点'}}</h2><span>{{admin?'kW':'按空闲比例排序'}}</span></div><button v-for="(s,i) in ranked.slice(0,5)" :key="s.stationId" class="rank" :class="{selected:store.state.stationId===s.stationId}" @click="select(s.stationId)"><em>{{String(i+1).padStart(2,'0')}}</em><span><b>{{stationLabel(s)}}</b><i><i :style="{width:`${admin?s.loadKw/Math.max(1,...stations.map(s=>s.loadKw))*100:s.idlePiles/Math.max(1,s.pileTotal)*100}%`}"></i></i></span><strong>{{admin?Number(s.loadKw.toFixed(1)):`${s.idlePiles}/${s.pileTotal}`}}</strong></button><button class="text-action" @click="evaluation=false;detail=true">查看全部站点 <ArrowUpRight :size="14"/></button></section>
   <section v-if="admin" class="glass heat-panel"><div class="panel-title"><h2>站点 × 小时负荷热力</h2><span>按站号排列 · 001 → 014</span></div><BaseChart :option="heatChart" :height="211" aria-label="各站点小时负荷热力图"/></section>
   <section v-if="admin" class="glass idle-panel"><div class="panel-title"><h2>未来空闲充电位</h2><span>小时末可用数量</span></div><BaseChart :option="idleChart" :height="190" aria-label="未来每小时末空闲充电位数量"/><div v-if="!prediction" class="quiet-empty">暂无该时段预测</div></section>
   <section class="glass bottom-energy"><div class="panel-title"><h2>{{admin?'小时充电量':'站点空闲比例对比'}}</h2><span>{{admin?'近24小时':'当前空闲 / 总数'}}</span></div><BaseChart :option="admin?energyChart:comparison" :height="165" :aria-label="admin?'过去24小时充电量':'各站点当前空闲比例'"/></section>
   <AvailabilityPanel :stations="stations" :selected-id="store.state.stationId" :admin="admin" :theme="theme" @select="select"/>
   <section v-if="admin" class="glass bottom-weather alert-window"><div class="panel-title"><h2>负荷预警</h2><span>{{alerts.length}} 条 · 站点阈值 {{threshold}}%</span></div><div class="load-alerts"><button v-for="a in alerts" :key="a.stationId+a.start" @click="select(a.stationId)"><i></i><span><b>{{stationLabel(stations.find(s=>s.stationId===a.stationId)!)}}</b><small>预计 {{fullTime(a.start)}}—{{fullTime(a.end)}} 超过阈值，请关注</small><em>峰值 {{a.peakKw.toFixed(1)}} kW / 阈值 {{a.thresholdKw.toFixed(1)}} kW</em></span><ArrowUpRight :size="14"/></button><p v-if="!alerts.length" class="quiet-empty">{{forecastCoverage?'当前可用预测范围内暂无超限':'暂无可用预测，无法判断预警'}}</p></div><small class="alert-coverage">预测覆盖 {{forecastCoverage}} / {{scope.length}} 站 · 未来 {{horizon}} 小时</small></section>
   <section v-else class="glass bottom-weather time-suggestions"><div class="panel-title"><h2>推荐时段</h2><span>按预计空闲数量排序</span></div><p v-if="forecastFlat" class="chart-note">预测空闲曲线几乎平坦（最大最小差 {{freeAmplitude}} 个），下列排序不代表真正的繁忙差异。</p><div v-for="(p,i) in recommendations" :key="p.intervalEnd" class="time-suggestion"><span>{{String(i+1).padStart(2,'0')}}</span><b>{{fullTime(p.intervalEnd)}}</b><strong>{{p.predictedFreePiles}} <small>个空闲位</small></strong></div><p v-if="!recommendations.length" class="quiet-empty">暂无该时段推荐</p></section>
  </main>
  <footer><span><i></i>{{selected?stationLabel(selected):'北京充电网络'}}<button v-if="selected" @click="select('')">恢复全网</button></span><span>{{(context?.meta.asOf||store.state.asOf).slice(0,10)}} / {{hour(context?.meta.asOf||store.state.asOf)}}<b>充能脉络</b></span></footer>
  <div v-if="detail" class="drawer-backdrop" @click.self="detail=false" @keydown="trapFocus"><section class="drawer" role="dialog" aria-modal="true" :aria-label="evaluation?'模型评估':'站点详情'"><div class="panel-title"><h2>{{evaluation?'预测表现':'站点全景'}}</h2><button @click="detail=false" aria-label="关闭站点详情"><X/></button></div><ModelEvaluation v-if="evaluation" :station-id="store.state.stationId"/><template v-else><p>选择站点，联动查看{{admin?'负荷与可用性':'空闲数量与推荐时间'}}。</p><button class="drawer-row" @click="select('');detail=false">全网站点</button><button v-for="s in ranked" :key="s.stationId" class="drawer-row" @click="select(s.stationId);detail=false"><span>{{stationLabel(s)}}<small>{{s.stationId}}</small></span><b>{{s.idlePiles}} / {{s.pileTotal}} 空闲</b><span v-if="admin">{{s.loadKw.toFixed(1)}} kW</span></button></template></section></div>
 </div>
</template>
