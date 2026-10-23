import type { AgentId, Difficulty, WeaponId } from './types.ts'

export type AgentDef = {
  id: AgentId
  name: string
  role: string
  color: number
  blurb: string
  passive: string
  signature: string
  signatureBlurb: string
  sigLabel: string
  ultimate: string
  ultimateBlurb: string
  ultLabel: string
  cd: number
}

export type WeaponDef = {
  id: WeaponId
  name: string
  blurb: string
  auto: boolean
  rpm: number
  mag: number
  reload: number
  pellets: number
  spread: number
  spreadAds: number
  speed: number
  gravity: number
  damage: number
  minDamage: number
  falloffStart: number
  falloffEnd: number
  adsFov: number
  adsMove: number
  range: [number, number]
}

export const AGENTS: AgentDef[] = [
  {
    id: 'blitz',
    name: 'Blitz',
    role: 'Duelist',
    color: 0x3de1ff,
    blurb: 'Closes the lane and paints it shut.',
    passive: 'Lighter boots. A step quicker than the rest of the roster.',
    signature: 'Paint Dash',
    signatureBlurb: 'Burst forward on a slick of paint. Anyone you blow past eats a tag.',
    sigLabel: 'DASH',
    ultimate: 'Trigger Storm',
    ultimateBlurb: 'The hopper goes hot. Fire rate surges and reloads barely exist.',
    ultLabel: 'STORM',
    cd: 8,
  },
  {
    id: 'guardian',
    name: 'Guardian',
    role: 'Anchor',
    color: 0xffd23d,
    blurb: 'Holds a lane until the paint dries.',
    passive: 'Shoulders a slab of cover. Harder to shove off a point.',
    signature: 'Splatter Shield',
    signatureBlurb: 'Plant a paint-glass wall. Incoming balls break on it.',
    sigLabel: 'SHIELD',
    ultimate: 'Fortify',
    ultimateBlurb: 'You and nearby teammates shrug off half the damage for a few seconds.',
    ultLabel: 'FORTIFY',
    cd: 12,
  },
  {
    id: 'scout',
    name: 'Scout',
    role: 'Recon',
    color: 0xb388ff,
    blurb: 'Finds the flank before it finds you.',
    passive: 'Reads the lane. Spotted targets stay marked a little longer.',
    signature: 'Recon Dart',
    signatureBlurb: 'A dart that sticks to walls and outlines enemies through cover.',
    sigLabel: 'DART',
    ultimate: 'Full Scan',
    ultimateBlurb: 'Ping every opposing player on the map for a short window.',
    ultLabel: 'SCAN',
    cd: 12,
  },
  {
    id: 'splatter',
    name: 'Splatter',
    role: 'Area',
    color: 0xff4d8d,
    blurb: 'Turns corners into puddles.',
    passive: 'Blasts leave a wider paint pool.',
    signature: 'Paint Grenade',
    signatureBlurb: 'Lob a ball that bursts into a splash of damage and color.',
    sigLabel: 'NADE',
    ultimate: 'Paint Cannon',
    ultimateBlurb: 'Fire one enormous ball. Direct hits and the splash both hurt.',
    ultLabel: 'CANNON',
    cd: 11,
  },
  {
    id: 'medic',
    name: 'Medic',
    role: 'Support',
    color: 0x5dff9a,
    blurb: 'Keeps a wiped lane from staying wiped.',
    passive: 'While Medic is standing, fatal tags drop teammates into a crawl instead of a burst.',
    signature: 'Revive Pack',
    signatureBlurb: 'Throw a pack. It pops downed teammates up and tops off the rest.',
    sigLabel: 'PACK',
    ultimate: 'Team Heal',
    ultimateBlurb: 'A wave of fresh paint. Heal the living and stand the downed back up.',
    ultLabel: 'HEAL',
    cd: 14,
  },
]

