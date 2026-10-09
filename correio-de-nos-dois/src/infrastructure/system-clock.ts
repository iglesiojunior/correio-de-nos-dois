import type { Clock } from '../application'

export const systemClock: Clock = { now: () => new Date() }
