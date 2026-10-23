import * as THREE from 'three'
import type { AgentId, Team, WeaponId } from './types.ts'
import { agentById, cosmetic, teamColor } from './content.ts'
import { GEO, basic, lambert } from './materials.ts'
import { makeWrapTexture } from './effects.ts'

export type Rig = {
  group: THREE.Group
  update: (time: number, moving: boolean, downed: boolean) => void
}

function pivotMesh(w: number, h: number, d: number, color: number, mat?: THREE.Material): THREE.Group {
  const g = new THREE.Group()
  const mesh = new THREE.Mesh(GEO.box, mat ?? lambert(color))
  mesh.scale.set(w, h, d)
  mesh.position.y = -h / 2
  mesh.castShadow = true
  mesh.receiveShadow = true
  g.add(mesh)
  return g
}

export function createCharacter(agentId: AgentId, team: Team, outfitId: string, weaponId: WeaponId, wrapId: string): Rig {
  const agent = agentById(agentId)
  const outfit = cosmetic(outfitId)
  const teamHex = teamColor(team)
  const accent = outfit.id === 'default' ? agent.color : (outfit.accent ?? outfit.color)
  const visorColor = outfit.id === 'default' ? agent.color : (outfit.accent ?? agent.color)
  const group = new THREE.Group()
  const body = new THREE.Group()
  body.name = 'agent-body'
  group.add(body)

  const ll = pivotMesh(0.22, 0.62, 0.22, 0x232833)
  const lr = pivotMesh(0.22, 0.62, 0.22, 0x232833)
  ll.position.set(-0.16, 0.78, 0)
  lr.position.set(0.16, 0.78, 0)
  body.add(ll, lr)

  const torso = new THREE.Mesh(GEO.box, lambert(teamHex))
  torso.scale.set(0.62, 0.62, 0.36)
  torso.position.y = 1.12
  torso.castShadow = true
  torso.receiveShadow = true
  body.add(torso)

  const chest = new THREE.Mesh(GEO.box, lambert(accent))
  chest.scale.set(0.28, 0.16, 0.08)
  chest.position.set(0, 1.22, -0.2)
  body.add(chest)

  const la = pivotMesh(0.16, 0.48, 0.16, teamHex)
  const ra = pivotMesh(0.16, 0.48, 0.16, teamHex)
  la.position.set(-0.42, 1.32, 0)
  ra.position.set(0.42, 1.32, 0)
  body.add(la, ra)

  const head = new THREE.Mesh(GEO.box, lambert(0x2a303c))
  head.scale.set(0.36, 0.34, 0.34)
  head.position.y = 1.64
  head.castShadow = true
  body.add(head)

  const visor = new THREE.Mesh(GEO.box, basic(visorColor))
  visor.scale.set(0.28, 0.1, 0.06)
  visor.position.set(0, 1.66, -0.18)
  body.add(visor)

  if (agentId === 'blitz') {
    const jet = new THREE.Mesh(GEO.box, basic(0x3de1ff))
    jet.scale.set(0.2, 0.28, 0.16)
    jet.position.set(0, 1.15, 0.24)
    body.add(jet)
  } else if (agentId === 'guardian') {
    const padL = new THREE.Mesh(GEO.box, lambert(accent))
    const padR = new THREE.Mesh(GEO.box, lambert(accent))
    padL.scale.set(0.22, 0.16, 0.28)
    padR.scale.set(0.22, 0.16, 0.28)
    padL.position.set(-0.4, 1.38, 0)
    padR.position.set(0.4, 1.38, 0)
    padL.castShadow = padR.castShadow = true
    body.add(padL, padR)
  } else if (agentId === 'scout') {
    const ant = new THREE.Mesh(GEO.cyl, lambert(0xd8deea))
    ant.scale.set(0.03, 0.42, 0.03)
    ant.position.set(0.08, 1.95, 0)
    const dish = new THREE.Mesh(GEO.sphere, basic(visorColor))
    dish.scale.setScalar(0.08)
    dish.position.set(0.08, 2.16, 0)
    body.add(ant, dish)
  } else if (agentId === 'splatter') {
    for (const x of [-0.16, 0.16]) {
      const ball = new THREE.Mesh(GEO.sphere, basic(0xff4d8d))
      ball.scale.setScalar(0.1)
      ball.position.set(x, 0.92, -0.16)
      body.add(ball)
    }
  } else {
    const pack = new THREE.Mesh(GEO.box, lambert(0xf4fff8))
    pack.scale.set(0.28, 0.32, 0.16)
    pack.position.set(0, 1.18, 0.24)
    pack.castShadow = true
    const v = new THREE.Mesh(GEO.box, basic(0xff4d6a))
    const hbar = new THREE.Mesh(GEO.box, basic(0xff4d6a))
    v.scale.set(0.06, 0.2, 0.05)
    hbar.scale.set(0.18, 0.06, 0.05)
    v.position.set(0, 1.2, -0.2)
    hbar.position.set(0, 1.2, -0.2)
    body.add(pack, v, hbar)
  }

  const gun = createWeapon(weaponId, wrapId)
  gun.scale.setScalar(0.55)
  gun.position.set(0.08, -0.35, -0.15)
  gun.rotation.x = Math.PI / 2
  ra.add(gun)

  return {
    group,
    update(time, moving, downed) {
      const swing = Math.sin(time * (moving ? 9 : 1.5)) * (moving ? 0.7 : 0.04)
      ll.rotation.x = swing
      lr.rotation.x = -swing
      la.rotation.x = -swing * 0.55
      ra.rotation.x = swing * 0.35
      body.rotation.x = downed ? 1.05 : 0
      body.position.y = downed ? -0.35 : 0
    },
  }
}

const wrapCache = new Map<string, THREE.CanvasTexture>()

export function createWeapon(id: WeaponId, wrapId: string): THREE.Group {
  const group = new THREE.Group()
  let tex = wrapCache.get(wrapId)
  if (!tex) {
    tex = makeWrapTexture(wrapId)
    wrapCache.set(wrapId, tex)
  }
  const bodyMat = new THREE.MeshLambertMaterial({ map: tex, flatShading: true })
  const dark = lambert(0x232833)
  const accent = basic(id === 'sniper' ? 0x9ad7ff : id === 'splash' ? 0xff4d8d : 0xffe14a)

  const body = new THREE.Mesh(GEO.box, bodyMat)
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
  group.traverse((obj) => {
    const mesh = obj as THREE.Mesh
    if (mesh.isMesh) {
      mesh.castShadow = true
    }
  })
  return group
}
