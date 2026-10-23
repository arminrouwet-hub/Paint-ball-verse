import type { Difficulty, WeaponId } from './types.ts'

export type LobbyOpts = {
  mapId: string
  difficulty: Difficulty
  teamSize: 3 | 4 | 5
  roundsToWin: 2 | 3
  storm: boolean
  lowgrav: boolean
  onegun: boolean
  seed: number
}

const MAPS = ['warehouse', 'canyon', 'city', 'forest', 'skate', 'stadium', 'zerog', 'hopper']
const DIFFS: Difficulty[] = ['rookie', 'veteran', 'champion']

export function encodeLobby(o: LobbyOpts): string {
  const flags = `${o.storm ? 'S' : ''}${o.lowgrav ? 'G' : ''}${o.onegun ? 'O' : ''}` || 'N'
  return `PV-${o.mapId}-${o.difficulty}-${o.teamSize}-${o.roundsToWin}-${flags}-${o.seed.toString(36)}`.toUpperCase()
}

export function decodeLobby(raw: string): LobbyOpts | null {
  const text = raw.trim().toUpperCase()
  const parts = text.split('-')
  if (parts.length < 7 || parts[0] !== 'PV') return null
  const mapId = (parts[1] ?? '').toLowerCase()
  const difficulty = (parts[2] ?? '').toLowerCase() as Difficulty
  const teamSize = Number(parts[3])
  const roundsToWin = Number(parts[4])
  const flags = parts[5] ?? 'N'
  const seed = parseInt(parts.slice(6).join('-'), 36)
  if (!MAPS.includes(mapId)) return null
  if (!DIFFS.includes(difficulty)) return null
  if (teamSize !== 3 && teamSize !== 4 && teamSize !== 5) return null
  if (roundsToWin !== 2 && roundsToWin !== 3) return null
  if (!Number.isFinite(seed)) return null
  return {
    mapId,
    difficulty,
    teamSize,
    roundsToWin,
    storm: flags.includes('S'),
    lowgrav: flags.includes('G'),
    onegun: flags.includes('O'),
    seed: Math.abs(seed) % 1_000_000_000,
  }
}

export function oneGunWeapon(seed: number): WeaponId {
  const list: WeaponId[] = ['rapid', 'sniper', 'splash']
  return list[Math.abs(seed) % 3]!
}
