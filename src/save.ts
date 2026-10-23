import { cosmetic, levelFromXp, type ItemKind } from './content.ts'
import type { AgentId, WeaponId } from './types.ts'

export type HistoryEntry = {
  won: boolean
  map: string
  tags: number
  deaths: number
  srDelta: number
  ranked: boolean
  xp: number
}

export type Save = {
  name: string
  sensitivity: number
  volume: number
  invertY: boolean
  bob: boolean
  showFps: boolean
  xp: number
  sr: number
  wins: number
  losses: number
  history: HistoryEntry[]
  equipped: {
    agent: AgentId
    weapon: WeaponId
    outfit: string
    wrap: string
    paint: string
    spray: string
  }
}

const KEY = 'paintball-verse-save-v1'

export function defaultSave(): Save {
  return {
    name: 'Painter',
    sensitivity: 1,
    volume: 0.7,
    invertY: false,
    bob: true,
    showFps: false,
    xp: 0,
    sr: 0,
    wins: 0,
    losses: 0,
    history: [],
    equipped: {
      agent: 'blitz',
      weapon: 'rapid',
      outfit: 'default',
      wrap: 'factory',
      paint: 'classic',
      spray: 'burst',
    },
  }
}

export function loadSave(): Save {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return defaultSave()
    const parsed = JSON.parse(raw) as Partial<Save>
    const base = defaultSave()
    const save: Save = {
      ...base,
      ...parsed,
      equipped: { ...base.equipped, ...(parsed.equipped ?? {}) },
      history: Array.isArray(parsed.history) ? parsed.history.slice(0, 8) : [],
    }
    return sanitize(save)
  } catch {
    return defaultSave()
  }
}

export function writeSave(save: Save): void {
  localStorage.setItem(KEY, JSON.stringify(sanitize(save)))
}

export function owns(xp: number, id: string): boolean {
  const item = cosmetic(id)
  return levelFromXp(xp).level >= item.level
}

function fallback(kind: ItemKind): string {
  if (kind === 'paint') return 'classic'
  if (kind === 'wrap') return 'factory'
  if (kind === 'spray') return 'burst'
  return 'default'
}

export function sanitize(save: Save): Save {
  const next = { ...save, equipped: { ...save.equipped } }
  next.name = (next.name || 'Painter').replace(/[^\w .'-]/g, '').slice(0, 16) || 'Painter'
  next.sensitivity = Math.max(0.4, Math.min(2.2, Number(next.sensitivity) || 1))
  next.volume = Math.max(0, Math.min(1, Number(next.volume) || 0))
  next.xp = Math.max(0, Math.floor(Number(next.xp) || 0))
  next.sr = Math.max(0, Math.floor(Number(next.sr) || 0))
  next.wins = Math.max(0, Math.floor(Number(next.wins) || 0))
  next.losses = Math.max(0, Math.floor(Number(next.losses) || 0))
  const agents: AgentId[] = ['blitz', 'guardian', 'scout', 'splatter', 'medic']
  const weapons: WeaponId[] = ['rapid', 'sniper', 'splash']
  if (!agents.includes(next.equipped.agent)) next.equipped.agent = 'blitz'
  if (!weapons.includes(next.equipped.weapon)) next.equipped.weapon = 'rapid'
  if (!owns(next.xp, next.equipped.outfit)) next.equipped.outfit = fallback('outfit')
  if (!owns(next.xp, next.equipped.wrap)) next.equipped.wrap = fallback('wrap')
  if (!owns(next.xp, next.equipped.paint)) next.equipped.paint = fallback('paint')
  if (!owns(next.xp, next.equipped.spray)) next.equipped.spray = fallback('spray')
  next.history = (next.history ?? []).slice(0, 8)
  return next
}
