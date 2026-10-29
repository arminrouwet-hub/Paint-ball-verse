import * as THREE from 'three'
import type { Team, WeaponId } from './types.ts'
import { teamColor } from './content.ts'
import { GEO, basic, matte, rounded } from './materials.ts'
import { makeWrapTexture } from './effects.ts'

export type Rig = {
  group: THREE.Group
  update: (time: number, moving: boolean) => void
}

export type Look = {
  weapon: WeaponId
  wrap: string
  buddy: string
}

const CLOAK = 0x241c3a
const INNER = 0x120d1f
const EYES = 0x8fd3ff
const WISP = 0x6a4bff

const ROBE_GEO = new THREE.LatheGeometry(
  [
    [0.0, 1.56],
    [0.13, 1.55],
    [0.24, 1.49],
    [0.3, 1.38],
    [0.29, 1.2],
    [0.27, 1.02],
    [0.33, 0.8],
    [0.42, 0.56],
    [0.45, 0.5],
  ].map(([x, y]) => new THREE.Vector2(x, y)),
  40,
)
const LEG_GEO = new THREE.CapsuleGeometry(0.085, 0.42, 6, 16)
const ARM_GEO = new THREE.CapsuleGeometry(0.075, 0.36, 6, 16)
const EYE_GEO = new THREE.CapsuleGeometry(0.014, 0.05, 4, 8)
const STRIP_GEO = new THREE.CapsuleGeometry(0.07, 0.62, 6, 12)

let wingGeo: THREE.ShapeGeometry | null = null
let lowerWingGeo: THREE.ShapeGeometry | null = null

function wingShape(): THREE.ShapeGeometry {
  if (wingGeo) return wingGeo
  const s = new THREE.Shape()
  s.moveTo(0, 0)
  s.bezierCurveTo(0.12, 0.34, 0.48, 0.62, 0.74, 0.5)
  s.bezierCurveTo(0.9, 0.4, 0.78, 0.12, 0.56, 0.02)
  s.bezierCurveTo(0.36, -0.06, 0.16, -0.04, 0, 0)
  wingGeo = new THREE.ShapeGeometry(s, 16)
  return wingGeo
}

function lowerWingShape(): THREE.ShapeGeometry {
  if (lowerWingGeo) return lowerWingGeo
  const s = new THREE.Shape()
  s.moveTo(0, 0)
  s.bezierCurveTo(0.2, -0.04, 0.5, -0.12, 0.52, -0.34)
  s.bezierCurveTo(0.54, -0.52, 0.28, -0.5, 0.16, -0.36)
  s.bezierCurveTo(0.06, -0.24, 0.02, -0.1, 0, 0)
  lowerWingGeo = new THREE.ShapeGeometry(s, 12)
  return lowerWingGeo
}

function limb(geo: THREE.BufferGeometry, mat: THREE.Material, length: number): THREE.Group {
  const g = new THREE.Group()
  const mesh = new THREE.Mesh(geo, mat)
  mesh.position.y = -length / 2
  mesh.castShadow = true
  g.add(mesh)
  return g
}

function makeWings(color: number, edge: number): { group: THREE.Group; left: THREE.Group; right: THREE.Group } {
  const group = new THREE.Group()
  const glass = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.72, side: THREE.DoubleSide, depthWrite: false })
  const rim = new THREE.MeshBasicMaterial({ color: edge, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false })
  const build = (dir: 1 | -1) => {
    const side = new THREE.Group()
    const upper = new THREE.Mesh(wingShape(), glass)
    const upperRim = new THREE.Mesh(wingShape(), rim)
    upperRim.scale.setScalar(0.55)
    upperRim.position.set(0.06, 0.06, 0.004)
    const lower = new THREE.Mesh(lowerWingShape(), glass)
    const lowerRim = new THREE.Mesh(lowerWingShape(), rim)
    lowerRim.scale.setScalar(0.5)
    lowerRim.position.set(0.05, -0.04, 0.004)
    side.add(upper, upperRim, lower, lowerRim)
    side.scale.set(dir, 1, 1)
    return side
  }
  const left = build(-1)
  const right = build(1)
  group.add(left, right)
  return { group, left, right }
}

function blob(mat: THREE.Material, sx: number, sy: number, sz: number, x: number, y: number, z: number): THREE.Mesh {
  const m = new THREE.Mesh(GEO.sphereSm, mat)
  m.scale.set(sx, sy, sz)
  m.position.set(x, y, z)
  return m
}

