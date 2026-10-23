import type { BoxDef, CylDef, Decor, MapDef, Spawn, Waypoint } from './types.ts'

const WEST = -Math.PI / 2
const EAST = Math.PI / 2

function walls(boxes: BoxDef[], x0: number, x1: number, z0: number, z1: number, h: number, t: number, color: number): void {
  const cx = (x0 + x1) / 2
  const cz = (z0 + z1) / 2
  const w = x1 - x0
  const d = z1 - z0
  boxes.push({ x: cx, y: h / 2, z: z0 - t / 2, w: w + t * 2, h, d: t, color })
  boxes.push({ x: cx, y: h / 2, z: z1 + t / 2, w: w + t * 2, h, d: t, color })
  boxes.push({ x: x0 - t / 2, y: h / 2, z: cz, w: t, h, d, color })
  boxes.push({ x: x1 + t / 2, y: h / 2, z: cz, w: t, h, d, color })
}

function stairsZ(
  boxes: BoxDef[],
  x: number,
  edgeZ: number,
  sign: number,
  steps: number,
  stepH: number,
  stepD: number,
  width: number,
  color: number,
): void {
  for (let i = 0; i < steps; i++) {
    const h = stepH * (i + 1)
    const z = edgeZ + sign * (stepD * 0.5 + (steps - 1 - i) * stepD)
    boxes.push({ x, y: h / 2, z, w: width, h, d: stepD + 0.04, color })
  }
}

function stairsX(
  boxes: BoxDef[],
  z: number,
  edgeX: number,
  sign: number,
  steps: number,
  stepH: number,
  stepD: number,
  width: number,
  color: number,
): void {
  for (let i = 0; i < steps; i++) {
    const h = stepH * (i + 1)
    const x = edgeX + sign * (stepD * 0.5 + (steps - 1 - i) * stepD)
    boxes.push({ x, y: h / 2, z, w: stepD + 0.04, h, d: width, color })
  }
}

function spawns(x: number, zs: number[], yaw: number): Spawn[] {
  return zs.map((z) => ({ x, z, yaw }))
}

function wp(points: [number, number, number, boolean?, boolean?][]): Waypoint[] {
  return points.map(([x, y, z, cover, flank]) => ({
    x,
    y,
    z,
    cover: Boolean(cover),
    flank: Boolean(flank),
  }))
}

function shell(partial: Omit<MapDef, 'pits' | 'decor'> & { pits?: MapDef['pits']; decor?: Decor[] }): MapDef {
  return { pits: [], decor: [], ...partial }
}

function warehouse(): MapDef {
  const boxes: BoxDef[] = []
  const cylinders: CylDef[] = []
  const wall = 0x8e97ad
  const crate = 0xe08a2e
  const crate2 = 0xf0c14d
  const metal = 0x5d6e86
  walls(boxes, -32, 32, -20, 20, 6.2, 1, wall)
  for (const z of [-15, -9, -3, 3, 9, 15]) {
    boxes.push({ x: -14, y: 1.1, z, w: 2.5, h: 2.2, d: 2.5, color: z % 2 === 0 ? crate : crate2 })
    boxes.push({ x: 14, y: 1.1, z, w: 2.5, h: 2.2, d: 2.5, color: z % 2 === 0 ? crate2 : crate })
  }
  for (const x of [-6, 6]) {
    boxes.push({ x, y: 0.55, z: -8, w: 3.4, h: 1.1, d: 1.5, color: metal })
    boxes.push({ x, y: 0.55, z: 8, w: 3.4, h: 1.1, d: 1.5, color: metal })
  }
  boxes.push({ x: 0, y: 0.7, z: 0, w: 4.2, h: 1.4, d: 2.4, color: crate })
  boxes.push({ x: -22, y: 0.5, z: 0, w: 2.2, h: 1, d: 6, color: metal })
  boxes.push({ x: 22, y: 0.5, z: 0, w: 2.2, h: 1, d: 6, color: metal })
  const barrels: [number, number, number][] = [
    [-24, -12, 0x3c7dff],
    [-24, 12, 0xff7424],
    [24, -10, 0xff7424],
    [24, 11, 0x3c7dff],
    [0, -14, 0x3c7dff],
    [0, 14, 0xff7424],
    [-8, 0, 0xf0c14d],
    [8, 0, 0xf0c14d],
  ]
  for (const [x, z, color] of barrels) cylinders.push({ x, z, r: 0.5, minY: 0, maxY: 1.1, color })
  return shell({
    id: 'warehouse',
    name: 'Warehouse',
    tagline: 'Tight lanes, stacked crates, no room to miss.',
    unlockLevel: 1,
    mutator: 'none',
    sky: 0x8ec5ff,
    fog: 0xb7d4f5,
    fogNear: 36,
    fogFar: 110,
    hemiSky: 0xd7ecff,
    hemiGround: 0x8a7560,
    sun: 0xfff3d6,
    sunPos: [28, 46, 18],
    floor: 0xb7b1a8,
    floorStyle: 'warehouse',
    bounds: { minX: -32, maxX: 32, minZ: -20, maxZ: 20 },
    storm: { x: 0, z: 0, radius: 40 },
    boxes,
    cylinders,
    spawnsA: spawns(-27, [-8, -4, 0, 4, 8], WEST),
    spawnsB: spawns(27, [-8, -4, 0, 4, 8], EAST),
    waypoints: wp([
      [-24, 0, -16, true],
      [-24, 0, 0, true],
      [-24, 0, 16, true],
      [-10, 0, -16],
      [-10, 0, -6, true],
      [-10, 0, 6, true],
      [-10, 0, 16],
      [-4, 0, -14],
      [-4, 0, 0],
      [-4, 0, 14],
      [4, 0, -14],
      [4, 0, 0],
      [4, 0, 14],
      [10, 0, -16],
      [10, 0, 0, true],
      [10, 0, 16],
      [24, 0, -12, true],
      [24, 0, 12, true],
      [0, 0, -12],
      [0, 0, 12],
      [-18, 0, -8, false, true],
      [18, 0, 8, false, true],
    ]),
    pickups: [
      { x: 0, y: 0, z: -6 },
      { x: -20, y: 0, z: 6 },
      { x: 20, y: 0, z: -6 },
      { x: 0, y: 0, z: 6 },
    ],
  })
}

