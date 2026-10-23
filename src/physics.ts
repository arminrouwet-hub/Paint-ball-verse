import type { AABB, Body, Colliders, Cylinder, RayHit } from './types.ts'

export const BODY_RADIUS = 0.38
export const BODY_HEIGHT = 1.72
export const STEP_HEIGHT = 0.48
export const EYE = 1.56

export function steer(
  body: Body,
  wishX: number,
  wishZ: number,
  wishSpeed: number,
  dt: number,
  airborne: boolean,
): void {
  const speed = Math.hypot(body.vx, body.vz)
  if (!airborne && speed > 0.001) {
    const drop = speed * 9.5 * dt
    const next = Math.max(0, speed - drop) / speed
    body.vx *= next
    body.vz *= next
  }
  const len = Math.hypot(wishX, wishZ)
  if (len < 0.001 || wishSpeed <= 0) return
  const wx = wishX / len
  const wz = wishZ / len
  const current = body.vx * wx + body.vz * wz
  const add = wishSpeed - current
  if (add <= 0) return
  const accel = airborne ? 18 : 86
  let gain = accel * dt * wishSpeed
  if (gain > add) gain = add
  body.vx += wx * gain
  body.vz += wz * gain
}

export function simulate(body: Body, dt: number, col: Colliders, gravity: number): void {
  const speed = Math.hypot(body.vx, body.vz, body.vy)
  const steps = Math.min(8, Math.max(1, Math.ceil((speed * dt) / 0.22), Math.ceil(dt / 0.01)))
  const sdt = dt / steps
  for (let i = 0; i < steps; i++) {
    body.vy -= gravity * sdt
    body.x += body.vx * sdt
    resolveBoxes(body, col.boxes, 'x')
    body.z += body.vz * sdt
    resolveBoxes(body, col.boxes, 'z')
    resolveCylinders(body, col.cylinders)
    body.y += body.vy * sdt
    resolveCeiling(body, col.boxes)
    const floor = support(col, body.x, body.z, body.y)
    if (body.y <= floor + 0.001 && (body.vy <= 0.02 || floor - body.y <= STEP_HEIGHT)) {
      body.y = floor
      if (body.vy < 0) body.vy = 0
      body.onGround = true
    } else {
      body.onGround = false
    }
  }
}

export function depenetrate(body: Body, col: Colliders): void {
  resolveBoxes(body, col.boxes, 'x')
  resolveBoxes(body, col.boxes, 'z')
  resolveCylinders(body, col.cylinders)
  const floor = support(col, body.x, body.z, body.y)
  if (body.y < floor && floor - body.y < 2.5) body.y = floor
}

function blocks(feet: number, height: number, minY: number, maxY: number): boolean {
  if (maxY <= feet + STEP_HEIGHT) return false
  if (minY >= feet + height - 0.05) return false
  return true
}

function resolveBoxes(body: Body, boxes: AABB[], axis: 'x' | 'z'): void {
  for (const b of boxes) {
    if (!blocks(body.y, body.height, b.minY, b.maxY)) continue
    if (axis === 'x') {
      if (body.z + body.radius <= b.minZ || body.z - body.radius >= b.maxZ) continue
      if (body.x + body.radius <= b.minX || body.x - body.radius >= b.maxX) continue
      const pushRight = b.maxX + body.radius - body.x
      const pushLeft = body.x - (b.minX - body.radius)
      if (pushRight < pushLeft) {
        body.x += pushRight
        if (body.vx < 0) body.vx = 0
      } else {
        body.x -= pushLeft
        if (body.vx > 0) body.vx = 0
      }
    } else {
      if (body.x + body.radius <= b.minX || body.x - body.radius >= b.maxX) continue
      if (body.z + body.radius <= b.minZ || body.z - body.radius >= b.maxZ) continue
      const pushFwd = b.maxZ + body.radius - body.z
      const pushBack = body.z - (b.minZ - body.radius)
      if (pushFwd < pushBack) {
        body.z += pushFwd
        if (body.vz < 0) body.vz = 0
      } else {
        body.z -= pushBack
        if (body.vz > 0) body.vz = 0
      }
    }
  }
}

