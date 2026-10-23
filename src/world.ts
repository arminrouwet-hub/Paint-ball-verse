import * as THREE from 'three'
import type { Colliders, MapDef } from './types.ts'
import { GEO, boxMesh, lambert } from './materials.ts'
import { makeGroundTexture } from './effects.ts'

export type BuiltWorld = {
  colliders: Colliders
  floorTexture: THREE.Texture
}

export function buildWorld(scene: THREE.Scene, map: MapDef): BuiltWorld {
  scene.background = new THREE.Color(map.sky)
  scene.fog = new THREE.Fog(map.fog, map.fogNear, map.fogFar)

  const hemi = new THREE.HemisphereLight(map.hemiSky, map.hemiGround, 0.72)
  scene.add(hemi)
  const ambient = new THREE.AmbientLight(0xffffff, 0.28)
  scene.add(ambient)
  const sun = new THREE.DirectionalLight(map.sun, 2.35)
  sun.position.set(map.sunPos[0], map.sunPos[1], map.sunPos[2])
  sun.castShadow = true
  const span = Math.max(map.bounds.maxX - map.bounds.minX, map.bounds.maxZ - map.bounds.minZ) * 0.72
  sun.shadow.camera.left = -span
  sun.shadow.camera.right = span
  sun.shadow.camera.top = span
  sun.shadow.camera.bottom = -span
  sun.shadow.camera.near = 1
  sun.shadow.camera.far = span * 4
  sun.shadow.mapSize.set(2048, 2048)
  sun.shadow.bias = -0.0004
  sun.shadow.normalBias = 0.04
  scene.add(sun)
  const fill = new THREE.DirectionalLight(0xb9d6ff, 0.55)
  fill.position.set(-map.sunPos[0], 24, -map.sunPos[2])
  scene.add(fill)

  const w = map.bounds.maxX - map.bounds.minX + 10
  const d = map.bounds.maxZ - map.bounds.minZ + 10
  const floorTexture = makeGroundTexture(map.floorStyle, map.floor)
  const floorMat = new THREE.MeshLambertMaterial({ map: floorTexture, color: 0xffffff })
  const floor = new THREE.Mesh(GEO.plane, floorMat)
  floor.rotation.x = -Math.PI / 2
  floor.scale.set(w, d, 1)
  floor.position.set((map.bounds.minX + map.bounds.maxX) / 2, 0, (map.bounds.minZ + map.bounds.maxZ) / 2)
  floor.receiveShadow = true
  scene.add(floor)

  const colliders: Colliders = { boxes: [], cylinders: [], pits: map.pits.map((p) => ({ ...p })) }

  for (const b of map.boxes) {
    const mesh = boxMesh(b.w, b.h, b.d, b.color)
    mesh.position.set(b.x, b.y, b.z)
    scene.add(mesh)
    colliders.boxes.push({
      minX: b.x - b.w / 2,
      maxX: b.x + b.w / 2,
      minY: b.y - b.h / 2,
      maxY: b.y + b.h / 2,
      minZ: b.z - b.d / 2,
      maxZ: b.z + b.d / 2,
    })
  }

  for (const c of map.cylinders) {
    const h = c.maxY - c.minY
    const mesh = new THREE.Mesh(GEO.cyl, lambert(c.color))
    mesh.scale.set(c.r, h, c.r)
    mesh.position.set(c.x, (c.minY + c.maxY) / 2, c.z)
    mesh.castShadow = true
    mesh.receiveShadow = true
    scene.add(mesh)
    colliders.cylinders.push({ x: c.x, z: c.z, r: c.r, minY: c.minY, maxY: c.maxY })
  }

  for (const deco of map.decor) {
    if (deco.kind === 'cone') {
      const mesh = new THREE.Mesh(GEO.cone, lambert(deco.color))
      mesh.scale.set(deco.r, deco.h, deco.r)
      mesh.position.set(deco.x, deco.y, deco.z)
      mesh.castShadow = true
      scene.add(mesh)
    } else if (deco.kind === 'sphere') {
      const mesh = new THREE.Mesh(GEO.sphere, lambert(deco.color))
      mesh.scale.setScalar(deco.r)
      mesh.position.set(deco.x, deco.y, deco.z)
      mesh.castShadow = true
      scene.add(mesh)
    } else {
      const mesh = boxMesh(deco.w, deco.h, deco.d, deco.color, false)
      mesh.position.set(deco.x, deco.y, deco.z)
      scene.add(mesh)
    }
  }

  return { colliders, floorTexture }
}