function canyon(): MapDef {
  const boxes: BoxDef[] = []
  const cylinders: CylDef[] = []
  const rockA = 0xd08a55
  const rockB = 0xb5643e
  const rockC = 0xe3b57a
  const ridge = 0xc47a48
  walls(boxes, -48, 48, -28, 28, 7, 1.2, 0xa86848)
  boxes.push({ x: 0, y: 1.6, z: 21.5, w: 78, h: 3.2, d: 11, color: ridge })
  boxes.push({ x: 0, y: 1.6, z: -21.5, w: 78, h: 3.2, d: 11, color: ridge })
  for (const x of [-22, 0, 22]) {
    stairsZ(boxes, x, 16, -1, 8, 0.4, 0.85, 5, rockC)
    stairsZ(boxes, x, -16, 1, 8, 0.4, 0.85, 5, rockC)
  }
  const rocks: BoxDef[] = [
    { x: -18, y: 1.3, z: 2, w: 5, h: 2.6, d: 4, color: rockA },
    { x: -6, y: 0.9, z: -5, w: 4.5, h: 1.8, d: 3.5, color: rockB },
    { x: 8, y: 1.5, z: 4, w: 4, h: 3, d: 4, color: rockA },
    { x: 20, y: 1.1, z: -3, w: 5, h: 2.2, d: 4.5, color: rockC },
    { x: -32, y: 1.6, z: -8, w: 6, h: 3.2, d: 5, color: rockB },
    { x: 30, y: 1.2, z: 8, w: 5, h: 2.4, d: 6, color: rockA },
    { x: 0, y: 0.7, z: 0, w: 3.2, h: 1.4, d: 3.2, color: rockC },
    { x: -40, y: 1, z: 10, w: 4, h: 2, d: 4, color: rockB },
    { x: 40, y: 1.4, z: -12, w: 4.5, h: 2.8, d: 4, color: rockA },
    { x: 12, y: 0.6, z: -12, w: 3, h: 1.2, d: 2.4, color: rockC },
    { x: -12, y: 0.6, z: 12, w: 3, h: 1.2, d: 2.4, color: rockC },
  ]
  boxes.push(...rocks)
  cylinders.push({ x: -2, z: 8, r: 1.3, minY: 0, maxY: 2.1, color: rockB })
  cylinders.push({ x: 16, z: 0, r: 1.1, minY: 0, maxY: 1.6, color: rockA })
  cylinders.push({ x: -24, z: -2, r: 0.9, minY: 0, maxY: 1.4, color: rockC })
  return shell({
    id: 'canyon',
    name: 'Canyon',
    tagline: 'Long sightlines and ridges built for the pump.',
    unlockLevel: 1,
    mutator: 'none',
    sky: 0x79c8ff,
    fog: 0xf0c49a,
    fogNear: 40,
    fogFar: 160,
    hemiSky: 0xffe0b8,
    hemiGround: 0xa06a42,
    sun: 0xfff0d0,
    sunPos: [20, 50, -10],
    floor: 0xe6c08a,
    floorStyle: 'canyon',
    bounds: { minX: -48, maxX: 48, minZ: -28, maxZ: 28 },
    storm: { x: 0, z: 0, radius: 58 },
    boxes,
    cylinders,
    spawnsA: spawns(-40, [-6, -3, 0, 3, 6], WEST),
    spawnsB: spawns(40, [-6, -3, 0, 3, 6], EAST),
    waypoints: wp([
      [-36, 0, -10],
      [-36, 0, 10],
      [-24, 0, 0, true],
      [-16, 0, -12],
      [-16, 0, 12],
      [-8, 0, 0],
      [0, 0, -8],
      [0, 0, 8],
      [8, 0, 0, true],
      [18, 0, -10],
      [18, 0, 10],
      [32, 0, 0],
      [36, 0, -8],
      [-22, 3.2, 20, true, true],
      [0, 3.2, 20, true, true],
      [22, 3.2, 20, true, true],
      [-22, 3.2, -20, true, true],
      [0, 3.2, -20, true, true],
      [22, 3.2, -20, true, true],
      [-30, 0, 6, false, true],
      [30, 0, -6, false, true],
    ]),
    pickups: [
      { x: 0, y: 0, z: 0 },
      { x: -20, y: 0, z: 6 },
      { x: 20, y: 0, z: -6 },
      { x: 0, y: 3.2, z: 20 },
      { x: 0, y: 3.2, z: -20 },
    ],
  })
}

