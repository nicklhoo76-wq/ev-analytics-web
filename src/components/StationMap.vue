<script setup lang="ts">
import { computed } from 'vue'
import coordinates from '@/mocks/coordinates.json'
import type { StationStatus } from '@/types/api'
const props=defineProps<{stations:StationStatus[];selectedId:string;mock:boolean}>()
const emit=defineEmits<{select:[id:string]}>()
const nodes=computed(()=>{
 const valid=props.stations.flatMap(s=>{
  const c=props.mock?coordinates.find(c=>c.station_id===s.stationId):s as StationStatus & {longitude?:number;latitude?:number}
  return c?.longitude!==undefined && c?.latitude!==undefined ? [{...s,lon:c.longitude,lat:c.latitude}]:[]
 })
 const xs=valid.map(s=>s.lon),ys=valid.map(s=>s.lat),xmin=Math.min(...xs),ymin=Math.min(...ys)
 const dx=Math.max(.001,Math.max(...xs)-xmin),dy=Math.max(.001,Math.max(...ys)-ymin)
 return valid.map(s=>({...s,x:12+(s.lon-xmin)/dx*70,y:14+(1-(s.lat-ymin)/dy)*62}))
})
</script>
<template><div class="station-map" aria-label="北京站点空间分布"><div class="map-grid" aria-hidden="true"></div><button v-for="s in nodes" :key="s.stationId" class="station-marker" :class="{active:selectedId===s.stationId,left:s.x>62,middle:s.x>45&&s.x<=62,top:s.y<24,bottom:s.y>64,edgeLeft:s.x<18,edgeRight:s.x>74,originZone:s.x<24&&s.y>64}" :style="{left:s.x+'%',top:s.y+'%'}" :aria-label="`${s.district} ${s.stationId}，空闲${s.idlePiles}个`" :aria-pressed="selectedId===s.stationId" @click="emit('select',s.stationId)"><span class="marker-dot"></span><span class="marker-label">{{s.district}}<small>{{s.stationId.slice(-3)}}站 · {{s.idlePiles}}空闲</small></span></button><p v-if="!nodes.length" class="quiet-empty">站点空间数据暂不可用</p><span class="map-direction">北 ↑　站点坐标分布　东 →</span></div></template>
