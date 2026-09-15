<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { PredictionData } from '@/types/api'
import { hour } from '@/lib/neonCharts'
const props=defineProps<{prediction:PredictionData|null}>()
const hovered=ref<number|null>(null),pinned=ref<number|null>(null)
const points=computed(()=>props.prediction?.points||[])
const bestIndex=computed(()=>points.value.reduce((winner,p,i)=>(p.predictedFreePiles??-1)>(points.value[winner]?.predictedFreePiles??-1)?i:winner,0))
const activeIndex=computed(()=>hovered.value??pinned.value??bestIndex.value)
const active=computed(()=>points.value[activeIndex.value])
const maximum=computed(()=>Math.max(1,...points.value.map(p=>p.predictedFreePiles??0)))
watch(()=>props.prediction,()=>{hovered.value=null;pinned.value=null})
</script>
<template><div class="charging-window"><div class="window-head"><div><span>{{hovered!==null?'正在查看':pinned!==null?'已固定时点':'推荐充电时点'}}</span><strong>{{active?hour(active.intervalEnd):'—'}}</strong><p class="window-value">预计 <b>{{active?.predictedFreePiles??'—'}}</b> 个空闲充电位</p></div><button v-if="pinned!==null" class="text-action" @click="pinned=null">恢复推荐</button></div><div class="window-columns" @mouseleave="hovered=null"><button v-for="(p,i) in points" :key="p.intervalStart" :class="{best:i===activeIndex}" :aria-label="`${hour(p.intervalEnd)}，预计空闲${p.predictedFreePiles??'未知'}个`" :aria-pressed="pinned===i" @mouseenter="hovered=i" @focus="hovered=i" @blur="hovered=null" @click="pinned=pinned===i?null:i" :style="{'--bar':`${p.predictedFreePiles===null?0:p.predictedFreePiles/maximum*100}%`}"><i></i><em v-if="i===activeIndex">{{p.predictedFreePiles??'—'}} 个</em><span v-if="i%4===0 || points.length<=6">{{hour(p.intervalEnd)}}</span></button></div><div class="window-caption"><span>柱高表示预计空闲数量 · 小时末</span><span>悬停查看 · 点击固定</span></div><p v-if="!points.length" class="quiet-empty">暂无该时段空闲预测</p></div></template>
