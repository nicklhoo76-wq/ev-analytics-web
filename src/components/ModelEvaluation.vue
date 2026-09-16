<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { api } from '@/api'
import BaseChart from './BaseChart.vue'
import { bars } from '@/lib/neonCharts'
import type { ModelMetric } from '@/types/api'
const props=defineProps<{stationId:string}>()
const target=ref<'load_kw'|'idle_pile_count'>('load_kw'),metrics=ref<ModelMetric[]>([]),loading=ref(true)
onMounted(async()=>{try{metrics.value=await api.getModelMetrics()}finally{loading.value=false}})
const unit=computed(()=>target.value==='load_kw'?'kW':'个')
const e1=computed(()=>metrics.value.find(m=>m.experiment==='E1'&&m.targetName===target.value))
const e0=computed(()=>metrics.value.find(m=>m.experiment==='E0'&&m.targetName===target.value))
const e2=computed(()=>metrics.value.find(m=>m.experiment==='E2'&&m.targetName===target.value))
const score=computed(()=>props.stationId?e1.value?.perStation.find(s=>s.stationId===props.stationId):e1.value?{mae:e1.value.mae,rmse:e1.value.rmse,n:e1.value.sampleCount}:undefined)
const chart=computed(()=>bars(e1.value?.perHorizon.map(h=>`${h.h}h`)||[],e1.value?.perHorizon.map(h=>h.mae)||[],unit.value,'#9a86ff'))
</script>
<template><section class="evaluation-content"><div class="panel-title"><h2>模型评估</h2><div class="horizons"><button :class="{active:target==='load_kw'}" @click="target='load_kw'">负荷</button><button :class="{active:target==='idle_pile_count'}" @click="target='idle_pile_count'">空闲位</button></div></div>
<p v-if="loading">正在读取正式训练指标…</p><template v-else-if="e1">
<p>测试区间 2023-09-01 至 10-01 · {{stationId || '14站全量'}} · 1—24小时综合误差</p>
<div class="evaluation-scores"><div>MAE<strong>{{score?.mae.toFixed(3) ?? '—'}} <small>{{unit}}</small></strong></div><div>RMSE<strong>{{score?.rmse.toFixed(3) ?? '—'}} <small>{{unit}}</small></strong></div><div>样本量<strong>{{score?.n.toLocaleString() ?? '—'}}</strong></div></div>
<p v-if="!stationId&&e0">前一日基线 MAE：{{e0.mae.toFixed(3)}} {{unit}}；模型 MAE {{e1.mae>e0.mae?'高于':'低于'}}基线。误差越低越好。</p><p v-else>单站基线与单站×时域交叉评估尚未提供。</p>
<h3>各预测步长误差 · 14站</h3><BaseChart :option="chart" :height="200" aria-label="全站各预测步长MAE"/>
<h3>天气特征对照 · 相同样本 · 仅未来1小时</h3><div class="evaluation-scores"><div>无天气 MAE<strong>{{e1.perHorizon[0]?.mae.toFixed(3)}}</strong></div><div>有天气 MAE<strong>{{e2?.mae.toFixed(3)??'—'}}</strong></div><div>对照样本<strong>{{e2?.sampleCount.toLocaleString()??'—'}}</strong></div></div><p>天气特征覆盖 1/24，只说明未来1小时的同样本对照结果，单位 {{unit}}。</p>
</template><p v-else>正式模型指标暂不可用。</p></section></template>
