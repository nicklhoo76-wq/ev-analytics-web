import { computed, reactive } from 'vue'
import type { MockScenario } from '@/types/api'
import replay from '@/data/member3-replay.json'

const state = reactive({
  datasetId: import.meta.env.VITE_DATA_MODE==='api'?'':'beijing-development-seed-20260914',
  batchId: import.meta.env.VITE_DATA_MODE==='api'?'':'beijing-development-seed-20260914',
  asOf: import.meta.env.VITE_DATA_MODE==='api'?'':import.meta.env.VITE_DATA_MODE==='mock'?'2023-04-09T20:00:00+08:00':replay.availableAsOf[1]!,
  stationId: '',
  scenario: 'normal' as MockScenario,
})

const dataMode = (import.meta.env.VITE_DATA_MODE || 'replay') as 'mock' | 'api' | 'replay'

export function useDashboardStore() {
  return {
    state,
    dataMode,
    isMock: computed(() => dataMode === 'mock'),
    setAsOf: (value: string) => { state.asOf = value },
    setPublication: (datasetId: string, batchId: string) => { state.datasetId = datasetId; state.batchId = batchId },
    setStation: (value: string) => { state.stationId = value },
    setScenario: (value: MockScenario) => { state.scenario = value },
  }
}
