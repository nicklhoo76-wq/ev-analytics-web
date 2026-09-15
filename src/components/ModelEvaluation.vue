<script setup lang="ts">
import { computed, ref } from 'vue'
import report from '@/data/member3-metrics.json'
import BaseChart from './BaseChart.vue'
import { bars } from '@/lib/neonCharts'
const props=defineProps<{stationId:string}>()
const target=ref<'load'|'free'>('load')
const unit=computed(()=>target.value==='load'?'kW':'个')
const group=computed(()=>report[target.value])
const score=computed(()=>props.stationId ? group.value.per_station.find(s=>s.station_id===props.stationId) : group.value.model)
const chart=computed(()=>bars(group.value.per_horizon.map(h=>`${h.h}h`),group.value.per_horizon.map(h=>h.mae),unit.value,'#9a86ff'))
const e2=computed(()=>report.e2[target.value].model)
const e1=computed(()=>report.e2.e1_on_common[target.value].model)
</script>
<template><section class="evaluation-content"><div class="panel-title"><h2>模型评估</h2><div class="horizons"><button :class="{active:target==='load'}" @click="target='load'">负荷</button><button :class="{active:target==='free'}" @click="target='free'">空闲位</button></div></div>
<p>测试区间 2023-04-25 至 04-30 · {{stationId || '全部站点样本'}} · 1—24小时综合误差</p>
<div class="evaluation-scores"><div>MAE<strong>{{score?.mae.toFixed(3) ?? '—'}} <small>{{unit}}</small></strong></div><div>RMSE<strong>{{score?.rmse.toFixed(3) ?? '—'}} <small>{{unit}}</small></strong></div><div>样本量<strong>{{score?.n.toLocaleString() ?? '—'}}</strong></div></div>
<template v-if="!stationId"><p>前一日基线 MAE：{{group.baseline_prev_day.mae.toFixed(3)}} {{unit}}；模型 MAE {{group.model.mae>group.baseline_prev_day.mae?'高于':'低于'}}基线。误差越低越好。</p></template>
<p v-else>单站基线与单站×时域交叉评估尚未提供。</p>
<h3>各预测步长误差 · 全部站点</h3><BaseChart :option="chart" :height="200" aria-label="全站各预测步长MAE"/>
<h3>天气特征对照 · 相同样本 · 仅未来1小时</h3><div class="evaluation-scores"><div>无天气 MAE<strong>{{e1.mae.toFixed(3)}}</strong></div><div>有天气 MAE<strong>{{e2.mae.toFixed(3)}}</strong></div><div>对照样本<strong>{{e2.n.toLocaleString()}}</strong></div></div><p>以上天气对照为全站结果，单位 {{unit}}，不能外推为未来6/24小时效果。误差使用约束前的原始预测计算。</p>
</section></template>
