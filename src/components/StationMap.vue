<script setup lang="ts">
import { computed, ref } from 'vue'
import coordinates from '@/mocks/coordinates.json'
import type { StationStatus } from '@/types/api'

const props = defineProps<{ stations: StationStatus[]; selectedId: string; mock: boolean; theme?: 'light' | 'dark' }>()
const emit = defineEmits<{ select: [id: string] }>()
const hoveredId = ref('')

const nodes = computed(() => {
  const valid = props.stations.flatMap(s => {
    const c = props.mock ? coordinates.find(c => c.station_id === s.stationId) : s as StationStatus & { longitude?: number; latitude?: number }
    return c?.longitude !== undefined && c?.latitude !== undefined ? [{ ...s, lon: c.longitude, lat: c.latitude }] : []
  })
  const xs = valid.map(s => s.lon), ys = valid.map(s => s.lat), xmin = Math.min(...xs), ymin = Math.min(...ys)
  const dx = Math.max(.001, Math.max(...xs) - xmin), dy = Math.max(.001, Math.max(...ys) - ymin)
  return valid.map(s => ({ ...s, x: 12 + (s.lon - xmin) / dx * 70, y: 14 + (1 - (s.lat - ymin) / dy) * 62 }))
})

const featured = computed(() => nodes.value.find(s => s.stationId === hoveredId.value))
</script>

<template>
  <div class="station-map" aria-label="北京站点空间分布">
    <div class="map-grid" aria-hidden="true"></div>
    <button
      v-for="s in nodes"
      :key="s.stationId"
      class="station-marker"
      :class="{active:selectedId===s.stationId,left:s.x>62,middle:s.x>45&&s.x<=62,top:s.y<24,bottom:s.y>64,edgeLeft:s.x<18,edgeRight:s.x>74,originZone:s.x<24&&s.y>64}"
      :style="{left:s.x+'%',top:s.y+'%'}"
      :aria-label="`${s.district} ${s.stationId}，空闲${s.idlePiles}个，在线${s.pileTotal-s.faultPiles}/${s.pileTotal}，当前负荷${s.loadKw.toFixed(1)} kW`"
      :aria-pressed="selectedId===s.stationId"
      @mouseenter="hoveredId=s.stationId"
      @mouseleave="hoveredId=''"
      @focus="hoveredId=s.stationId"
      @blur="hoveredId=''"
      @click="emit('select',s.stationId)"
    >
      <span class="marker-dot"></span>
      <span class="marker-code">{{s.stationId.slice(-3)}}</span>
      <span v-if="theme!=='light'" class="marker-label">{{s.district}}<small>{{s.stationId.slice(-3)}}站 · {{s.idlePiles}}空闲</small></span>
    </button>
    <!-- 亮色主题的悬浮框与暗色主题的 .marker-label 保持同一尺寸：同样是区县 + 站号两行，
         因此只保留这两行内容，在线数与负荷仍在按钮的 aria-label 里可读。 -->
    <aside
      v-if="theme==='light'&&featured"
      class="map-focus-card"
      :class="{flipX:featured.x>55,alignTop:featured.y<26,alignBottom:featured.y>62}"
      :style="{left:featured.x+'%',top:featured.y+'%'}"
      aria-live="polite"
    >
      {{featured.district}}<small>{{featured.stationId.slice(-3)}}站 · {{featured.idlePiles}}空闲</small>
    </aside>
    <p v-if="!nodes.length" class="quiet-empty">站点空间数据暂不可用</p>
    <span class="map-direction">北 ↑　站点坐标分布　东 →</span>
  </div>
</template>