function splitWallX(
  boxes: BoxDef[],
  x0: number,
  x1: number,
  z: number,
  t: number,
  wallH: number,
  color: number,
  door: boolean,
): void {
  const sill = 1.15
  const lintel = 3.2
  const gap = 3.3
  const mid = (x0 + x1) / 2
  const spans: [number, number][] = door
    ? [
        [x0, mid - gap / 2],
        [mid + gap / 2, x1],
      ]
    : [[x0, x1]]
  for (const [a, b] of spans) {
    if (b - a < 0.4) continue
    const xc = (a + b) / 2
    const len = b - a
    if (door) {
      boxes.push({ x: xc, y: wallH / 2, z, w: len, h: wallH, d: t, color })
    } else {
      boxes.push({ x: xc, y: sill / 2, z, w: len, h: sill, d: t, color })
      const uh = wallH - lintel
      boxes.push({ x: xc, y: lintel + uh / 2, z, w: len, h: uh, d: t, color })
    }
  }
}

function splitWallZ(
  boxes: BoxDef[],
  z0: number,
  z1: number,
  x: number,
  t: number,
  wallH: number,
  color: number,
  door: boolean,
): void {
  const sill = 1.15
  const lintel = 3.2
  const gap = 3.3
  const mid = (z0 + z1) / 2
  const spans: [number, number][] = door
    ? [
        [z0, mid - gap / 2],
        [mid + gap / 2, z1],
      ]
    : [[z0, z1]]
  for (const [a, b] of spans) {
    if (b - a < 0.4) continue
    const zc = (a + b) / 2
    const len = b - a
    if (door) {
      boxes.push({ x, y: wallH / 2, z: zc, w: t, h: wallH, d: len, color })
    } else {
      boxes.push({ x, y: sill / 2, z: zc, w: t, h: sill, d: len, color })
      const uh = wallH - lintel
      boxes.push({ x, y: lintel + uh / 2, z: zc, w: t, h: uh, d: len, color })
    }
  }
}

function building(
  boxes: BoxDef[],
  cx: number,
  cz: number,
  w: number,
  d: number,
  h: number,
  color: number,
  door: 'n' | 's' | 'e' | 'w',
): void {
  const t = 0.7
  const x0 = cx - w / 2
  const x1 = cx + w / 2
  const z0 = cz - d / 2
  const z1 = cz + d / 2
  splitWallX(boxes, x0, x1, z0, t, h, color, door === 's')
  splitWallX(boxes, x0, x1, z1, t, h, color, door === 'n')
  splitWallZ(boxes, z0, z1, x0, t, h, color, door === 'w')
  splitWallZ(boxes, z0, z1, x1, t, h, color, door === 'e')
  boxes.push({ x: cx, y: 0.55, z: cz, w: 2.2, h: 1.1, d: 2.2, color: 0xf2d3a2 })
}

