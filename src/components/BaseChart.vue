<script setup lang="ts">
import { BarChart, LineChart, PieChart, HeatmapChart, ScatterChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent, VisualMapComponent, MarkLineComponent } from 'echarts/components'
import { init, use, type EChartsType } from 'echarts/core'
import { SVGRenderer } from 'echarts/renderers'
import type { EChartsOption } from 'echarts'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

use([LineChart, BarChart, PieChart, HeatmapChart, ScatterChart, GridComponent, LegendComponent, TooltipComponent, VisualMapComponent, MarkLineComponent, SVGRenderer])

const props = withDefaults(defineProps<{ option: EChartsOption; height?: number; ariaLabel?: string }>(), { height: 280, ariaLabel: '数据图表' })
const root = ref<HTMLElement | null>(null)
let chart: EChartsType | null = null
let observer: ResizeObserver | null = null

function render() {
  if (!root.value) return
  if (!chart) chart = init(root.value, undefined, { renderer: 'svg' })
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  chart.setOption({ ...props.option, legend: props.option.legend ?? [], visualMap: props.option.visualMap ?? [], animation: !reduced, animationDurationUpdate: reduced ? 0 : 450 }, { notMerge:false, replaceMerge:['series','legend','visualMap','xAxis','yAxis'], lazyUpdate:false })
}

onMounted(() => {
  render()
  observer = new ResizeObserver(() => chart?.resize())
  if (root.value) observer.observe(root.value)
})
watch(() => props.option, render, { deep: true })
onBeforeUnmount(() => { observer?.disconnect(); chart?.dispose() })
</script>

<template><div ref="root" class="base-chart" :style="{ height: `${height}px` }" role="img" :aria-label="ariaLabel" /></template>
