import type { EChartsOption } from 'echarts'
import type { MetricSeries, PredictionData, StationStatus, WeatherImpactGroup } from '@/types/api'

export const palette = ['#19C7C9', '#4D8EF7', '#7167E8', '#FFAA45', '#FF647C', '#9AAABD']

const safeDate = (v?: string | null): Date | null => {
  if (!v) return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}

const hhmm = new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', hour12: false })
export const hour = (v: string) => {
  const d = safeDate(v)
  return d ? hhmm.format(d) : '-'
}

export const stationNumber = (s: { stationId: string }) => s.stationId.slice(-3)
export const stationAxisLabel = (s: { stationId: string; district: string }) =>
  `${stationNumber(s)} ${s.district.trim().replace(/区?$/, '')}`

const tooltip = {
  backgroundColor: '#FFFFFF',
  borderColor: '#DCE7EF',
  borderWidth: 1,
  extraCssText: 'box-shadow:0 8px 24px rgba(30,70,100,.12);border-radius:8px;',
  textStyle: { color: '#18324D' },
}

const axis = {
  axisLine: { show: false },
  axisTick: { show: false },
  axisLabel: { color: '#8FA0B3', fontSize: 10 },
  splitLine: { lineStyle: { color: '#E8EFF4', type: 'dashed' as const } },
}

const base: EChartsOption = {
  color: palette,
  backgroundColor: 'transparent',
  textStyle: { color: '#6F8296', fontFamily: 'Inter, Microsoft YaHei UI, PingFang SC, sans-serif' },
  grid: { top: 32, bottom: 22, left: 40, right: 12 },
  tooltip: { trigger: 'axis', ...tooltip },
  animationDuration: 550,
}

export function trend(history: MetricSeries | null, forecast: PredictionData | null, thresholdKw?: number): EChartsOption {
  const past = history?.points || []
  const next = forecast?.points || []
  return {
    ...base,
    legend: { right: 0, top: 0, textStyle: { color: '#6F8296', fontSize: 10 } },
    xAxis: { ...axis, type: 'category', boundaryGap: false, data: [...past.map(p => hour(p.time)), ...next.map(p => hour(p.intervalStart))] },
    yAxis: {
      ...axis,
      type: 'value',
      name: 'kW',
      min: 0,
      max: thresholdKw === undefined ? undefined : ({ max }: { max: number }) => Math.ceil(Math.max(max, thresholdKw) * 1.08 / 50) * 50,
      splitNumber: 3,
      nameTextStyle: { color: '#8FA0B3' },
    },
    series: [
      {
        name: '历史负荷',
        type: 'line',
        smooth: 0.25,
        showSymbol: false,
        data: [...past.map(p => p.value), ...next.map(() => null)],
        lineStyle: { width: 2.4, color: '#19C7C9' },
        areaStyle: { color: '#19C7C9', opacity: 0.09 },
      },
      {
        name: '未来预测',
        type: 'line',
        markLine: {
          silent: true,
          symbol: 'none',
          label: { formatter: '预警阈值 {c} kW', color: '#FFAA45', fontSize: 9, position: 'insideEndTop' },
          lineStyle: { color: '#FFAA45', type: 'dashed', width: 1.2 },
          data: thresholdKw !== undefined ? [{ yAxis: Number(thresholdKw.toFixed(1)) }] : [],
        },
        smooth: 0.25,
        showSymbol: next.length === 1,
        data: [...past.map(() => null), ...next.map(p => p.predictedLoadKw)],
        lineStyle: { type: 'dashed', width: 2.2, color: '#7167E8' },
        areaStyle: { color: '#7167E8', opacity: 0.06 },
      },
    ],
  }
}

export function ring(stations: StationStatus[]): EChartsOption {
  const keys = ['idlePiles', 'usingPiles', 'reservedPiles', 'faultPiles', 'unknownPiles'] as const
  return {
    ...base,
    tooltip: { trigger: 'item', ...tooltip, formatter: '{b}: {c} 个 ({d}%)' },
    series: [{
      type: 'pie',
      radius: ['65%', '87%'],
      center: ['50%', '50%'],
      label: { show: false },
      itemStyle: { borderRadius: 5, borderColor: '#FFFFFF', borderWidth: 3 },
      data: keys.map((k, i) => ({ name: ['空闲', '充电', '预约', '故障', '未知'][i], value: stations.reduce((sum, s) => sum + s[k], 0) })),
    }],
  }
}