function critter(fur: number, belly: number, ears: 'cat' | 'bear' | 'bunny' | 'mouse', extra?: (g: THREE.Group) => void): THREE.Group {
  const g = new THREE.Group()
  const furMat = matte(fur, 0.8)
  const bellyMat = matte(belly, 0.8)
  const dark = basic(0x2a1f45)
  g.add(
    blob(furMat, 0.055, 0.06, 0.05, 0, -0.2, 0),
    blob(bellyMat, 0.034, 0.038, 0.02, 0, -0.205, -0.036),
    blob(furMat, 0.062, 0.056, 0.056, 0, -0.135, 0),
    blob(dark, 0.007, 0.007, 0.004, -0.022, -0.135, -0.053),
    blob(dark, 0.007, 0.007, 0.004, 0.022, -0.135, -0.053),
    blob(basic(0xff9ec8), 0.009, 0.005, 0.004, -0.036, -0.152, -0.048),
    blob(basic(0xff9ec8), 0.009, 0.005, 0.004, 0.036, -0.152, -0.048),
  )
  for (const dir of [-1, 1]) {
    if (ears === 'cat') {
      const ear = new THREE.Mesh(GEO.cone, furMat)
      ear.scale.set(0.022, 0.04, 0.02)
      ear.position.set(dir * 0.036, -0.088, 0)
      ear.rotation.z = -dir * 0.35
      g.add(ear)
    } else if (ears === 'bear') {
      g.add(blob(furMat, 0.022, 0.022, 0.016, dir * 0.042, -0.09, 0))
    } else if (ears === 'bunny') {
      const ear = blob(furMat, 0.014, 0.05, 0.012, dir * 0.022, -0.05, 0)
      ear.rotation.z = dir > 0 ? -0.9 : 0.1
      if (dir > 0) ear.position.set(0.045, -0.075, 0)
      g.add(ear)
    } else {
      g.add(blob(furMat, 0.03, 0.03, 0.01, dir * 0.05, -0.095, 0))
      g.add(blob(bellyMat, 0.018, 0.018, 0.006, dir * 0.05, -0.095, -0.006))
    }
  }
  extra?.(g)
  return g
}

export function createBuddy(id: string): THREE.Group | null {
  if (id === 'none') return null
  const buddy = new THREE.Group()
  buddy.name = 'buddy'
  const chain = new THREE.Mesh(GEO.cyl, matte(0xe6e9f5, 0.3, 0.8))
  chain.scale.set(0.006, 0.08, 0.006)
  chain.position.y = -0.04
  const ring = new THREE.Mesh(GEO.torus, matte(0xe6e9f5, 0.3, 0.8))
  ring.scale.setScalar(0.014)
  ring.rotation.y = Math.PI / 2
  buddy.add(chain, ring)
  let body: THREE.Group
  if (id === 'lumi') {
    body = critter(0xa98bff, 0xe8dcff, 'cat', (g) => {
      const star = new THREE.Mesh(GEO.sphere, basic(0xffe27a))
      star.scale.set(0.014, 0.014, 0.006)
      star.position.set(0, -0.11, -0.054)
      const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.008, 0.06, 4, 8), matte(0xa98bff, 0.8))
      tail.position.set(0.045, -0.22, 0.035)
      tail.rotation.z = -0.9
      g.add(star, tail)
    })
  } else if (id === 'pip') {
    body = critter(0xff9ec8, 0xffe1ee, 'bear', (g) => g.add(blob(basic(0x5a2a3a), 0.01, 0.007, 0.006, 0, -0.145, -0.058)))
  } else if (id === 'clover') {
    body = critter(0x8fe0a8, 0xe6fff0, 'bunny', (g) => g.add(blob(matte(0xffffff, 0.9), 0.016, 0.016, 0.016, 0, -0.22, 0.05)))
  } else if (id === 'nibble') {
    body = critter(0xffa25a, 0xffe3c4, 'mouse', (g) => {
      const ball = blob(matte(0x3c7dff, 0.3), 0.022, 0.022, 0.022, 0.0, -0.215, -0.06)
      g.add(ball)
    })
  } else if (id === 'splat') {
    body = new THREE.Group()
    body.add(
      blob(matte(0x3c7dff, 0.25), 0.07, 0.07, 0.07, 0, -0.15, 0),
      blob(basic(0xffffff), 0.02, 0.014, 0.008, -0.025, -0.115, -0.064),
      blob(basic(0x14123a), 0.008, 0.012, 0.004, -0.022, -0.14, -0.068),
      blob(basic(0x14123a), 0.008, 0.012, 0.004, 0.022, -0.14, -0.068),
      blob(basic(0x14123a), 0.024, 0.008, 0.004, 0, -0.17, -0.068),
      blob(matte(0x3c7dff, 0.25), 0.03, 0.02, 0.03, 0.04, -0.215, 0.02),
    )
  } else {
    body = new THREE.Group()
    const can = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.09, 20), matte(0x232833, 0.5))
    can.position.y = -0.16
    const dome = blob(matte(0xffe14a, 0.25), 0.055, 0.04, 0.055, 0, -0.11, 0)
    body.add(can, dome)
    for (let i = 0; i < 3; i++) body.add(blob(matte([0xff4d8d, 0x3de1ff, 0x5dff9a][i]!, 0.3), 0.02, 0.02, 0.02, -0.02 + i * 0.02, -0.08, 0))
  }
  buddy.add(body)
  return buddy
}

