<script setup lang="ts">
import { computed } from 'vue'
import BaseChart from './BaseChart.vue'
import { palette } from '@/lib/neonCharts'
import { statusNames,typeNames,type OrderSummary } from '@/lib/operations'
import type { EChartsOption } from 'echarts'
const props=defineProps<{summary:OrderSummary|null;windowHours:24|168;failed?:boolean}>()
defineEmits<{window:[hours:24|168]}>()
const states=computed(()=>Object.entries(props.summary?.statuses||{}))
const option=computed<EChartsOption>(()=>({color:palette,tooltip:{trigger:'item',backgroundColor:'#FFFFFF',borderColor:'#DCE7EF',textStyle:{color:'#18324D'},formatter:'{b}：{c} 单'},series:[{id:'order-status',type:'pie',radius:['60%','88%'],label:{show:false},itemStyle:{borderWidth:2,borderColor:'#FFFFFF'},data:states.value.map(([key,value])=>({name:statusNames[key]||key,value}))}]}))
</script>
<template><section class="glass state-panel order-panel"><div class="panel-title"><h2>订单概览</h2><div class="horizons"><button :class="{active:windowHours===24}" @click="$emit('window',24)">24h</button><button :class="{active:windowHours===168}" @click="$emit('window',168)">7天</button></div></div><template v-if="summary"><div class="order-layout"><div class="order-ring"><BaseChart :option="option" :height="145" aria-label="订单状态构成"/><div><strong>{{summary.total}}</strong><small>窗口内新建订单</small></div></div><div class="order-status-list"><span v-for="([key,value],i) in states" :key="key"><i :style="{background:palette[i%palette.length]}"></i>{{statusNames[key]||key}}<b>{{value}}</b></span><span v-if="!states.length">暂无订单</span></div></div><div class="order-types"><span v-for="(value,key) in summary.types" :key="key">{{typeNames[key]||key}} <b>{{value}}</b></span></div><small class="order-note">按窗口内创建、截至所选时点的状态统计</small></template><p v-else-if="failed" class="quiet-empty" role="alert">订单接口暂时不可用，请重试</p><p v-else class="quiet-empty">该窗口内没有订单事件</p></section></template>
