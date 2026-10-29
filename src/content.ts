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
    id: 'vesper',
    name: 'Vesper',
    role: 'Shade',
    color: 0x8fd3ff,
    blurb: 'A hooded drifter who walks through ink and leaves the other squad painting at shadows.',
    passive: 'Echo: landing a tag refreshes Shade Step.',
    signature: 'Shade Step',
    signatureBlurb: 'Melt into ink and reappear up to 14 meters ahead, wherever the crosshair points.',
    sigLabel: 'STEP',
    ultimate: 'Blackout',
    ultimateBlurb: 'Hurl a violet orb that drifts through walls. Every enemy it brushes goes blind for three seconds.',
    ultLabel: 'BLACKOUT',
    cd: 9,
  },
]

export const VESPER = AGENTS[0]!

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

export type ItemKind = 'wrap' | 'buddy' | 'card' | 'spray' | 'paint'

export type Cosmetic = {
  id: string
  kind: ItemKind
  name: string
  blurb: string
  level: number
  color: number
  accent?: number
  price?: number
  bundle?: string
  rarity?: 'common' | 'rare' | 'epic' | 'legendary'
}

export const COSMETICS: Cosmetic[] = [
  { id: 'factory', kind: 'wrap', name: 'Standard', blurb: 'The marker you were handed.', level: 1, color: 0xc8d0dc },
  { id: 'candy', kind: 'wrap', name: 'Candy Drip', blurb: 'Pink and cyan, still wet.', level: 4, color: 0xff4d8d, rarity: 'rare' },
  { id: 'hazard', kind: 'wrap', name: 'Hazard', blurb: 'Chevrons for people who push smoke.', level: 9, color: 0xffe14a, rarity: 'rare' },
  { id: 'frost', kind: 'wrap', name: 'Frost', blurb: 'Pale panels, cold lane.', level: 11, color: 0xbfe9ff, rarity: 'epic' },
  { id: 'dreamwings', kind: 'wrap', name: 'Evori Dreamwing', blurb: 'Pearl chrome with a pair of fluttering glass wings on every marker.', level: 0, color: 0xe9d8ff, accent: 0xffb8e6, price: 14, bundle: 'evori', rarity: 'legendary' },
  { id: 'none', kind: 'buddy', name: 'No Buddy', blurb: 'A bare marker.', level: 1, color: 0x6a6280 },
  { id: 'splat', kind: 'buddy', name: 'Splat Drop', blurb: 'A little blue paintball with a big grin.', level: 2, color: 0x3c7dff, rarity: 'rare' },
  { id: 'hopper', kind: 'buddy', name: 'Lil Hopper', blurb: 'A tiny hopper, still full.', level: 7, color: 0xffe14a, rarity: 'rare' },
  { id: 'lumi', kind: 'buddy', name: 'Lumi the Star Cat', blurb: 'A sleepy lilac cat with a star on her forehead. Swings when you strafe.', level: 0, color: 0xa98bff, accent: 0xffe27a, price: 6, bundle: 'evori', rarity: 'epic' },
  { id: 'pip', kind: 'buddy', name: 'Pip the Pink Bear', blurb: 'Soft, round, and very sure you will clutch this.', level: 0, color: 0xff9ec8, price: 4, rarity: 'rare' },
  { id: 'clover', kind: 'buddy', name: 'Clover the Bunny', blurb: 'A mint bunny with one floppy ear.', level: 0, color: 0x8fe0a8, price: 4, rarity: 'rare' },
  { id: 'nibble', kind: 'buddy', name: 'Nibble the Mouse', blurb: 'An orange mouse who chews on spare paintballs.', level: 0, color: 0xffa25a, price: 4, rarity: 'rare' },
  { id: 'paintsplash', kind: 'card', name: 'Paint Splash', blurb: 'Blue meets orange, mid-air.', level: 1, color: 0x3c7dff },
  { id: 'sunset', kind: 'card', name: 'Lane at Sunset', blurb: 'The warehouse yard after the last round.', level: 3, color: 0xff7424, rarity: 'rare' },
  { id: 'shade', kind: 'card', name: 'Three Eyes', blurb: 'Vesper, watching from the dark.', level: 6, color: 0x2a1f45, rarity: 'epic' },
  { id: 'crowncard', kind: 'card', name: 'Gilded Crown', blurb: 'For painters who close out rounds.', level: 10, color: 0xffd056, rarity: 'epic' },
  { id: 'evoricard', kind: 'card', name: 'Evori Dream Wings Card', blurb: 'Butterfly wings over an aurora night.', level: 0, color: 0xd9b8ff, price: 5, bundle: 'evori', rarity: 'legendary' },
  { id: 'burst', kind: 'spray', name: 'Burst', blurb: 'A starburst you can slap on a wall.', level: 1, color: 0xfff4ea },
  { id: 'crown', kind: 'spray', name: 'Crown', blurb: 'For rounds you actually closed.', level: 8, color: 0xffd056, rarity: 'rare' },
  { id: 'king', kind: 'spray', name: 'Splat King', blurb: 'The victory mark.', level: 10, color: 0xff4d8d, rarity: 'epic' },
  { id: 'flutter', kind: 'spray', name: 'Evori Flutter', blurb: 'A pastel butterfly that lands on any wall.', level: 0, color: 0xffb8e6, price: 3, bundle: 'evori', rarity: 'rare' },
  { id: 'classic', kind: 'paint', name: 'Classic Capsule', blurb: 'Team color, straight from the hopper.', level: 1, color: 0xfff4ea },
  { id: 'magenta', kind: 'paint', name: 'Magenta Burst', blurb: 'A hot tint in every splat you throw.', level: 2, color: 0xff3d9a },
  { id: 'gold', kind: 'paint', name: 'Gold Capsule', blurb: 'Championship pigment. Hard to miss.', level: 7, color: 0xffd056, rarity: 'rare' },
  { id: 'void', kind: 'paint', name: 'Void Purple', blurb: 'Night-match ink.', level: 12, color: 0x9b6bff, rarity: 'epic' },
  { id: 'aurora', kind: 'paint', name: 'Aurora Dream', blurb: 'Rose and lilac, like the sky over the Evori fields.', level: 0, color: 0xe7a8ff, price: 4, bundle: 'evori', rarity: 'epic' },
]