export function createCharacter(team: Team, look: Look): Rig {
  const teamHex = teamColor(team)
  const cloakMat = matte(CLOAK, 0.85)
  const innerMat = matte(INNER, 0.9)
  const trimMat = matte(teamHex, 0.5)
  const glow = basic(EYES)
  const group = new THREE.Group()
  const body = new THREE.Group()
  body.name = 'agent-body'
  group.add(body)

  const ll = limb(LEG_GEO, innerMat, 0.6)
  const lr = limb(LEG_GEO, innerMat, 0.6)
  ll.position.set(-0.12, 0.8, 0)
  lr.position.set(0.12, 0.8, 0)
  body.add(ll, lr)
  for (const leg of [ll, lr]) leg.add(blob(innerMat, 0.1, 0.07, 0.14, 0, -0.66, -0.03))

  const robe = new THREE.Mesh(ROBE_GEO, new THREE.MeshStandardMaterial({ color: CLOAK, roughness: 0.85, side: THREE.DoubleSide }))
  robe.castShadow = true
  robe.scale.z = 0.82
  body.add(robe)

  const sash = new THREE.Mesh(GEO.torus, trimMat)
  sash.scale.set(0.285, 0.235, 0.6)
  sash.rotation.x = Math.PI / 2
  sash.position.y = 1.02
  body.add(sash)
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.065, 12, 32), trimMat)
  scarf.rotation.x = Math.PI / 2
  scarf.position.y = 1.5
  body.add(scarf)
  const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.3, 6, 12), trimMat)
  tail.position.set(0.1, 1.32, 0.22)
  tail.rotation.x = 0.25
  body.add(tail)

  for (const x of [-0.27, 0.27]) {
    const pad = blob(cloakMat, 0.15, 0.1, 0.17, x, 1.44, 0)
    pad.castShadow = true
    body.add(pad)
  }

  const la = limb(ARM_GEO, cloakMat, 0.5)
  const ra = limb(ARM_GEO, cloakMat, 0.5)
  la.position.set(-0.36, 1.42, 0)
  ra.position.set(0.36, 1.42, 0)
  body.add(la, ra)
  const wisps: THREE.Mesh[] = []
  for (const arm of [la, ra]) {
    const hand = blob(innerMat, 0.075, 0.075, 0.075, 0, -0.55, 0)
    const wisp = blob(basic(WISP, 0.45), 0.13, 0.13, 0.13, 0, -0.56, 0)
    arm.add(hand, wisp)
    wisps.push(wisp)
  }

  const head = new THREE.Group()
  head.position.y = 1.72
  body.add(head)
  const hood = blob(cloakMat, 0.23, 0.25, 0.25, 0, 0, 0.01)
  hood.castShadow = true
  const peak = new THREE.Mesh(GEO.cone, cloakMat)
  peak.scale.set(0.13, 0.24, 0.13)
  peak.position.set(0, 0.17, 0.13)
  peak.rotation.x = 0.85
  const face = blob(basic(0x07050d), 0.17, 0.18, 0.1, 0, -0.02, -0.17)
  head.add(hood, peak, face)
  const slits: [number, number, number][] = [[-0.07, 0.02, 1], [0.07, 0.02, 1], [0, -0.06, 0.8]]
  for (const [x, y, w] of slits) {
    const eye = new THREE.Mesh(EYE_GEO, glow)
    eye.rotation.z = Math.PI / 2
    eye.scale.set(1, w, 1)
    eye.position.set(x, y, -0.265)
    head.add(eye)
  }

  const strips: THREE.Group[] = []
  ;[-0.15, 0, 0.15].forEach((x, i) => {
    const strip = limb(STRIP_GEO, i === 1 ? innerMat : cloakMat, 0.76)
    const mesh = strip.children[0] as THREE.Mesh
    mesh.scale.z = 0.25
    strip.position.set(x, 1.42, 0.23)
    body.add(strip)
    strips.push(strip)
  })

  const gun = createWeapon(look.weapon, look.wrap, look.buddy)
  gun.scale.setScalar(0.55)
  gun.position.set(0.06, -0.42, -0.16)
  gun.rotation.x = Math.PI / 2
  ra.add(gun)

  return {
    group,
    update(time, moving) {
      const swing = Math.sin(time * (moving ? 9 : 1.5)) * (moving ? 0.6 : 0.03)
      ll.rotation.x = swing
      lr.rotation.x = -swing
      la.rotation.x = -swing * 0.5 - 0.15
      ra.rotation.x = swing * 0.3 - 0.35
      strips.forEach((s, i) => {
        s.rotation.x = 0.12 + (moving ? 0.5 : 0.08) + Math.sin(time * (moving ? 7 : 2) + i * 1.3) * (moving ? 0.18 : 0.06)
      })
      const pulse = 1 + Math.sin(time * 3.2) * 0.12
      for (const w of wisps) w.scale.setScalar(0.13 * pulse)
    },
  }
}

