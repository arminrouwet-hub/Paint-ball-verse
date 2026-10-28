import { COSMETICS, cosmetic, levelFromXp, type Cosmetic, type ItemKind } from './content.ts'
import type { WeaponId } from './types.ts'

export type HistoryEntry = {
  won: boolean
  map: string
  tags: number
  deaths: number
  srDelta: number
  ranked: boolean
  xp: number
  pc?: number
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
  pc: number
  pcBank: number
  pcLifetime: number
  owned: string[]
  history: HistoryEntry[]
  equipped: {
    weapon: WeaponId
    outfit: string
    wrap: string
    buddy: string
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
    pc: 0,
    pcBank: 0,
    pcLifetime: 0,
    owned: [],
    history: [],
    equipped: {
      weapon: 'rapid',
      outfit: 'default',
      wrap: 'factory',
      buddy: 'none',
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
      owned: Array.isArray(parsed.owned) ? parsed.owned.filter((id) => typeof id === 'string') : [],
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

export function owns(save: Pick<Save, 'xp' | 'owned'>, id: string): boolean {
  const item = COSMETICS.find((c) => c.id === id)
  if (!item) return false
  if (item.price !== undefined) return save.owned.includes(id)
  return levelFromXp(save.xp).level >= item.level
}

export function lockReason(save: Pick<Save, 'xp' | 'owned'>, item: Cosmetic): string | null {
  if (owns(save, item.id)) return null
  if (item.price !== undefined) return 'Item Shop'
  return `Level ${item.level}`
}

function fallback(kind: ItemKind): string {
  if (kind === 'paint') return 'classic'
  if (kind === 'wrap') return 'factory'
  if (kind === 'spray') return 'burst'
  if (kind === 'buddy') return 'none'
  return 'default'
}

export function sanitize(save: Save): Save {
  const next = { ...save, equipped: { ...save.equipped }, owned: [...new Set(save.owned ?? [])] }
  next.name = (next.name || 'Painter').replace(/[^\w .'-]/g, '').slice(0, 16) || 'Painter'
  next.sensitivity = Math.max(0.4, Math.min(2.2, Number(next.sensitivity) || 1))
  next.volume = Math.max(0, Math.min(1, Number(next.volume) || 0))
  next.xp = Math.max(0, Math.floor(Number(next.xp) || 0))
  next.sr = Math.max(0, Math.floor(Number(next.sr) || 0))
  next.wins = Math.max(0, Math.floor(Number(next.wins) || 0))
  next.losses = Math.max(0, Math.floor(Number(next.losses) || 0))
  next.pc = Math.max(0, Math.floor(Number(next.pc) || 0))
  next.pcBank = Math.max(0, Math.min(2, Math.floor(Number(next.pcBank) || 0)))
  next.pcLifetime = Math.max(next.pc, Math.floor(Number(next.pcLifetime) || 0))
  next.owned = next.owned.filter((id) => COSMETICS.some((c) => c.id === id && c.price !== undefined))
  const weapons: WeaponId[] = ['rapid', 'sniper', 'splash']
  if (!weapons.includes(next.equipped.weapon)) next.equipped.weapon = 'rapid'
  for (const kind of ['outfit', 'wrap', 'buddy', 'paint', 'spray'] as const) {
    const id = next.equipped[kind]
    if (cosmetic(id).kind !== kind || !owns(next, id)) next.equipped[kind] = fallback(kind)
  }
  next.history = (next.history ?? []).slice(0, 8)
  return next
}