export const DAILY_OFFERS = ['pip', 'clover', 'nibble']

export const LEVEL_CARDS = COSMETICS.filter((c) => c.kind === 'card' && c.price === undefined).map((c) => c.id)

export type Bundle = {
  id: string
  name: string
  tagline: string
  items: string[]
  price: number
}

export const BUNDLES: Bundle[] = [
  {
    id: 'evori',
    name: 'Evori Dream Wings',
    tagline: 'Pearl, pastel, and a little bit of night sky.',
    items: ['dreamwings', 'lumi', 'evoricard', 'flutter', 'aurora'],
    price: 20,
  },
]

export const PC_PER_TAGS = 3

export function cosmeticsOf(kind: ItemKind): Cosmetic[] {
  return COSMETICS.filter((c) => c.kind === kind)
}

export function cosmetic(id: string): Cosmetic {
  return COSMETICS.find((c) => c.id === id) ?? COSMETICS[0]!
}

export function bundleValue(bundle: Bundle): number {
  return bundle.items.reduce((sum, id) => sum + (cosmetic(id).price ?? 0), 0)
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
  damage: number
  shots: number
  hits: number
}, won: boolean): number {
  const acc = stats.shots > 0 ? stats.hits / stats.shots : 0
  return Math.round(80 + (won ? 220 : 40) + stats.tags * 36 + stats.assists * 18 + stats.damage * 0.12 + acc * 70)
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