const wrapCache = new Map<string, THREE.CanvasTexture>()

export function createWeapon(id: WeaponId, wrapId: string, buddyId = 'none'): THREE.Group {
  const group = new THREE.Group()
  let tex = wrapCache.get(wrapId)
  if (!tex) {
    tex = makeWrapTexture(wrapId)
    wrapCache.set(wrapId, tex)
  }
  const dream = wrapId === 'dreamwings'
  const bodyMat = new THREE.MeshStandardMaterial({ map: tex, roughness: dream ? 0.22 : 0.45, metalness: dream ? 0.35 : 0.1 })
  const dark = matte(dream ? 0xd8dcef : 0x232833, 0.35, dream ? 0.6 : 0.2)
  const accent = matte(dream ? 0xffb8e6 : id === 'sniper' ? 0x9ad7ff : id === 'splash' ? 0xff4d8d : 0xffe14a, 0.2)
  const cylinder = (r: number, len: number, mat: THREE.Material) => {
    const m = new THREE.Mesh(GEO.cyl, mat)
    m.scale.set(r, len, r)
    m.rotation.x = Math.PI / 2
    return m
  }

  let finY = 0.06
  let finZ = 0
  let charm = new THREE.Vector3(0.07, 0.03, -0.26)
  if (id === 'sniper') {
    const body = new THREE.Mesh(rounded(0.1, 0.12, 0.85, 0.04), bodyMat)
    body.position.set(0, 0.02, -0.15)
    const barrel = cylinder(0.028, 0.55, dark)
    barrel.position.set(0, 0.04, -0.7)
    const scope = cylinder(0.04, 0.26, dark)
    scope.position.set(0, 0.14, -0.05)
    const lens = new THREE.Mesh(GEO.sphere, basic(0x9ad7ff))
    lens.scale.set(0.034, 0.034, 0.01)
    lens.position.set(0, 0.14, -0.18)
    group.add(body, barrel, scope, lens)
    finZ = 0.1
    charm = new THREE.Vector3(0.06, -0.04, -0.3)
  } else if (id === 'splash') {
    const body = new THREE.Mesh(rounded(0.18, 0.16, 0.42, 0.06), bodyMat)
    body.position.set(0, 0, -0.05)
    const mouth = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.08, 0.16, 24), dark)
    mouth.rotation.x = Math.PI / 2
    mouth.position.set(0, 0, -0.32)
    const hopper = new THREE.Mesh(GEO.sphereSm, accent)
    hopper.scale.setScalar(0.1)
    hopper.position.set(0, 0.16, 0.05)
    group.add(body, mouth, hopper)
    finY = 0.08
    charm = new THREE.Vector3(0.1, -0.06, -0.1)
  } else {
    const body = new THREE.Mesh(rounded(0.1, 0.12, 0.48, 0.04), bodyMat)
    body.position.set(0, 0, -0.08)
    const barrel = cylinder(0.024, 0.2, dark)
    barrel.position.set(0, 0.01, -0.4)
    const hopper = new THREE.Mesh(GEO.sphereSm, accent)
    hopper.scale.set(0.07, 0.08, 0.07)
    hopper.position.set(0, 0.14, 0.02)
    const grip = new THREE.Mesh(rounded(0.06, 0.16, 0.08, 0.025), dark)
    grip.position.set(0, -0.12, 0.08)
    grip.rotation.x = 0.3
    group.add(body, barrel, hopper, grip)
  }
  if (dream) {
    const fins = makeWings(0xe2c6ff, 0xffb8e6)
    fins.group.scale.setScalar(0.22)
    fins.group.position.set(0, finY, finZ)
    fins.left.rotation.y = 0.5
    fins.right.rotation.y = -0.5
    fins.group.rotation.x = -0.25
    fins.group.name = 'fins'
    group.add(fins.group)
  }
  const buddy = createBuddy(buddyId)
  if (buddy) {
    buddy.position.copy(charm)
    group.add(buddy)
  }
  group.traverse((obj) => {
    const mesh = obj as THREE.Mesh
    if (mesh.isMesh) mesh.castShadow = true
  })
  return group
}