export function bars(labels: string[], values: (number | null)[], unit: string, color = palette[0]): EChartsOption {
  return {
    ...base,
    color: [color],
    grid: { ...base.grid as object, bottom: unit === '%' ? 38 : 22 },
    xAxis: { ...axis, type: 'category', data: labels, ...(unit === '%' ? { axisLabel: { ...axis.axisLabel, interval: 0, rotate: 30, fontSize: 9 } } : {}) },
    yAxis: { ...axis, type: 'value', name: unit, min: 0, max: unit === '%' ? 100 : undefined, splitNumber: 3, minInterval: unit === '个' ? 1 : undefined },
    series: [{ type: 'bar', barMaxWidth: 16, data: values, itemStyle: { borderRadius: [4, 4, 0, 0] } }],
  }
}

export function freeComparison(stations: StationStatus[], future: (number | null)[], hours: number): EChartsOption {
  return {
    ...base,
    grid: { top: 35, bottom: 38, left: 32, right: 10 },
    legend: { top: 0, right: 0, textStyle: { color: '#6F8296', fontSize: 10 } },
    xAxis: { ...axis, type: 'category', data: stations.map(stationAxisLabel), axisLabel: { ...axis.axisLabel, interval: 0, rotate: 25, fontSize: 9 } },
    yAxis: { ...axis, type: 'value', name: '个', min: 0, minInterval: 1, splitNumber: 3 },
    series: [
      { id: 'free-now', name: '当前空闲', type: 'bar', data: stations.map(s => s.idlePiles), barMaxWidth: 13, itemStyle: { borderRadius: [4, 4, 0, 0], color: '#19C7C9' } },
      { id: 'free-future', name: `${hours}h后预计`, type: 'bar', data: future, barMaxWidth: 13, itemStyle: { borderRadius: [4, 4, 0, 0], color: '#7167E8' } },
    ],
  }
}

export function heat(stations: StationStatus[], rows: MetricSeries[]): EChartsOption {
  return {
    ...base,
    tooltip: {
      trigger: 'item',
      renderMode: 'richText',
      confine: true,
      ...tooltip,
      formatter: (params: unknown) => {
        const p = params as { value: number[] }
        const [x, y, value] = p.value
        const station = stations[y]
        const time = rows[y]?.points[x]?.time
        return [
          (station?.district || '').trim(),
          station?.stationName || '',
          station?.stationId || '',
          time ? `${new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(time))} 起1小时` : '',
          `平均负荷 ${value.toFixed(2)} kW`,
        ].join('\n')
      },
    },
    axisPointer: { show: false },
    grid: { left: 67, right: 8, top: 6, bottom: 22 },
    xAxis: { ...axis, type: 'category', splitLine: { show: false }, data: (rows[0]?.points || []).map(p => hour(p.time)), axisLabel: { color: '#8FA0B3', fontSize: 9, interval: 5 } },
    yAxis: { ...axis, type: 'category', splitLine: { show: false }, data: stations.map(stationAxisLabel), axisLabel: { color: '#8FA0B3', fontSize: 9, interval: 0 } },
    visualMap: { show: false, min: 0, max: Math.max(1, ...rows.flatMap(r => r.points.map(p => p.value ?? 0))), inRange: { color: ['#EDF6FA', '#BCEFF0', '#73DADC', '#4D8EF7', '#7167E8'] } },
    series: [{
      type: 'heatmap',
      data: rows.flatMap((r, y) => r.points.flatMap((p, x) => p.value == null ? [] : [[x, y, p.value]])),
      itemStyle: { borderWidth: 3, borderColor: '#FFFFFF', borderRadius: 3 },
      emphasis: { focus: 'none', itemStyle: { borderColor: '#19C7C9', borderWidth: 2 } },
    }],
  }
}

export function weather(groups: WeatherImpactGroup[]): EChartsOption {
  return bars(groups.map(g => g.label), groups.map(g => g.avgLoadKw), 'kW', palette[1])
}