export const WEAPONS: WeaponDef[] = [
  {
    id: 'rapid',
    name: 'Rapid Marker',
    blurb: 'Fast hopper, 15 balls. Body tags land between 26 and 36.',
    auto: true,
    rpm: 470,
    mag: 15,
    reload: 2.15,
    pellets: 1,
    spread: 1.35,
    spreadAds: 0.62,
    speed: 54,
    gravity: 7.2,
    damage: 31,
    minDamage: 22,
    falloffStart: 18,
    falloffEnd: 46,
    adsFov: 62,
    adsMove: 0.78,
    range: [26, 36],
  },
  {
    id: 'sniper',
    name: 'Sniper Pump',
    blurb: 'One clean tag. Four in the tube, then a long pump reload. 4× scope.',
    auto: false,
    rpm: 42,
    mag: 4,
    reload: 2.95,
    pellets: 1,
    spread: 0.18,
    spreadAds: 0.02,
    speed: 92,
    gravity: 4.2,
    damage: 100,
    minDamage: 100,
    falloffStart: 80,
    falloffEnd: 120,
    adsFov: 18,
    adsMove: 0.48,
    range: [100, 100],
  },
  {
    id: 'splash',
    name: 'Splash Blaster',
    blurb: 'Eight-ball spread. Nasty up close, hopeful down a lane.',
    auto: false,
    rpm: 88,
    mag: 6,
    reload: 2.5,
    pellets: 8,
    spread: 6.4,
    spreadAds: 4.1,
    speed: 42,
    gravity: 8.6,
    damage: 10,
    minDamage: 4,
    falloffStart: 8,
    falloffEnd: 22,
    adsFov: 64,
    adsMove: 0.82,
    range: [8, 16],
  },
]

export const BOT_NAMES = [
  'Drip',
  'Nova',
  'Cork',
  'Hopper',
  'Marble',
  'Vinyl',
  'Speck',
  'Cobalt',
  'Mango',
  'Bounce',
  'Raster',
  'Pixel',
  'Aqua',
  'Riot',
  'Echo',
  'Jinx',
  'Polo',
  'Gloss',
  'Splish',
  'Tango',
  'Fizz',
  'Lumen',
  'Pebble',
  'Zig',
] as const

export type DiffTune = {
  think: number
  turn: number
  error: number
  react: number
  aim: number
  lead: number
  flank: boolean
  cover: boolean
  coord: boolean
  ability: number
}

export const DIFFICULTY: Record<Difficulty, DiffTune> = {
  rookie: {
    think: 0.45,
    turn: 1.8,
    error: 0.16,
    react: 0.58,
    aim: 0.22,
    lead: 0,
    flank: false,
    cover: false,
    coord: false,
    ability: 0.35,
  },
  veteran: {
    think: 0.22,
    turn: 3.4,
    error: 0.06,
    react: 0.3,
    aim: 0.09,
    lead: 0.7,
    flank: false,
    cover: true,
    coord: false,
    ability: 0.85,
  },
  champion: {
    think: 0.12,
    turn: 6.8,
    error: 0.022,
    react: 0.15,
    aim: 0.05,
    lead: 1,
    flank: true,
    cover: true,
    coord: true,
    ability: 1,
  },
}

export const TIERS = [
  { name: 'Bronze', color: '#d08a5a', min: 0 },
  { name: 'Silver', color: '#d5dbe6', min: 100 },
  { name: 'Gold', color: '#ffd056', min: 200 },
  { name: 'Platinum', color: '#7ee0d6', min: 300 },
  { name: 'Diamond', color: '#8eb6ff', min: 400 },
  { name: 'Champion', color: '#ff4d8d', min: 500 },
] as const

export function rankFor(sr: number): { name: string; color: string; into: number; span: number; next: string | null } {
  let idx = 0
  for (let i = 0; i < TIERS.length; i++) {
    if (sr >= TIERS[i]!.min) idx = i
  }
  const tier = TIERS[idx]!
  const next = TIERS[idx + 1]
  if (!next) return { name: tier.name, color: tier.color, into: sr - tier.min, span: 100, next: null }
  return {
    name: tier.name,
    color: tier.color,
    into: sr - tier.min,
    span: next.min - tier.min,
    next: next.name,
  }
}

export function difficultyForSr(sr: number): Difficulty {
  if (sr >= 400) return 'champion'
  if (sr >= 200) return 'veteran'
  return 'rookie'
}

export type ItemKind = 'paint' | 'wrap' | 'spray' | 'outfit'

export type Cosmetic = {
  id: string
  kind: ItemKind
  name: string
  blurb: string
  level: number
  color: number
  accent?: number
}

