import * as THREE from 'three'
import type { FloorStyle } from './types.ts'
import { GEO } from './materials.ts'

export class SplatField {
  readonly mesh: THREE.InstancedMesh
  private cursor = 0
  private filled = 0
  private readonly dummy = new THREE.Object3D()
  private readonly color = new THREE.Color()

  constructor(cap = 380) {
    const mat = new THREE.MeshBasicMaterial({
      vertexColors: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
      side: THREE.DoubleSide,
    })
    this.mesh = new THREE.InstancedMesh(GEO.circle, mat, cap)
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    this.mesh.count = 0
    this.mesh.frustumCulled = false
    this.mesh.receiveShadow = true
  }

  add(x: number, y: number, z: number, nx: number, ny: number, nz: number, color: number, size: number): void {
    const n = new THREE.Vector3(nx, ny, nz)
    if (n.lengthSq() < 1e-6) n.set(0, 1, 0)
    n.normalize()
    this.dummy.position.set(x, y, z).addScaledVector(n, 0.035)
    this.dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n)
    this.dummy.rotateZ(Math.random() * Math.PI * 2)
    const s = size * (0.85 + Math.random() * 0.4)
    this.dummy.scale.set(s, s, s)
    this.dummy.updateMatrix()
    this.mesh.setMatrixAt(this.cursor, this.dummy.matrix)
    this.color.setHex(color)
    this.mesh.setColorAt(this.cursor, this.color)
    this.cursor = (this.cursor + 1) % this.mesh.instanceMatrix.count
    this.filled = Math.min(this.mesh.instanceMatrix.count, this.filled + 1)
    this.mesh.count = this.filled
    this.mesh.instanceMatrix.needsUpdate = true
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true
  }

  clear(): void {
    this.cursor = 0
    this.filled = 0
    this.mesh.count = 0
  }
}

