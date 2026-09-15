import { httpGateway } from './httpGateway'
import { mockGateway } from './mockGateway'
import { replayGateway } from './replayGateway'

const mode=import.meta.env.VITE_DATA_MODE || 'replay'
export const api = mode === 'api' ? httpGateway : mode === 'mock' ? mockGateway : replayGateway