function city(): MapDef {
  const boxes: BoxDef[] = []
  const cylinders: CylDef[] = []
  walls(boxes, -38, 38, -38, 38, 8, 1, 0x6e7c93)
  building(boxes, -16, -16, 16, 16, 7, 0xf27d6b, 'e')
  building(boxes, 16, -16, 16, 16, 7, 0x6ec8c4, 'w')
  building(boxes, -16, 16, 16, 16, 7, 0xf2d36b, 'e')
  building(boxes, 16, 16, 16, 16, 7, 0x8ea2ff, 'w')
  boxes.push({ x: -16, y: 0.6, z: -6.2, w: 5, h: 1.2, d: 3.2, color: 0xdfe7f2 })
  stairsX(boxes, -6.2, -16 + 2.6, 1, 3, 0.4, 0.9, 4, 0xdfe7f2)
  boxes.push({ x: 16, y: 0.6, z: 6.2, w: 5, h: 1.2, d: 3.2, color: 0xdfe7f2 })
  stairsX(boxes, 6.2, 16 - 2.6, -1, 3, 0.4, 0.9, 4, 0xdfe7f2)
  for (const [x, z] of [
    [0, 0],
    [0, -28],
    [0, 28],
    [-28, 0],
    [28, 0],
  ] as const) {
    boxes.push({ x, y: 0.55, z, w: 2.4, h: 1.1, d: 2.4, color: 0xff8f3a })
  }
  cylinders.push({ x: -4, z: -28, r: 0.7, minY: 0, maxY: 1, color: 0x3c7dff })
  cylinders.push({ x: 4, z: 28, r: 0.7, minY: 0, maxY: 1, color: 0xff7424 })
  cylinders.push({ x: -28, z: 8, r: 0.55, minY: 0, maxY: 1.3, color: 0x6b8f71 })
  cylinders.push({ x: 28, z: -8, r: 0.55, minY: 0, maxY: 1.3, color: 0x6b8f71 })
  return shell({
    id: 'city',
    name: 'City Block',
    tagline: 'Windows, doorways, and angles on every street.',
    unlockLevel: 1,
    mutator: 'none',
    sky: 0x9fd4ff,
    fog: 0xc5dff8,
    fogNear: 34,
    fogFar: 120,
    hemiSky: 0xe4f3ff,
    hemiGround: 0x7d6a58,
    sun: 0xfff6e0,
    sunPos: [24, 48, 20],
    floor: 0x9aa3b2,
    floorStyle: 'city',
    bounds: { minX: -38, maxX: 38, minZ: -38, maxZ: 38 },
    storm: { x: 0, z: 0, radius: 52 },
    boxes,
    cylinders,
    spawnsA: spawns(-32, [-8, -4, 0, 4, 8], WEST),
    spawnsB: spawns(32, [-8, -4, 0, 4, 8], EAST),
    waypoints: wp([
      [-30, 0, -14],
      [-30, 0, 14],
      [-16, 0, -16],
      [-16, 0, 0],
      [-16, 0, 16],
      [0, 0, -20],
      [0, 0, -6],
      [0, 0, 6],
      [0, 0, 20],
      [16, 0, -16],
      [16, 0, 0],
      [16, 0, 16],
      [30, 0, -14],
      [30, 0, 14],
      [-6, 0, -30, false, true],
      [6, 0, 30, false, true],
      [-30, 0, 0, true],
      [30, 0, 0, true],
      [-8, 1.2, -6.2, true],
      [8, 1.2, 6.2, true],
    ]),
    pickups: [
      { x: 0, y: 0, z: 0 },
      { x: -16, y: 0, z: 0 },
      { x: 16, y: 0, z: 0 },
      { x: 0, y: 0, z: -16 },
      { x: 0, y: 0, z: 16 },
    ],
  })
}