export function makeGroundTexture(style: FloorStyle, base: number): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 512
  const g = c.getContext('2d')!
  const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`
  g.fillStyle = hex(base)
  g.fillRect(0, 0, 512, 512)
  g.globalAlpha = 0.18
  for (let i = 0; i < 80; i++) {
    g.fillStyle = i % 2 ? '#000' : '#fff'
    g.beginPath()
    g.ellipse(Math.random() * 512, Math.random() * 512, 8 + Math.random() * 30, 4 + Math.random() * 14, Math.random() * 3, 0, Math.PI * 2)
    g.fill()
  }
  g.globalAlpha = 0.55
  const paints = ['#3c7dff', '#ff7424', '#ff4d8d', '#ffe14a', '#3de1ff', '#5dff9a']
  for (let i = 0; i < 14; i++) {
    g.fillStyle = paints[i % paints.length]!
    g.beginPath()
    g.ellipse(Math.random() * 512, Math.random() * 512, 16 + Math.random() * 40, 10 + Math.random() * 24, Math.random() * 6, 0, Math.PI * 2)
    g.fill()
  }
  g.globalAlpha = 1
  if (style === 'warehouse' || style === 'stadium' || style === 'city') {
    g.strokeStyle = style === 'stadium' ? 'rgba(255,255,255,0.55)' : 'rgba(255,225,74,0.7)'
    g.lineWidth = style === 'city' ? 10 : 8
    g.strokeRect(24, 24, 464, 464)
    g.beginPath()
    g.moveTo(256, 24)
    g.lineTo(256, 488)
    g.moveTo(24, 256)
    g.lineTo(488, 256)
    g.stroke()
  }
  if (style === 'skate') {
    g.strokeStyle = 'rgba(255,77,141,0.8)'
    g.lineWidth = 12
    g.strokeRect(40, 40, 432, 432)
    g.strokeStyle = 'rgba(61,225,255,0.8)'
    g.strokeRect(80, 80, 352, 352)
  }
  if (style === 'space') {
    g.fillStyle = '#fff'
    for (let i = 0; i < 60; i++) {
      g.globalAlpha = 0.4 + Math.random() * 0.6
      g.fillRect(Math.random() * 512, Math.random() * 512, 2, 2)
    }
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(style === 'pit' || style === 'space' ? 2 : 4, style === 'pit' || style === 'space' ? 2 : 4)
  tex.anisotropy = 4
  return tex
}

export function makeWrapTexture(id: string): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 128
  c.height = 64
  const g = c.getContext('2d')!
  if (id === 'candy') {
    g.fillStyle = '#ff4d8d'
    g.fillRect(0, 0, 128, 64)
    g.fillStyle = '#3de1ff'
    for (let x = -64; x < 160; x += 18) {
      g.beginPath()
      g.moveTo(x, 0)
      g.lineTo(x + 10, 0)
      g.lineTo(x + 32, 64)
      g.lineTo(x + 22, 64)
      g.fill()
    }
  } else if (id === 'hazard') {
    g.fillStyle = '#ffe14a'
    g.fillRect(0, 0, 128, 64)
    g.fillStyle = '#1a1208'
    for (let x = -20; x < 160; x += 24) {
      g.beginPath()
      g.moveTo(x, 0)
      g.lineTo(x + 12, 0)
      g.lineTo(x + 28, 64)
      g.lineTo(x + 16, 64)
      g.fill()
    }
  } else if (id === 'frost') {
    g.fillStyle = '#e7f6ff'
    g.fillRect(0, 0, 128, 64)
    g.fillStyle = '#3c7dff'
    for (let i = 0; i < 18; i++) {
      g.beginPath()
      g.arc(Math.random() * 128, Math.random() * 64, 2 + Math.random() * 4, 0, Math.PI * 2)
      g.fill()
    }
  } else {
    g.fillStyle = '#d5dbe6'
    g.fillRect(0, 0, 128, 64)
    g.fillStyle = '#2a3142'
    g.fillRect(0, 26, 128, 8)
    g.fillStyle = '#ff7424'
    g.fillRect(8, 8, 18, 10)
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

export function makeSprayTexture(id: string): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 256
  const g = c.getContext('2d')!
  g.clearRect(0, 0, 256, 256)
  if (id === 'crown') {
    g.fillStyle = '#ffd056'
    g.beginPath()
    g.moveTo(48, 170)
    g.lineTo(64, 90)
    g.lineTo(100, 130)
    g.lineTo(128, 70)
    g.lineTo(156, 130)
    g.lineTo(192, 90)
    g.lineTo(208, 170)
    g.closePath()
    g.fill()
    g.fillRect(58, 170, 140, 22)
  } else if (id === 'king') {
    g.fillStyle = '#ff4d8d'
    g.beginPath()
    g.ellipse(128, 140, 78, 58, 0, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = '#ffe14a'
    star(g, 128, 108, 28, 12, 5)
    g.fill()
  } else {
    g.fillStyle = '#fff4ea'
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2
      g.beginPath()
      g.ellipse(128 + Math.cos(a) * 20, 128 + Math.sin(a) * 20, 70, 18, a, 0, Math.PI * 2)
      g.fill()
    }
    g.fillStyle = '#3de1ff'
    g.beginPath()
    g.arc(128, 128, 28, 0, Math.PI * 2)
    g.fill()
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function star(g: CanvasRenderingContext2D, x: number, y: number, r: number, inner: number, n: number): void {
  g.beginPath()
  for (let i = 0; i < n * 2; i++) {
    const rad = i % 2 === 0 ? r : inner
    const a = -Math.PI / 2 + (i * Math.PI) / n
    const px = x + Math.cos(a) * rad
    const py = y + Math.sin(a) * rad
    if (i === 0) g.moveTo(px, py)
    else g.lineTo(px, py)
  }
  g.closePath()
}

export function makeLabel(text: string, color: string): THREE.Sprite {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 64
  const g = c.getContext('2d')!
  g.clearRect(0, 0, 256, 64)
  g.font = '700 34px Outfit, sans-serif'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.lineWidth = 6
  g.strokeStyle = 'rgba(8,6,16,0.85)'
  g.strokeText(text, 128, 34)
  g.fillStyle = color
  g.fillText(text, 128, 34)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false })
  const sprite = new THREE.Sprite(mat)
  sprite.scale.set(2.1, 0.52, 1)
  sprite.renderOrder = 4
  return sprite
}
