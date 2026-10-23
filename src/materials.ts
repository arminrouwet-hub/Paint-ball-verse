import * as THREE from 'three'

export const GEO = {
  box: new THREE.BoxGeometry(1, 1, 1),
  sphere: new THREE.SphereGeometry(1, 8, 6),
  sphereSm: new THREE.SphereGeometry(1, 10, 8),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 8),
  cone: new THREE.ConeGeometry(1, 1, 8),
  circle: new THREE.CircleGeometry(1, 12),
  plane: new THREE.PlaneGeometry(1, 1),
  torus: new THREE.TorusGeometry(1, 0.08, 6, 14),
}

const lamberts = new Map<string, THREE.MeshLambertMaterial>()
const basics = new Map<string, THREE.MeshBasicMaterial>()

export function lambert(color: number, flat = true): THREE.MeshLambertMaterial {
  const key = `${color}:${flat ? 1 : 0}`
  let mat = lamberts.get(key)
  if (!mat) {
    mat = new THREE.MeshLambertMaterial({ color, flatShading: flat })
    lamberts.set(key, mat)
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

export function boxMesh(w: number, h: number, d: number, color: number, shadows = true): THREE.Mesh {
  const mesh = new THREE.Mesh(GEO.box, lambert(color))
  mesh.scale.set(w, h, d)
  mesh.castShadow = shadows
  mesh.receiveShadow = true
  return mesh
}