function forest(): MapDef {
  const boxes: BoxDef[] = []
  const cylinders: CylDef[] = []
  const decor: Decor[] = []
  walls(boxes, -42, 42, -42, 42, 6, 1, 0x2f6a3a)
  const trees: [number, number, number][] = [
    [-30, -28, 1],
    [-24, -30, 0.8],
    [-34, -18, 1.1],
    [-28, -12, 0.9],
    [-36, -4, 1],
    [-30, 6, 0.85],
    [-34, 16, 1.15],
    [-26, 24, 0.9],
    [-32, 30, 1],
    [-18, -32, 0.8],
    [-12, -24, 1.05],
    [-16, -16, 0.75],
    [-8, -34, 1],
    [-18, 18, 1.1],
    [-10, 28, 0.9],
    [-20, 8, 0.7],
    [30, 26, 1],
    [24, 32, 0.85],
    [34, 14, 1.1],
    [26, 8, 0.8],
    [36, -2, 1],
    [28, -12, 0.95],
    [34, -20, 1.05],
    [24, -28, 0.8],
    [16, 30, 0.9],
    [8, -30, 1],
    [14, -18, 0.75],
    [18, 16, 1.1],
    [10, 18, 0.7],
    [-4, 20, 0.85],
    [4, -16, 0.8],
    [0, 32, 1],
    [0, -36, 0.9],
    [-6, 4, 0.65],
    [8, 4, 0.7],
  ]
  for (const [x, z, s] of trees) {
    const h = 3.4 * s
    cylinders.push({ x, z, r: 0.38 * s, minY: 0, maxY: h * 0.42, color: 0x6a4328 })
    decor.push({
      kind: 'cone',
      x,
      y: h * 0.42 + h * 0.34,
      z,
      r: 1.35 * s,
      h: h * 0.78,
      color: s > 0.95 ? 0x2f9d4a : 0x3cbf62,
    })
  }
  const logs: BoxDef[] = [
    { x: -8, y: 0.35, z: -6, w: 4.5, h: 0.7, d: 1.1, color: 0x7a5132 },
    { x: 10, y: 0.35, z: 8, w: 1.1, h: 0.7, d: 4.2, color: 0x7a5132 },
    { x: 0, y: 0.45, z: 0, w: 2.4, h: 0.9, d: 1.6, color: 0x8d6240 },
    { x: -20, y: 0.7, z: 0, w: 3.2, h: 1.4, d: 2.4, color: 0x80858a },
    { x: 22, y: 0.8, z: -4, w: 2.6, h: 1.6, d: 2.2, color: 0x80858a },
    { x: 6, y: 0.55, z: -8, w: 2, h: 1.1, d: 1.6, color: 0x9aa0a6 },
  ]
  boxes.push(...logs)
  return shell({
    id: 'forest',
    name: 'Pine Forest',
    tagline: 'Trunks, logs, and ambush lines in the needles.',
    unlockLevel: 1,
    mutator: 'none',
    sky: 0xb7e6ff,
    fog: 0xc6ecd4,
    fogNear: 28,
    fogFar: 100,
    hemiSky: 0xe5fff0,
    hemiGround: 0x4e6a3a,
    sun: 0xfff8e4,
    sunPos: [-18, 44, 22],
    floor: 0x6ea84e,
    floorStyle: 'forest',
    bounds: { minX: -42, maxX: 42, minZ: -42, maxZ: 42 },
    storm: { x: 0, z: 0, radius: 56 },
    boxes,
    cylinders,
    decor,
    spawnsA: spawns(-34, [-8, -4, 0, 4, 8], WEST),
    spawnsB: spawns(34, [-8, -4, 0, 4, 8], EAST),
    waypoints: wp([
      [-28, 0, -20],
      [-28, 0, 0, true],
      [-28, 0, 20],
      [-14, 0, -22, true],
      [-14, 0, 10],
      [-6, 0, -2, true],
      [0, 0, 12],
      [0, 0, -20],
      [8, 0, 2, true],
      [14, 0, -14],
      [14, 0, 20, true],
      [26, 0, -8],
      [26, 0, 12],
      [32, 0, 0],
      [-20, 0, 14, false, true],
      [18, 0, -22, false, true],
      [-4, 0, 24, false, true],
      [4, 0, -28, false, true],
    ]),
    pickups: [
      { x: 0, y: 0, z: 0 },
      { x: -16, y: 0, z: 6 },
      { x: 16, y: 0, z: -6 },
      { x: 0, y: 0, z: 18 },
    ],
  })
}

