<script setup lang="ts">
import { computed } from 'vue'
import { palette } from '@/lib/neonCharts'
import type { StationStatus } from '@/types/api'
const props=defineProps<{stations:StationStatus[];selectedId:string;admin:boolean}>()
defineEmits<{select:[id:string]}>()
const keys=['idlePiles','usingPiles','reservedPiles','faultPiles','unknownPiles'] as const
const labels=['空闲','充电','预约','故障','未知']
const totals=computed(()=>keys.map(k=>props.stations.reduce((a,s)=>a+s[k],0)))
</script>
<template><section class="glass bottom-availability"><div class="panel-title"><h2>{{admin?'站点可用性与状态':'全部站点空闲情况'}}</h2><span>{{stations.length}} 站 · 空闲 / 总数</span></div><div v-if="admin" class="network-status"><span v-for="(label,i) in labels" :key="label"><i :style="{background:palette[i]}"></i>{{label}} <b>{{totals[i]}}</b></span></div><div class="station-status-grid"><button v-for="s in stations" :key="s.stationId" :class="{active:selectedId===s.stationId}" @click="$emit('select',s.stationId)" :aria-pressed="selectedId===s.stationId"><div><b>{{s.stationId.slice(-3)}} <small>{{s.district.trim()}}</small></b><strong>{{s.idlePiles}}<small> / {{s.pileTotal}}</small></strong></div><div class="status-segments" :title="admin?keys.map((k,i)=>`${labels[i]} ${s[k]}`).join(' · '):`空闲 ${s.idlePiles}/${s.pileTotal}`"><template v-if="admin"><i v-for="(k,i) in keys" :key="k" :style="{width:`${s.pileTotal?s[k]/s.pileTotal*100:0}%`,background:palette[i]}"></i></template><i v-else :style="{width:`${s.pileTotal?s.idlePiles/s.pileTotal*100:0}%`,background:palette[0]}"></i></div></button></div></section></template>