function resolveCylinders(body: Body, cylinders: Cylinder[]): void {
  for (const c of cylinders) {
    if (!blocks(body.y, body.height, c.minY, c.maxY)) continue
    let dx = body.x - c.x
    let dz = body.z - c.z
    let dist = Math.hypot(dx, dz)
    const min = c.r + body.radius
    if (dist >= min) continue
    if (dist < 1e-4) {
      dx = 1
      dz = 0
      dist = 1
    }
    const scale = (min - dist) / dist
    body.x += dx * scale
    body.z += dz * scale
    const nx = dx / dist
    const nz = dz / dist
    const vn = body.vx * nx + body.vz * nz
    if (vn < 0) {
      body.vx -= vn * nx
      body.vz -= vn * nz
    }
  }
}

function resolveCeiling(body: Body, boxes: AABB[]): void {
  const head = body.y + body.height
  for (const b of boxes) {
    if (b.minY <= body.y + 0.75) continue
    if (head <= b.minY || body.y >= b.minY) continue
    if (body.x + body.radius <= b.minX || body.x - body.radius >= b.maxX) continue
    if (body.z + body.radius <= b.minZ || body.z - body.radius >= b.maxZ) continue
    body.y = b.minY - body.height
    if (body.vy > 0) body.vy = 0
  }
}

function baseFloor(col: Colliders, x: number, z: number): number {
  let y = 0
  for (const p of col.pits) {
    if (x >= p.minX && x <= p.maxX && z >= p.minZ && z <= p.maxZ) y = Math.min(y, p.y)
  }
  return y
}

/** Highest walkable top at this column, including decks and barrel caps. */
export function standHeight(col: Colliders, x: number, z: number): number {
  let y = baseFloor(col, x, z)
  for (const b of col.boxes) {
    if (x < b.minX || x > b.maxX || z < b.minZ || z > b.maxZ) continue
    if (b.maxY > y && b.maxY < 8) y = b.maxY
  }
  for (const c of col.cylinders) {
    const dx = x - c.x
    const dz = z - c.z
    if (dx * dx + dz * dz > c.r * c.r) continue
    if (c.maxY > y && c.maxY < 2.2) y = c.maxY
  }
  return y
}

export function support(col: Colliders, x: number, z: number, feetY: number): number {
  let y = baseFloor(col, x, z)
  const limit = feetY + STEP_HEIGHT + 0.08
  for (const b of col.boxes) {
    if (x < b.minX || x > b.maxX || z < b.minZ || z > b.maxZ) continue
    if (b.maxY > y && b.maxY <= limit) y = b.maxY
  }
  for (const c of col.cylinders) {
    const dx = x - c.x
    const dz = z - c.z
    if (dx * dx + dz * dz > c.r * c.r) continue
    if (c.maxY > y && c.maxY <= limit) y = c.maxY
  }
  return y
}

export function raycast(
  col: Colliders,
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  max: number,
): RayHit | null {
  let best: RayHit | null = null
  const consider = (hit: RayHit | null) => {
    if (!hit || hit.t > max || hit.t < 0) return
    if (!best || hit.t < best.t) best = hit
  }
  for (const b of col.boxes) consider(rayBox(ox, oy, oz, dx, dy, dz, b))
  for (const c of col.cylinders) consider(rayCylinder(ox, oy, oz, dx, dy, dz, c))
  return best
}

export function segmentCast(
  col: Colliders,
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
): RayHit | null {
  const dx = bx - ax
  const dy = by - ay
  const dz = bz - az
  const len = Math.hypot(dx, dy, dz)
  if (len < 1e-6) return null
  return raycast(col, ax, ay, az, dx / len, dy / len, dz / len, len)
}

function rayBox(
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  box: AABB,
): RayHit | null {
  let tNear = -Infinity
  let tFar = Infinity
  let nx = 0
  let ny = 0
  let nz = 0
  const axes: [number, number, number, number, number, number, number][] = [
    [dx, ox, box.minX, box.maxX, 1, 0, 0],
    [dy, oy, box.minY, box.maxY, 0, 1, 0],
    [dz, oz, box.minZ, box.maxZ, 0, 0, 1],
  ]
  for (const [d, o, min, max, ax, ay, az] of axes) {
    if (Math.abs(d) < 1e-8) {
      if (o < min || o > max) return null
      continue
    }
    let t1 = (min - o) / d
    let t2 = (max - o) / d
    let enter = -1
    if (t1 > t2) {
      const s = t1
      t1 = t2
      t2 = s
      enter = 1
    }
    if (t1 > tNear) {
      tNear = t1
      nx = ax * enter
      ny = ay * enter
      nz = az * enter
    }
    tFar = Math.min(tFar, t2)
    if (tNear > tFar) return null
  }
  if (tNear < 0 || tFar < 0) return null
  return {
    t: tNear,
    x: ox + dx * tNear,
    y: oy + dy * tNear,
    z: oz + dz * tNear,
    nx,
    ny,
    nz,
  }
}