function skate(): MapDef {
  const boxes: BoxDef[] = []
  const concrete = 0xd5d8e0
  const pink = 0xff5ca8
  const cyan = 0x3de1ff
  const yellow = 0xffe14a
  walls(boxes, -28, 28, -18, 18, 5, 1, 0x2a3148)
  boxes.push({ x: -22, y: 1.3, z: 0, w: 10, h: 2.6, d: 16, color: concrete })
  boxes.push({ x: 22, y: 1.3, z: 0, w: 10, h: 2.6, d: 16, color: concrete })
  stairsX(boxes, -6, -17, 1, 6, 0.43, 0.85, 5, cyan)
  stairsX(boxes, 6, -17, 1, 6, 0.43, 0.85, 5, cyan)
  stairsX(boxes, -6, 17, -1, 6, 0.43, 0.85, 5, pink)
  stairsX(boxes, 6, 17, -1, 6, 0.43, 0.85, 5, pink)
  boxes.push({ x: 0, y: 1.1, z: 14, w: 18, h: 2.2, d: 7, color: concrete })
  stairsZ(boxes, -6, 10.5, -1, 5, 0.44, 0.85, 4.5, yellow)
  stairsZ(boxes, 6, 10.5, -1, 5, 0.44, 0.85, 4.5, yellow)
  stairsX(boxes, 0, 0, -1, 6, 0.4, 0.8, 4, pink)
  stairsX(boxes, 0, 0, 1, 6, 0.4, 0.8, 4, cyan)
  boxes.push({ x: -22, y: 2.85, z: -4, w: 6, h: 0.35, d: 0.35, color: yellow })
  boxes.push({ x: 22, y: 2.85, z: 4, w: 6, h: 0.35, d: 0.35, color: pink })
  boxes.push({ x: -8, y: 0.45, z: -10, w: 3, h: 0.9, d: 2, color: cyan })
  boxes.push({ x: 8, y: 0.45, z: -10, w: 3, h: 0.9, d: 2, color: pink })
  return shell({
    id: 'skate',
    name: 'Skate Park',
    tagline: 'Decks, banks, and a spine down the middle.',
    unlockLevel: 1,
    mutator: 'none',
    sky: 0x8ec8ff,
    fog: 0xd5e6ff,
    fogNear: 30,
    fogFar: 100,
    hemiSky: 0xe7f4ff,
    hemiGround: 0x6e7388,
    sun: 0xfff7ea,
    sunPos: [16, 40, 24],
    floor: 0xc8ccd6,
    floorStyle: 'skate',
    bounds: { minX: -28, maxX: 28, minZ: -18, maxZ: 18 },
    storm: { x: 0, z: 0, radius: 34 },
    boxes,
    cylinders: [],
    decor: [
      { kind: 'sphere', x: -22, y: 3.3, z: 5, r: 0.45, color: pink },
      { kind: 'sphere', x: 22, y: 3.3, z: -5, r: 0.45, color: cyan },
    ],
    spawnsA: spawns(-22, [-5, -2, 0, 2, 5], WEST),
    spawnsB: spawns(22, [-5, -2, 0, 2, 5], EAST),
    waypoints: wp([
      [-22, 2.6, -4, true],
      [-22, 2.6, 4, true],
      [22, 2.6, -4, true],
      [22, 2.6, 4, true],
      [0, 2.2, 14, true, true],
      [-6, 2.2, 14, true],
      [6, 2.2, 14, true],
      [-10, 0, -8],
      [10, 0, -8],
      [0, 0, -12],
      [0, 0, 4],
      [-12, 0, 8, false, true],
      [12, 0, 8, false, true],
      [-4, 2.4, 0, true],
      [4, 2.4, 0, true],
    ]),
    pickups: [
      { x: 0, y: 2.4, z: 0 },
      { x: -22, y: 2.6, z: 0 },
      { x: 22, y: 2.6, z: 0 },
      { x: 0, y: 2.2, z: 14 },
    ],
  })
}

function mirror4(boxes: BoxDef[], b: BoxDef): void {
  const seen = new Set<string>()
  for (const sx of [1, -1]) {
    for (const sz of [1, -1]) {
      const nb = { ...b, x: b.x * sx, z: b.z * sz }
      const key = `${nb.x.toFixed(2)}|${nb.z.toFixed(2)}|${nb.w}|${nb.d}|${nb.h}`
      if (seen.has(key)) continue
      seen.add(key)
      boxes.push(nb)
    }
  }
}

