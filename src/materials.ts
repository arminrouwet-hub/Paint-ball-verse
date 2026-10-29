import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'

export const GEO = {
  box: new THREE.BoxGeometry(1, 1, 1),
  sphere: new THREE.SphereGeometry(1, 20, 14),
  sphereSm: new THREE.SphereGeometry(1, 24, 16),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 24),
  cone: new THREE.ConeGeometry(1, 1, 24),
  circle: new THREE.CircleGeometry(1, 32),
  plane: new THREE.PlaneGeometry(1, 1),
  torus: new THREE.TorusGeometry(1, 0.08, 10, 40),
}

const mattes = new Map<string, THREE.MeshStandardMaterial>()
const basics = new Map<string, THREE.MeshBasicMaterial>()
const roundedCache = new Map<string, THREE.BufferGeometry>()

export function matte(color: number, roughness = 0.62, metalness = 0): THREE.MeshStandardMaterial {
  const key = `${color}:${roughness}:${metalness}`
  let mat = mattes.get(key)
  if (!mat) {
    mat = new THREE.MeshStandardMaterial({ color, roughness, metalness })
    mattes.set(key, mat)
  }
  return mat
}

export function basic(color: number, opacity = 1): THREE.MeshBasicMaterial {
  const key = `${color}:${opacity}`
  let mat = basics.get(key)
  if (!mat) {
    mat = new THREE.MeshBasicMaterial({
      color,
      transparent: opacity < 1,
      opacity,
      depthWrite: opacity >= 1,
      side: opacity < 1 ? THREE.DoubleSide : THREE.FrontSide,
    })
    basics.set(key, mat)
  }
  return mat
}

export function rounded(w: number, h: number, d: number, radius?: number): THREE.BufferGeometry {
  const r = Math.min(radius ?? 0.18, Math.min(w, h, d) * 0.45)
  const key = `${w.toFixed(3)}:${h.toFixed(3)}:${d.toFixed(3)}:${r.toFixed(3)}`
  let geo = roundedCache.get(key)
  if (!geo) {
    geo = new RoundedBoxGeometry(w, h, d, 3, r)
    roundedCache.set(key, geo)
  }
  return geo
}

export function boxMesh(w: number, h: number, d: number, color: number, shadows = true): THREE.Mesh {
  const mesh = new THREE.Mesh(rounded(w, h, d), matte(color))
  mesh.castShadow = shadows
  mesh.receiveShadow = true
  return mesh
}
