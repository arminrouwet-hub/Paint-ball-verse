export type Team = 'blue' | 'orange'
export type AgentId = 'vesper'
export type WeaponId = 'rapid' | 'sniper' | 'splash'
export type Difficulty = 'rookie' | 'veteran' | 'champion'
export type Life = 'alive' | 'dead'
export type Phase = 'countdown' | 'live' | 'end' | 'match'
export type PickupKind = 'speed' | 'hopper' | 'vest'
export type ShotKind = 'ball' | 'orb'

export type Vec3 = { x: number; y: number; z: number }

export type Body = {
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  radius: number
  height: number
  onGround: boolean
}

export type AABB = {
  minX: number
  minY: number
  minZ: number
  maxX: number
  maxY: number
  maxZ: number
}

export type Cylinder = {
  x: number
  z: number
  r: number
  minY: number
  maxY: number
}

export type Pit = {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
  y: number
}

export type Colliders = {
  boxes: AABB[]
  cylinders: Cylinder[]
  pits: Pit[]
}

export type RayHit = {
  t: number
  x: number
  y: number
  z: number
  nx: number
  ny: number
  nz: number
}

export type BoxDef = {
  x: number
  y: number
  z: number
  w: number
  h: number
  d: number
  color: number
}

export type CylDef = {
  x: number
  z: number
  r: number
  minY: number
  maxY: number
  color: number
}

export type Decor =
  | { kind: 'cone'; x: number; y: number; z: number; r: number; h: number; color: number }
  | { kind: 'sphere'; x: number; y: number; z: number; r: number; color: number }
  | { kind: 'box'; x: number; y: number; z: number; w: number; h: number; d: number; color: number }

export type Spawn = { x: number; z: number; yaw: number }

export type Waypoint = {
  x: number
  y: number
  z: number
  cover: boolean
  flank: boolean
}

export type FloorStyle =
  | 'warehouse'
  | 'canyon'
  | 'city'
  | 'forest'
  | 'skate'
  | 'stadium'
  | 'space'
  | 'pit'

export type MapDef = {
  id: string
  name: string
  tagline: string
  unlockLevel: number
  mutator: 'none' | 'lowgrav' | 'onegun'
  sky: number
  fog: number
  fogNear: number
  fogFar: number
  hemiSky: number
  hemiGround: number
  sun: number
  sunPos: [number, number, number]
  floor: number
  floorStyle: FloorStyle
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number }
  storm: { x: number; z: number; radius: number }
  boxes: BoxDef[]
  cylinders: CylDef[]
  pits: Pit[]
  decor: Decor[]
  spawnsA: Spawn[]
  spawnsB: Spawn[]
  waypoints: Waypoint[]
  pickups: { x: number; y: number; z: number }[]
}

export type Actor = Body & {
  id: number
  name: string
  isPlayer: boolean
  team: Team
  agentId: AgentId
  weaponId: WeaponId
  paintId: string
  cardId: string
  state: Life
  hp: number
  yaw: number
  pitch: number
  wishX: number
  wishZ: number
  wishSpeed: number
  wantJump: boolean
  ads: boolean
  moving: boolean
  ammo: number
  mag: number
  reloadLeft: number
  fireLeft: number
  sigCd: number
  ult: number
  hasteUntil: number
  blindUntil: number
  vest: boolean
  protectUntil: number
  spottedUntil: number
  knownUntil: number
  flashUntil: number
  hurtUntil: number
  hurtFromX: number
  hurtFromZ: number
  tags: number
  deaths: number
  assists: number
  damage: number
  shots: number
  hits: number
  headshots: number
  roundTags: number
  hurts: { id: number; time: number; amount: number }[]
  thinkAt: number
  waypointI: number
  strafe: number
  strafeUntil: number
  aimReadyAt: number
  targetId: number
  stuck: number
  lastX: number
  lastZ: number
  retreat: boolean
}

export type Projectile = {
  id: number
  kind: ShotKind
  ownerId: number
  team: Team
  weaponId: WeaponId | 'ability'
  shotId: number
  x: number
  y: number
  z: number
  px: number
  py: number
  pz: number
  vx: number
  vy: number
  vz: number
  gravity: number
  radius: number
  damage: number
  blast: number
  blastRadius: number
  life: number
  age: number
  arm: number
  color: number
  hitIds: number[]
  alive: boolean
}

export type Pickup = {
  id: number
  kind: PickupKind
  x: number
  y: number
  z: number
  active: boolean
  respawnAt: number
}

export type MatchConfig = {
  mapId: string
  difficulty: Difficulty
  teamSize: 3 | 4 | 5
  roundsToWin: 2 | 3
  storm: boolean
  lowgrav: boolean
  onegun: boolean
  weaponId: WeaponId
  agentId: AgentId
  cardId: string
  wrapId: string
  paintId: string
  sprayId: string
  buddyId: string
  pcBank: number
  ranked: boolean
  seed: number
  playerName: string
}

export type ControlSettings = {
  sensitivity: number
  invertY: boolean
  bob: boolean
}

export type InputState = {
  keys: Set<string>
  dx: number
  dy: number
  left: boolean
  leftEdge: boolean
  right: boolean
  midEdge: boolean
  reloadEdge: boolean
  abilityEdge: boolean
  ultEdge: boolean
  sprayEdge: boolean
  scoreboard: boolean
  pauseEdge: boolean
}

export type FeedItem = { id: number; text: string; tone: 'blue' | 'orange' | 'neutral' }

export type BoardRow = {
  name: string
  team: Team
  card: string
  weapon: string
  tags: number
  deaths: number
  assists: number
  damage: number
  you: boolean
  state: Life
}

export type Floater = { x: number; y: number; text: string; head: boolean }

export type FrameState = {
  hp: number
  dead: boolean
  spectate: string | null
  ammo: number
  mag: number
  reload: number
  weapon: string
  weaponId: WeaponId
  sigLabel: string
  ultLabel: string
  sigCd: number
  sigMax: number
  ult: number
  vest: boolean
  haste: number
  blind: number
  pc: number
  pcProgress: number
  blue: number
  orange: number
  need: number
  blueAlive: number
  orangeAlive: number
  timeLeft: number
  stormLeft: number
  stormOn: boolean
  stormClosing: boolean
  inStorm: boolean
  feed: FeedItem[]
  banner: string
  sub: string
  scope: boolean
  spread: number
  scoreboard: boolean
  rows: BoardRow[]
  low: number
  hurtAngle: number | null
  hitSeq: number
  hitHead: boolean
  floaters: Floater[]
  phase: Phase
  hint: string
  crosshair: boolean
  protect: boolean
  round: number
}

export type PersonalStats = {
  tags: number
  deaths: number
  assists: number
  damage: number
  shots: number
  hits: number
  headshots: number
}

export type UnlockNote = { name: string; kind: string }

export type MatchResult = {
  won: boolean
  blue: number
  orange: number
  ranked: boolean
  mapName: string
  difficulty: Difficulty
  stats: PersonalStats
  xp: number
  pcEarned: number
  pcTotal: number
  xpBefore: number
  srBefore: number
  srDelta: number
  unlocks: UnlockNote[]
}
