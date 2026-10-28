import * as THREE from 'three'
import type { Team, WeaponId } from './types.ts'
import { teamColor } from './content.ts'
import { GEO, basic, lambert } from './materials.ts'
import { makeWrapTexture } from './effects.ts'

export type Rig = {
  group: THREE.Group
  update: (time: number, moving: boolean) => void
}

export type Look = {
  outfit: string
  weapon: WeaponId
  wrap: string
  buddy: string
}

type Palette = {
  cloak: number
  inner: number
  trim: number
  eyes: number
  wisp: number
}

const CLOAK_GEO = new THREE.CylinderGeometry(0.27, 0.46, 0.95, 8, 1, true)
const HOOD_GEO = new THREE.ConeGeometry(0.31, 0.16, 4, 1, true)

let wingGeo: THREE.ShapeGeometry | null = null
let lowerWingGeo: THREE.ShapeGeometry | null = null

function wingShape(): THREE.ShapeGeometry {
  if (wingGeo) return wingGeo
  const s = new THREE.Shape()
  s.moveTo(0, 0)
  s.bezierCurveTo(0.12, 0.34, 0.48, 0.62, 0.74, 0.5)
  s.bezierCurveTo(0.9, 0.4, 0.78, 0.12, 0.56, 0.02)
  s.bezierCurveTo(0.36, -0.06, 0.16, -0.04, 0, 0)
  wingGeo = new THREE.ShapeGeometry(s, 10)
  return wingGeo
}

function lowerWingShape(): THREE.ShapeGeometry {
  if (lowerWingGeo) return lowerWingGeo
  const s = new THREE.Shape()
  s.moveTo(0, 0)
  s.bezierCurveTo(0.2, -0.04, 0.5, -0.12, 0.52, -0.34)
  s.bezierCurveTo(0.54, -0.52, 0.28, -0.5, 0.16, -0.36)
  s.bezierCurveTo(0.06, -0.24, 0.02, -0.1, 0, 0)
  lowerWingGeo = new THREE.ShapeGeometry(s, 8)
  return lowerWingGeo
}

function palette(outfitId: string, team: Team): Palette {
  const teamHex = teamColor(team)
  if (outfitId === 'evori') return { cloak: 0xf1dcff, inner: 0xc7a8ff, trim: 0xff9ad8, eyes: 0xff6fcf, wisp: 0xb98cff }
  if (outfitId === 'neon') return { cloak: 0x141a22, inner: 0x0b0f14, trim: 0x39ff9a, eyes: 0xff2bd6, wisp: 0x39ff9a }
  if (outfitId === 'white') return { cloak: 0xeef2fb, inner: 0xb9c4d8, trim: teamHex, eyes: 0x7ecbff, wisp: 0x9fd8ff }
  return { cloak: 0x231b38, inner: 0x120d1f, trim: teamHex, eyes: 0x8fd3ff, wisp: 0x6a4bff }
}