export const COSMETICS: Cosmetic[] = [
  { id: 'classic', kind: 'paint', name: 'Classic Capsule', blurb: 'Team color, straight from the hopper.', level: 1, color: 0xfff4ea },
  { id: 'magenta', kind: 'paint', name: 'Magenta Burst', blurb: 'A hot tint in every splat you throw.', level: 2, color: 0xff3d9a },
  { id: 'gold', kind: 'paint', name: 'Gold Capsule', blurb: 'Championship pigment. Hard to miss.', level: 7, color: 0xffd056 },
  { id: 'void', kind: 'paint', name: 'Void Purple', blurb: 'Night-match ink.', level: 12, color: 0x9b6bff },
  { id: 'factory', kind: 'wrap', name: 'Factory', blurb: 'The marker you were handed.', level: 1, color: 0xc8d0dc },
  { id: 'candy', kind: 'wrap', name: 'Candy Drip', blurb: 'Pink and cyan, still wet.', level: 4, color: 0xff4d8d },
  { id: 'hazard', kind: 'wrap', name: 'Hazard', blurb: 'Chevrons for people who push smoke.', level: 9, color: 0xffe14a },
  { id: 'frost', kind: 'wrap', name: 'Frost', blurb: 'Pale panels, cold lane.', level: 11, color: 0xbfe9ff },
  { id: 'burst', kind: 'spray', name: 'Burst', blurb: 'A starburst you can slap on a wall.', level: 1, color: 0xfff4ea },
  { id: 'crown', kind: 'spray', name: 'Crown', blurb: 'For rounds you actually closed.', level: 8, color: 0xffd056 },
  { id: 'king', kind: 'spray', name: 'Splat King', blurb: 'The victory mark.', level: 10, color: 0xff4d8d },
  { id: 'default', kind: 'outfit', name: 'Issue Gear', blurb: 'Agent colors, untouched.', level: 1, color: 0xffffff },
  { id: 'neon', kind: 'outfit', name: 'Neon Circuit', blurb: 'Visor glow turned all the way up.', level: 6, color: 0x39ff9a, accent: 0xff2bd6 },
  { id: 'white', kind: 'outfit', name: 'Championship White', blurb: 'Clean kit. Dirty paint.', level: 8, color: 0xf4f7ff, accent: 0x7ecbff },
]

export function cosmeticsOf(kind: ItemKind): Cosmetic[] {
  return COSMETICS.filter((c) => c.kind === kind)
}

export function cosmetic(id: string): Cosmetic {
  return COSMETICS.find((c) => c.id === id) ?? COSMETICS[0]!
}

export function agentById(id: AgentId): AgentDef {
  return AGENTS.find((a) => a.id === id) ?? AGENTS[0]!
}

export function weaponById(id: WeaponId): WeaponDef {
  return WEAPONS.find((w) => w.id === id) ?? WEAPONS[0]!
}

export function xpToNext(level: number): number {
  return 120 + (level - 1) * 40
}

export function levelFromXp(xp: number): { level: number; into: number; next: number } {
  let level = 1
  let remain = Math.max(0, xp)
  while (level < 40) {
    const need = xpToNext(level)
    if (remain < need) return { level, into: remain, next: need }
    remain -= need
    level++
  }
  const need = xpToNext(40)
  return { level: 40, into: need, next: need }
}

export function calcXp(stats: {
  tags: number
  assists: number
  revives: number
  damage: number
  shots: number
  hits: number
}, won: boolean): number {
  const acc = stats.shots > 0 ? stats.hits / stats.shots : 0
  return Math.round(80 + (won ? 220 : 40) + stats.tags * 36 + stats.assists * 18 + stats.revives * 30 + stats.damage * 0.12 + acc * 70)
}

export function calcSr(stats: { tags: number; deaths: number; damage: number }, won: boolean): number {
  let delta = won ? 26 : -18
  delta += (stats.tags - stats.deaths) * 2
  delta += Math.round(stats.damage / 250)
  if (won) return Math.max(12, Math.min(38, delta))
  return Math.max(-28, Math.min(-6, delta))
}

export const TEAM_BLUE = 0x3c7dff
export const TEAM_ORANGE = 0xff7424

export function teamColor(team: 'blue' | 'orange'): number {
  return team === 'blue' ? TEAM_BLUE : TEAM_ORANGE
}
