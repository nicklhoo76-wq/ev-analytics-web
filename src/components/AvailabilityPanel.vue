<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { palette } from '@/lib/neonCharts'
import type { StationStatus } from '@/types/api'
const props=defineProps<{stations:StationStatus[];selectedId:string;admin:boolean;theme?:'light'|'dark'}>()
defineEmits<{select:[id:string]}>()
const keys=['idlePiles','usingPiles','reservedPiles','faultPiles','unknownPiles'] as const
const labels=['空闲','充电','预约','故障','未知']
const totals=computed(()=>keys.map(k=>props.stations.reduce((a,s)=>a+s[k],0)))
const page=ref(0)
const pageSize=4
const pageCount=computed(()=>Math.max(1,Math.ceil(props.stations.length/pageSize)))
const visibleStations=computed(()=>props.stations.slice(page.value*pageSize,page.value*pageSize+pageSize))
watch(()=>props.stations.length,()=>{page.value=Math.min(page.value,pageCount.value-1)})
watch(()=>props.selectedId,id=>{
 const index=props.stations.findIndex(s=>s.stationId===id)
 if(index>=0)page.value=Math.floor(index/pageSize)
})
const go=(delta:number)=>{page.value=(page.value+delta+pageCount.value)%pageCount.value}
</script>
<template><section class="glass bottom-availability"><div class="panel-title"><h2>{{admin?'站点可用性与状态':'全部站点空闲情况'}}</h2><span>{{stations.length}} 站 · 空闲 / 总数</span></div><div v-if="admin" class="network-status"><span v-for="(label,i) in labels" :key="label"><i :style="{background:palette[i]}"></i>{{label}} <b>{{totals[i]}}</b></span></div><template v-if="admin&&theme==='light'"><div class="availability-pager"><button type="button" aria-label="上一页站点" @click="go(-1)">‹</button><span>{{page+1}} / {{pageCount}}</span><button type="button" aria-label="下一页站点" @click="go(1)">›</button></div><div class="station-status-grid paged"><button v-for="s in visibleStations" :key="s.stationId" :class="{active:selectedId===s.stationId}" @click="$emit('select',s.stationId)" :aria-pressed="selectedId===s.stationId"><div><b>{{s.stationId.slice(-3)}} <small>{{s.district.trim()}}</small></b><strong>{{s.idlePiles}}<small> / {{s.pileTotal}}</small></strong></div><div class="status-segments" :title="keys.map((k,i)=>`${labels[i]} ${s[k]}`).join(' · ')"><i v-for="(k,i) in keys" :key="k" :style="{width:`${s.pileTotal?s[k]/s.pileTotal*100:0}%`,background:palette[i]}"></i></div></button></div></template><div v-else class="station-status-grid"><button v-for="s in stations" :key="s.stationId" :class="{active:selectedId===s.stationId}" @click="$emit('select',s.stationId)" :aria-pressed="selectedId===s.stationId"><div><b>{{s.stationId.slice(-3)}} <small>{{s.district.trim()}}</small></b><strong>{{s.idlePiles}}<small> / {{s.pileTotal}}</small></strong></div><div class="status-segments" :title="admin?keys.map((k,i)=>`${labels[i]} ${s[k]}`).join(' · '):`空闲 ${s.idlePiles}/${s.pileTotal}`"><template v-if="admin"><i v-for="(k,i) in keys" :key="k" :style="{width:`${s.pileTotal?s[k]/s.pileTotal*100:0}%`,background:palette[i]}"></i></template><i v-else :style="{width:`${s.pileTotal?s.idlePiles/s.pileTotal*100:0}%`,background:palette[0]}"></i></div></button></div></section></template>