function part(w: number, h: number, d: number, mat: THREE.Material, pivotTop = true): THREE.Group {
  const g = new THREE.Group()
  const mesh = new THREE.Mesh(GEO.box, mat)
  mesh.scale.set(w, h, d)
  mesh.position.y = pivotTop ? -h / 2 : 0
  mesh.castShadow = true
  mesh.receiveShadow = true
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

export function createBuddy(id: string): THREE.Group | null {
  if (id !== 'lumi') return null
  const buddy = new THREE.Group()
  buddy.name = 'buddy'
  const fur = lambert(0xa98bff, false)
  const belly = lambert(0xe8dcff, false)
  const chain = new THREE.Mesh(GEO.cyl, basic(0xe6e9f5))
  chain.scale.set(0.008, 0.12, 0.008)
  chain.position.y = -0.06
  const body = new THREE.Mesh(GEO.sphereSm, fur)
  body.scale.set(0.055, 0.06, 0.05)
  body.position.y = -0.2
  const tummy = new THREE.Mesh(GEO.sphereSm, belly)
  tummy.scale.set(0.035, 0.04, 0.02)
  tummy.position.set(0, -0.205, -0.036)
  const head = new THREE.Mesh(GEO.sphereSm, fur)
  head.scale.set(0.062, 0.055, 0.055)
  head.position.y = -0.135
  const earL = new THREE.Mesh(GEO.cone, fur)
  const earR = new THREE.Mesh(GEO.cone, fur)
  earL.scale.set(0.022, 0.04, 0.02)
  earR.scale.set(0.022, 0.04, 0.02)
  earL.position.set(-0.036, -0.088, 0)
  earR.position.set(0.036, -0.088, 0)
  earL.rotation.z = 0.35
  earR.rotation.z = -0.35
  const star = new THREE.Mesh(GEO.sphere, basic(0xffe27a))
  star.scale.set(0.014, 0.014, 0.006)
  star.position.set(0, -0.12, -0.052)
  const eyeMat = basic(0x2a1f45)
  const eyeL = new THREE.Mesh(GEO.sphere, eyeMat)
  const eyeR = new THREE.Mesh(GEO.sphere, eyeMat)
  eyeL.scale.set(0.009, 0.004, 0.004)
  eyeR.scale.set(0.009, 0.004, 0.004)
  eyeL.position.set(-0.022, -0.14, -0.053)
  eyeR.position.set(0.022, -0.14, -0.053)
  const tail = new THREE.Mesh(GEO.cyl, fur)
  tail.scale.set(0.01, 0.07, 0.01)
  tail.position.set(0.04, -0.22, 0.035)
  tail.rotation.z = -0.9
  buddy.add(chain, body, tummy, head, earL, earR, star, eyeL, eyeR, tail)
  return buddy
}

export function createCharacter(team: Team, look: Look): Rig {
  const pal = palette(look.outfit, team)
  const cloakMat = lambert(pal.cloak)
  const innerMat = lambert(pal.inner)
  const trimMat = lambert(pal.trim)
  const glow = basic(pal.eyes)
  const group = new THREE.Group()
  const body = new THREE.Group()
  body.name = 'agent-body'
  group.add(body)

  const ll = part(0.2, 0.62, 0.2, innerMat)
  const lr = part(0.2, 0.62, 0.2, innerMat)
  ll.position.set(-0.13, 0.74, 0)
  lr.position.set(0.13, 0.74, 0)
  body.add(ll, lr)

  const cloakMesh = new THREE.Mesh(CLOAK_GEO, new THREE.MeshLambertMaterial({ color: pal.cloak, flatShading: true, side: THREE.DoubleSide }))
  cloakMesh.position.y = 0.86
  cloakMesh.castShadow = true
  body.add(cloakMesh)

  const torso = new THREE.Mesh(GEO.box, cloakMat)
  torso.scale.set(0.56, 0.5, 0.34)
  torso.position.y = 1.2
  torso.castShadow = true
  body.add(torso)

  const sash = new THREE.Mesh(GEO.box, trimMat)
  sash.scale.set(0.58, 0.07, 0.36)
  sash.position.y = 1.0
  body.add(sash)

  const scarf = new THREE.Mesh(GEO.box, trimMat)
  scarf.scale.set(0.46, 0.12, 0.38)
  scarf.position.y = 1.44
  body.add(scarf)
  const tailEnd = part(0.12, 0.34, 0.04, trimMat)
  tailEnd.position.set(0.12, 1.42, 0.2)
  tailEnd.rotation.x = 0.2
  body.add(tailEnd)

  for (const x of [-0.33, 0.33]) {
    const pad = new THREE.Mesh(GEO.box, cloakMat)
    pad.scale.set(0.22, 0.12, 0.34)
    pad.position.set(x, 1.42, 0)
    pad.rotation.z = x < 0 ? 0.28 : -0.28
    pad.castShadow = true
    body.add(pad)
  }

  const la = part(0.15, 0.5, 0.15, cloakMat)
  const ra = part(0.15, 0.5, 0.15, cloakMat)
  la.position.set(-0.38, 1.38, 0)
  ra.position.set(0.38, 1.38, 0)
  body.add(la, ra)
  const wispMat = basic(pal.wisp, 0.55)
  const wisps: THREE.Mesh[] = []
  for (const arm of [la, ra]) {
    const hand = new THREE.Mesh(GEO.sphereSm, innerMat)
    hand.scale.setScalar(0.085)
    hand.position.y = -0.52
    const wisp = new THREE.Mesh(GEO.sphereSm, wispMat)
    wisp.scale.setScalar(0.13)
    wisp.position.y = -0.54
    arm.add(hand, wisp)
    wisps.push(wisp)
  }

  const head = new THREE.Group()
  head.position.y = 1.66
  body.add(head)
  const hoodBack = new THREE.Mesh(GEO.box, cloakMat)
  hoodBack.scale.set(0.44, 0.4, 0.42)
  hoodBack.castShadow = true
  const hoodPeak = new THREE.Mesh(HOOD_GEO, cloakMat)
  hoodPeak.position.set(0, 0.27, 0.04)
  hoodPeak.rotation.y = Math.PI / 4
  hoodPeak.castShadow = true
  const face = new THREE.Mesh(GEO.box, basic(0x07050d))
  face.scale.set(0.32, 0.28, 0.04)
  face.position.set(0, -0.02, -0.2)
  const brim = new THREE.Mesh(GEO.box, cloakMat)
  brim.scale.set(0.46, 0.08, 0.14)
  brim.position.set(0, 0.17, -0.17)
  brim.rotation.x = -0.25
  brim.castShadow = true
  const drapeL = new THREE.Mesh(GEO.box, cloakMat)
  const drapeR = new THREE.Mesh(GEO.box, cloakMat)
  drapeL.scale.set(0.06, 0.36, 0.1)
  drapeR.scale.set(0.06, 0.36, 0.1)
  drapeL.position.set(-0.2, -0.02, -0.18)
  drapeR.position.set(0.2, -0.02, -0.18)
  head.add(hoodBack, hoodPeak, face, brim, drapeL, drapeR)
  const slits: [number, number, number][] = [[-0.08, 0.02, 0.06], [0.08, 0.02, 0.06], [0, -0.07, 0.05]]
  for (const [x, y, w] of slits) {
    const eye = new THREE.Mesh(GEO.box, glow)
    eye.scale.set(w, 0.025, 0.03)
    eye.position.set(x, y, -0.225)
    head.add(eye)
  }
  if (look.outfit === 'evori') {
    const bowMat = basic(0xffb8e6)
    for (const dir of [-1, 1]) {
      const loop = new THREE.Mesh(GEO.sphereSm, bowMat)
      loop.scale.set(0.08, 0.06, 0.03)
      loop.position.set(0.12 + dir * 0.07, 0.26, -0.04)
      loop.rotation.z = dir * 0.5
      head.add(loop)
    }
    const knot = new THREE.Mesh(GEO.sphere, basic(0xfff1fb))
    knot.scale.setScalar(0.03)
    knot.position.set(0.12, 0.26, -0.06)
    head.add(knot)
  }

  const strips: THREE.Group[] = []
  const stripColors = [pal.cloak, pal.inner, pal.cloak]
  ;[-0.17, 0, 0.17].forEach((x, i) => {
    const strip = part(0.16, 0.86 + (i === 1 ? 0.12 : 0), 0.03, lambert(stripColors[i]!))
    strip.position.set(x, 1.4, 0.2)
    body.add(strip)
    strips.push(strip)
  })

  let wings: ReturnType<typeof makeWings> | null = null
  if (look.outfit === 'evori') {
    wings = makeWings(0xd4a8ff, 0xff9ad8)
    wings.group.scale.setScalar(1.25)
    wings.group.position.set(0, 1.3, 0.24)
    body.add(wings.group)
  }

  const gun = createWeapon(look.weapon, look.wrap, look.buddy)
  gun.scale.setScalar(0.55)
  gun.position.set(0.06, -0.38, -0.16)
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
      if (wings) {
        const flap = 0.35 + Math.sin(time * (moving ? 6 : 2.2)) * 0.22
        wings.left.rotation.y = flap
        wings.right.rotation.y = -flap
      }
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
  const bodyMat = new THREE.MeshLambertMaterial({ map: tex, flatShading: true })
  const dream = wrapId === 'dreamwings'
  const dark = lambert(dream ? 0xd8dcef : 0x232833)
  const accent = basic(dream ? 0xffb8e6 : id === 'sniper' ? 0x9ad7ff : id === 'splash' ? 0xff4d8d : 0xffe14a)

  const body = new THREE.Mesh(GEO.box, bodyMat)
  let finY = 0.06
  let finZ = 0
  let charm = new THREE.Vector3(0.07, 0.03, -0.26)
  if (id === 'sniper') {
    body.scale.set(0.1, 0.12, 0.85)
    body.position.set(0, 0.02, -0.15)
    const barrel = new THREE.Mesh(GEO.box, dark)
    barrel.scale.set(0.05, 0.05, 0.55)
    barrel.position.set(0, 0.04, -0.7)
    const scope = new THREE.Mesh(GEO.cyl, dark)
    scope.scale.set(0.06, 0.22, 0.06)
    scope.rotation.z = Math.PI / 2
    scope.position.set(0, 0.14, -0.05)
    group.add(body, barrel, scope)
    finZ = 0.1
    charm = new THREE.Vector3(0.06, -0.04, -0.3)
  } else if (id === 'splash') {
    body.scale.set(0.18, 0.16, 0.42)
    body.position.set(0, 0, -0.05)
    const mouth = new THREE.Mesh(GEO.box, dark)
    mouth.scale.set(0.22, 0.14, 0.16)
    mouth.position.set(0, 0, -0.32)
    const hopper = new THREE.Mesh(GEO.sphere, accent)
    hopper.scale.set(0.1, 0.1, 0.1)
    hopper.position.set(0, 0.16, 0.05)
    group.add(body, mouth, hopper)
    finY = 0.08
    charm = new THREE.Vector3(0.1, -0.06, -0.1)
  } else {
    body.scale.set(0.1, 0.12, 0.48)
    body.position.set(0, 0, -0.08)
    const hopper = new THREE.Mesh(GEO.sphereSm, accent)
    hopper.scale.setScalar(0.07)
    hopper.position.set(0, 0.14, 0.02)
    const grip = new THREE.Mesh(GEO.box, dark)
    grip.scale.set(0.06, 0.16, 0.08)
    grip.position.set(0, -0.12, 0.08)
    grip.rotation.x = 0.3
    group.add(body, hopper, grip)
  }
  if (dream) {
    const fins = makeWings(0xe2c6ff, 0xffb8e6)
    fins.group.scale.setScalar(0.2)
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