function rayCylinder(
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  c: Cylinder,
): RayHit | null {
  let best: RayHit | null = null
  const a = dx * dx + dz * dz
  const fx = ox - c.x
  const fz = oz - c.z
  const b = 2 * (fx * dx + fz * dz)
  const cc = fx * fx + fz * fz - c.r * c.r
  if (a > 1e-8) {
    const disc = b * b - 4 * a * cc
    if (disc >= 0) {
      const s = Math.sqrt(disc)
      for (const t of [(-b - s) / (2 * a), (-b + s) / (2 * a)]) {
        if (t < 0) continue
        const y = oy + dy * t
        if (y < c.minY || y > c.maxY) continue
        const x = ox + dx * t
        const z = oz + dz * t
        const nlen = Math.hypot(x - c.x, z - c.z) || 1
        const hit: RayHit = {
          t,
          x,
          y,
          z,
          nx: (x - c.x) / nlen,
          ny: 0,
          nz: (z - c.z) / nlen,
        }
        if (!best || t < best.t) best = hit
      }
    }
  }
  if (Math.abs(dy) > 1e-8) {
    for (const capY of [c.minY, c.maxY]) {
      const t = (capY - oy) / dy
      if (t < 0) continue
      const x = ox + dx * t
      const z = oz + dz * t
      if ((x - c.x) ** 2 + (z - c.z) ** 2 > c.r * c.r) continue
      const hit: RayHit = { t, x, y: capY, z, nx: 0, ny: capY === c.maxY ? 1 : -1, nz: 0 }
      if (!best || t < best.t) best = hit
    }
  }
  return best
}

export type SegHit = { s: number; dist: number; x: number; y: number; z: number }

/** Closest point on segment AB to segment CD. `s` is 0..1 along AB. */
export function closestSegments(
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
  cx: number,
  cy: number,
  cz: number,
  dx: number,
  dy: number,
  dz: number,
): SegHit {
  const ux = bx - ax
  const uy = by - ay
  const uz = bz - az
  const vx = dx - cx
  const vy = dy - cy
  const vz = dz - cz
  const wx = ax - cx
  const wy = ay - cy
  const wz = az - cz
  const a = ux * ux + uy * uy + uz * uz
  const b = ux * vx + uy * vy + uz * vz
  const c = vx * vx + vy * vy + vz * vz
  const d = ux * wx + uy * wy + uz * wz
  const e = vx * wx + vy * wy + vz * wz
  const eps = 1e-8
  let sn: number
  let sd: number
  let tn: number
  let td: number
  const denom = a * c - b * b
  if (denom < eps) {
    sn = 0
    sd = 1
    tn = e
    td = c
  } else {
    sn = b * e - c * d
    sd = denom
    tn = a * e - b * d
    td = denom
    if (sn < 0) {
      sn = 0
      tn = e
      td = c
    } else if (sn > sd) {
      sn = sd
      tn = e + b
      td = c
    }
  }
  if (tn < 0) {
    tn = 0
    if (-d < 0) sn = 0
    else if (-d > a) sn = sd
    else {
      sn = -d
      sd = a
    }
  } else if (tn > td) {
    tn = td
    if (-d + b < 0) sn = 0
    else if (-d + b > a) sn = sd
    else {
      sn = -d + b
      sd = a
    }
  }
  const sc = Math.abs(sn) < eps ? 0 : sn / sd
  const tc = Math.abs(tn) < eps ? 0 : tn / td
  const px = ax + ux * sc
  const py = ay + uy * sc
  const pz = az + uz * sc
  const qx = cx + vx * tc
  const qy = cy + vy * tc
  const qz = cz + vz * tc
  return {
    s: sc,
    dist: Math.hypot(px - qx, py - qy, pz - qz),
    x: px,
    y: py,
    z: pz,
  }
}
