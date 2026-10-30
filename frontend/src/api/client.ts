// Picks the API implementation from VITE_API_MODE. Default is mock so a
// fresh clone runs with no backend. Set VITE_API_MODE=live when FastAPI is up.

import { liveClient } from './live'
import { mockClient } from './mock'
import type { ApiClient } from './types'

const mode = (import.meta.env.VITE_API_MODE ?? 'mock') as string

export const api: ApiClient = mode === 'live' ? liveClient : mockClient

export { ApiError } from './types'
export type { ApiClient, ProposalFilter } from './types'
