<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { api } from '@/api'
import BaseChart from './BaseChart.vue'
import { bars } from '@/lib/neonCharts'
import type { ModelEvaluationPayload } from '@/types/api'
const props=defineProps<{stationId:string}>()
const target=ref<'load_kw'|'idle_pile_count'>('load_kw'),payload=ref<ModelEvaluationPayload|null>(null),loading=ref(true)
onMounted(async()=>{try{payload.value=await api.getModelMetrics()}catch{payload.value=null}finally{loading.value=false}})
const unit=computed(()=>target.value==='load_kw'?'kW':'个')
const key=computed(()=>target.value==='load_kw'?'load':'free')
const items=computed(()=>payload.value?.items||[])
const e1=computed(()=>items.value.find(m=>m.experiment==='E1'&&m.targetName===target.value))
const e0=computed(()=>items.value.find(m=>m.experiment==='E0'&&m.targetName===target.value))
const block=computed(()=>payload.value?.comparison[key.value])
const stationCount=computed(()=>payload.value?.meta.stationCount??0)
const scopeLabel=computed(()=>props.stationId?props.stationId:`${stationCount.value} 站全量`)
const range=computed(()=>{const split=payload.value?.split;return split?.testStart&&split?.dataEndExclusive?`${split.testStart.slice(0,10)} 至 ${split.dataEndExclusive.slice(0,10)}`:''})
// 所有取值都做存在性保护：字段缺失时降级显示，不能让渲染抛错把面板卡在加载态
const modelMae=computed(()=>block.value?.model?.mae??null)
const baselineMae=computed(()=>block.value?.baselinePrevDay?.mae??null)
const deltaPct=computed(()=>modelMae.value===null||!baselineMae.value?null:Math.abs((modelMae.value-baselineMae.value)/baselineMae.value*100))
const score=computed(()=>props.stationId?block.value?.perStation?.find(s=>s.stationId===props.stationId):block.value?.model)
const chart=computed(()=>bars(block.value?.perHorizon?.map(h=>`${h.h}h`)||[],block.value?.perHorizon?.map(h=>h.mae)||[],unit.value,'#9a86ff'))
const weather=computed(()=>payload.value?.weatherExperiment)
const weatherBase=computed(()=>weather.value?.e1OnCommon[key.value]?.model)
const weatherModel=computed(()=>weather.value?.[key.value])
const coverageText=computed(()=>weather.value?`${Math.round(weather.value.coverageRatio*weather.value.totalHorizons)}/${weather.value.totalHorizons}`:'—')
</script>
<template><section class="evaluation-content"><div class="panel-title"><h2>模型评估</h2><div class="horizons"><button :class="{active:target==='load_kw'}" @click="target='load_kw'">负荷</button><button :class="{active:target==='idle_pile_count'}" @click="target='idle_pile_count'">空闲位</button></div></div>
<p v-if="loading">正在读取正式训练指标…</p><template v-else-if="block">
<p>测试区间 {{range}} · {{scopeLabel}} · 1—24小时综合误差 · {{payload?.mlRunId}}</p>
<div class="evaluation-scores"><div>MAE<strong>{{score?.mae.toFixed(3) ?? '—'}} <small>{{unit}}</small></strong></div><div>RMSE<strong>{{score?.rmse.toFixed(3) ?? '—'}} <small>{{unit}}</small></strong></div><div>样本量<strong>{{score?.n.toLocaleString() ?? '—'}}</strong></div></div>
<p v-if="!stationId&&baselineMae!==null&&modelMae!==null">前一日基线 MAE：{{baselineMae.toFixed(3)}} {{unit}}（{{block?.commonSampleCount?.toLocaleString()}} 同样本）；模型 MAE {{modelMae>baselineMae?'高于':'低于'}}基线 {{deltaPct?.toFixed(1)}}%。误差越低越好。</p><p v-else class="quiet-empty">{{stationId?'单站基线暂未提供，不做对比。':'前一日基线暂无对应样本，不做对比。'}}</p>
<h3>各预测步长误差 · {{stationCount}} 站</h3><BaseChart :option="chart" :height="200" aria-label="全站各预测步长MAE"/>
<h3>天气特征对照 · 相同样本 · 覆盖 {{coverageText}} 时域</h3><div v-if="weatherBase&&weatherModel" class="evaluation-scores"><div>无天气 MAE<strong>{{weatherBase.mae.toFixed(3)}}</strong></div><div>有天气 MAE<strong>{{weatherModel.mae.toFixed(3)}}</strong></div><div>对照样本<strong>{{weather?.commonSampleCount.toLocaleString()}}</strong></div></div><p v-else class="quiet-empty">天气对照数据不可用。</p><p>单位 {{unit}}。未来 {{coverageText}} 的预报已归档，其余时域没有预报特征，不得表述为全时域天气增强。</p>
<p class="evaluation-note">{{payload?.evaluationNote}}</p>
</template><p v-else>正式模型指标暂不可用。</p></section></template>