function stadium(): MapDef {
  const boxes: BoxDef[] = []
  walls(boxes, -36, 36, -20, 20, 6, 1, 0x16343a)
  mirror4(boxes, { x: -12, y: 0.6, z: 7, w: 3.2, h: 1.2, d: 3.2, color: 0x2ec4b6 })
  mirror4(boxes, { x: -20, y: 1.15, z: 13, w: 2.4, h: 2.3, d: 8, color: 0x1d4e89 })
  mirror4(boxes, { x: -24, y: 0.5, z: 4, w: 4.2, h: 1, d: 1.8, color: 0xf2c14e })
  mirror4(boxes, { x: -8, y: 0.45, z: 14, w: 3, h: 0.9, d: 2, color: 0xff6b6b })
  boxes.push({ x: 0, y: 1.35, z: 0, w: 2.4, h: 2.7, d: 2.4, color: 0xf6f1e7 })
  boxes.push({ x: 0, y: 1.15, z: 10, w: 1.8, h: 2.3, d: 4.2, color: 0xf6f1e7 })
  boxes.push({ x: 0, y: 1.15, z: -10, w: 1.8, h: 2.3, d: 4.2, color: 0xf6f1e7 })
  return shell({
    id: 'stadium',
    name: 'Paint Stadium',
    tagline: 'A clean three-lane field. Best of five lives here.',
    unlockLevel: 1,
    mutator: 'none',
    sky: 0xc9e7ff,
    fog: 0xd5eef8,
    fogNear: 36,
    fogFar: 120,
    hemiSky: 0xf3fbff,
    hemiGround: 0x245e66,
    sun: 0xffffff,
    sunPos: [10, 52, 8],
    floor: 0x1c6b73,
    floorStyle: 'stadium',
    bounds: { minX: -36, maxX: 36, minZ: -20, maxZ: 20 },
    storm: { x: 0, z: 0, radius: 42 },
    boxes,
    cylinders: [
      { x: -28, z: 0, r: 0.7, minY: 0, maxY: 1.2, color: 0x3c7dff },
      { x: 28, z: 0, r: 0.7, minY: 0, maxY: 1.2, color: 0xff7424 },
    ],
    spawnsA: spawns(-30, [-8, -4, 0, 4, 8], WEST),
    spawnsB: spawns(30, [-8, -4, 0, 4, 8], EAST),
    waypoints: wp([
      [-28, 0, -12, false, true],
      [-28, 0, 0],
      [-28, 0, 12, false, true],
      [-18, 0, -8, true],
      [-18, 0, 8, true],
      [-10, 0, 0],
      [-10, 0, -14, true],
      [-10, 0, 14, true],
      [0, 0, -6],
      [0, 0, 6],
      [10, 0, 0],
      [10, 0, -14, true],
      [10, 0, 14, true],
      [18, 0, -8, true],
      [18, 0, 8, true],
      [28, 0, -12, false, true],
      [28, 0, 0],
      [28, 0, 12, false, true],
    ]),
    pickups: [
      { x: 0, y: 0, z: 0 },
      { x: -16, y: 0, z: 0 },
      { x: 16, y: 0, z: 0 },
      { x: 0, y: 0, z: 14 },
      { x: 0, y: 0, z: -14 },
    ],
  })
}

function zerog(): MapDef {
  const boxes: BoxDef[] = []
  walls(boxes, -22, 22, -22, 22, 8, 1, 0x3a2a6a)
  const plats: BoxDef[] = [
    { x: 0, y: 0.25, z: 0, w: 8, h: 0.5, d: 8, color: 0xff4d8d },
    { x: -11, y: 2.3, z: -9, w: 6, h: 0.45, d: 6, color: 0x3de1ff },
    { x: 11, y: 2.5, z: 9, w: 6, h: 0.45, d: 6, color: 0xffe14a },
    { x: -9, y: 4.3, z: 9, w: 5, h: 0.45, d: 5, color: 0xb388ff },
    { x: 10, y: 4.5, z: -8, w: 5, h: 0.45, d: 5, color: 0x5dff9a },
    { x: 0, y: 6.3, z: 0, w: 5.5, h: 0.45, d: 5.5, color: 0xfff4ea },
    { x: -15, y: 3.2, z: 2, w: 4, h: 0.4, d: 4, color: 0xff7424 },
    { x: 15, y: 3.1, z: -2, w: 4, h: 0.4, d: 4, color: 0x3c7dff },
    { x: 0, y: 3.6, z: -14, w: 5, h: 0.4, d: 4, color: 0xff4d8d },
    { x: 0, y: 3.4, z: 14, w: 5, h: 0.4, d: 4, color: 0x3de1ff },
  ]
  boxes.push(...plats)
  return shell({
    id: 'zerog',
    name: 'Zero-G Yard',
    tagline: 'Bonus arena. Jumps hang and paint falls slow.',
    unlockLevel: 3,
    mutator: 'lowgrav',
    sky: 0x1b1140,
    fog: 0x3a2468,
    fogNear: 24,
    fogFar: 80,
    hemiSky: 0xc8b6ff,
    hemiGround: 0x2a1848,
    sun: 0xffe8ff,
    sunPos: [12, 36, 10],
    floor: 0x2a1a52,
    floorStyle: 'space',
    bounds: { minX: -22, maxX: 22, minZ: -22, maxZ: 22 },
    storm: { x: 0, z: 0, radius: 30 },
    boxes,
    cylinders: [],
    decor: [
      { kind: 'sphere', x: -18, y: 6, z: -18, r: 0.6, color: 0xffe14a },
      { kind: 'sphere', x: 18, y: 7, z: 16, r: 0.45, color: 0x3de1ff },
      { kind: 'sphere', x: 16, y: 5, z: -16, r: 0.35, color: 0xff4d8d },
    ],
    spawnsA: spawns(-16, [-6, -3, 0, 3, 6], WEST),
    spawnsB: spawns(16, [-6, -3, 0, 3, 6], EAST),
    waypoints: wp([
      [-16, 0, 0],
      [16, 0, 0],
      [0, 0.5, 0],
      [-11, 2.55, -9, true],
      [11, 2.75, 9, true],
      [-9, 4.55, 9, true, true],
      [10, 4.75, -8, true, true],
      [0, 6.55, 0, true],
      [-15, 3.4, 2],
      [15, 3.3, -2],
      [0, 3.8, -14, false, true],
      [0, 3.6, 14, false, true],
    ]),
    pickups: [
      { x: 0, y: 0.5, z: 0 },
      { x: 0, y: 6.55, z: 0 },
      { x: -11, y: 2.55, z: -9 },
      { x: 11, y: 2.75, z: 9 },
    ],
  })
}

function hopper(): MapDef {
  const boxes: BoxDef[] = []
  walls(boxes, -16, 16, -12, 12, 5, 0.8, 0x241824)
  mirror4(boxes, { x: -6, y: 0.6, z: 4, w: 2.6, h: 1.2, d: 2.6, color: 0xff4d8d })
  mirror4(boxes, { x: -10, y: 1, z: 0, w: 1.6, h: 2, d: 4, color: 0x3c7dff })
  boxes.push({ x: 0, y: 0.7, z: 0, w: 2, h: 1.4, d: 6, color: 0xffe14a })
  return shell({
    id: 'hopper',
    name: 'Hopper Pit',
    tagline: 'Bonus arena. One marker for everybody. No excuses.',
    unlockLevel: 5,
    mutator: 'onegun',
    sky: 0xffd9c8,
    fog: 0xffc9b0,
    fogNear: 18,
    fogFar: 60,
    hemiSky: 0xfff0e8,
    hemiGround: 0x6a3a4a,
    sun: 0xfff6ee,
    sunPos: [8, 30, 12],
    floor: 0x5a2a3a,
    floorStyle: 'pit',
    bounds: { minX: -16, maxX: 16, minZ: -12, maxZ: 12 },
    storm: { x: 0, z: 0, radius: 22 },
    boxes,
    cylinders: [],
    spawnsA: spawns(-12, [-4, -2, 0, 2, 4], WEST),
    spawnsB: spawns(12, [-4, -2, 0, 2, 4], EAST),
    waypoints: wp([
      [-12, 0, -6],
      [-12, 0, 6],
      [-6, 0, 0, true],
      [0, 0, -6],
      [0, 0, 6],
      [6, 0, 0, true],
      [12, 0, -6],
      [12, 0, 6],
      [-8, 0, 4, false, true],
      [8, 0, -4, false, true],
    ]),
    pickups: [
      { x: 0, y: 0, z: 4 },
      { x: 0, y: 0, z: -4 },
      { x: -8, y: 0, z: 0 },
      { x: 8, y: 0, z: 0 },
    ],
  })
}

export const MAPS: MapDef[] = [warehouse(), canyon(), city(), forest(), skate(), stadium(), zerog(), hopper()]

export function mapById(id: string): MapDef {
  return MAPS.find((m) => m.id === id) ?? MAPS[0]!
}

export const BASE_MAP_IDS = ['warehouse', 'canyon', 'city', 'forest', 'skate', 'stadium']
