import * as THREE from 'three'
import { cosmetic, type Bundle } from './content.ts'
import { createBuddy, createWeapon } from './characters.ts'
import { cardArt } from './cards.ts'
import { makeSprayTexture } from './effects.ts'
import type { WeaponId } from './types.ts'

let renderer: THREE.WebGLRenderer | null = null
const cache = new Map<string, string>()

function getRenderer(w: number, h: number): THREE.WebGLRenderer | null {
  try {
    if (!renderer) {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
      renderer.outputColorSpace = THREE.SRGBColorSpace
      renderer.setPixelRatio(1)
    }
    renderer.setSize(w, h, false)
    return renderer
  } catch {
    return null
  }
}

function stage(): THREE.Scene {
  const scene = new THREE.Scene()
  scene.add(new THREE.HemisphereLight(0xfff4ea, 0x6a4bb0, 1.25))
  const key = new THREE.DirectionalLight(0xffffff, 2.2)
  key.position.set(2, 4, 5)
  scene.add(key)
  const rim = new THREE.DirectionalLight(0xffb8e6, 1.2)
  rim.position.set(-4, 2, -3)
  scene.add(rim)
  return scene
}

function shoot(scene: THREE.Scene, camera: THREE.Camera, w: number, h: number, bg?: THREE.Texture): string {
  const r = getRenderer(w, h)
  if (!r) return ''
  scene.background = bg ?? null
  r.setClearColor(0x000000, 0)
  r.render(scene, camera)
  return r.domElement.toDataURL('image/png')
}

function canvasUrl(draw: (g: CanvasRenderingContext2D) => void): string {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 256
  const g = c.getContext('2d')!
  draw(g)
  return c.toDataURL('image/png')
}

export function itemThumb(id: string, wrap = 'factory'): string {
  const key = `${id}:${wrap}`
  const hit = cache.get(key)
  if (hit !== undefined) return hit
  const item = cosmetic(id)
  let url = ''
  if (item.kind === 'card') {
    url = cardArt(id, 'tall')
  } else if (item.kind === 'wrap') {
    url = weaponThumb('rapid', id, 'none')
  } else if (item.kind === 'buddy') {
    if (id === 'none') {
      url = canvasUrl((g) => {
        g.strokeStyle = 'rgba(255,255,255,0.5)'
        g.lineWidth = 10
        g.beginPath()
        g.arc(128, 128, 54, 0, Math.PI * 2)
        g.moveTo(90, 166)
        g.lineTo(166, 90)
        g.stroke()
      })
    } else {
      const scene = stage()
      const buddy = createBuddy(id)
      if (buddy) {
        buddy.scale.setScalar(9)
        buddy.position.y = 1.3
        buddy.rotation.y = Math.PI + 0.3
        scene.add(buddy)
      }
      const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 20)
      cam.position.set(0, 0.1, 3.4)
      cam.lookAt(0, 0, 0)
      url = shoot(scene, cam, 256, 256)
    }
  } else if (item.kind === 'spray') {
    const tex = makeSprayTexture(id)
    url = (tex.image as HTMLCanvasElement).toDataURL('image/png')
    tex.dispose()
  } else {
    const hex = `#${item.color.toString(16).padStart(6, '0')}`
    url = canvasUrl((g) => {
      g.fillStyle = hex
      g.beginPath()
      g.ellipse(128, 132, 70, 62, 0.3, 0, Math.PI * 2)
      g.fill()
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2
        g.beginPath()
        g.ellipse(128 + Math.cos(a) * 82, 132 + Math.sin(a) * 74, 14 - (i % 3) * 3, 10, a, 0, Math.PI * 2)
        g.fill()
      }
      g.fillStyle = 'rgba(255,255,255,0.55)'
      g.beginPath()
      g.ellipse(104, 104, 22, 12, -0.6, 0, Math.PI * 2)
      g.fill()
    })
  }
  cache.set(key, url)
  return url
}

export function weaponThumb(weapon: WeaponId, wrap: string, buddy: string): string {
  const key = `weapon:${weapon}:${wrap}:${buddy}`
  const hit = cache.get(key)
  if (hit !== undefined) return hit
  const scene = stage()
  const gun = createWeapon(weapon, wrap, buddy)
  gun.rotation.set(0.2, Math.PI / 2 + 0.25, 0)
  scene.add(gun)
  const box = new THREE.Box3().setFromObject(gun)
  const center = box.getCenter(new THREE.Vector3())
  const size = box.getSize(new THREE.Vector3()).length()
  const cam = new THREE.PerspectiveCamera(30, 1, 0.01, 20)
  cam.position.set(center.x, center.y + size * 0.15, center.z + size * 1.9)
  cam.lookAt(center)
  const url = shoot(scene, cam, 256, 256)
  cache.set(key, url)
  return url
}

function auroraTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 320
  const g = c.getContext('2d')!
  const sky = g.createLinearGradient(0, 0, 0, 320)
  sky.addColorStop(0, '#1b1450')
  sky.addColorStop(0.45, '#4a3a9c')
  sky.addColorStop(0.8, '#c48ad8')
  sky.addColorStop(1, '#ffc9e6')
  g.fillStyle = sky
  g.fillRect(0, 0, 512, 320)
  g.globalCompositeOperation = 'lighter'
  const bands: [string, number][] = [['rgba(120,255,214,0.35)', 70], ['rgba(255,160,230,0.3)', 120], ['rgba(150,170,255,0.3)', 160]]
  for (const [color, y] of bands) {
    g.strokeStyle = color
    g.lineWidth = 34
    g.beginPath()
    g.moveTo(-20, y)
    for (let x = 0; x <= 540; x += 40) g.lineTo(x, y + Math.sin(x / 70) * 26)
    g.stroke()
  }
  g.globalCompositeOperation = 'source-over'
  g.fillStyle = '#ffffff'
  for (let i = 0; i < 90; i++) {
    g.globalAlpha = 0.3 + Math.random() * 0.7
    g.fillRect(Math.random() * 512, Math.random() * 200, 1.6, 1.6)
  }
  g.globalAlpha = 1
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

export function bundleArt(bundle: Bundle): string {
  const key = `bundle:${bundle.id}`
  const hit = cache.get(key)
  if (hit !== undefined) return hit
  const scene = stage()
  const rapid = createWeapon('rapid', 'dreamwings', 'none')
  rapid.scale.setScalar(2.3)
  rapid.position.set(-0.55, 1.75, 0)
  rapid.rotation.set(0.1, Math.PI / 2 + 0.35, 0.2)
  const splash = createWeapon('splash', 'dreamwings', 'none')
  splash.scale.setScalar(2.1)
  splash.position.set(-0.75, 0.95, 0.3)
  splash.rotation.set(0.15, Math.PI / 2 + 0.5, -0.15)
  const sniper = createWeapon('sniper', 'dreamwings', 'none')
  sniper.scale.setScalar(1.7)
  sniper.position.set(0.15, 2.35, -0.6)
  sniper.rotation.set(0, Math.PI / 2 - 0.25, 0.3)
  scene.add(rapid, splash, sniper)
  const lumi = createBuddy('lumi')
  if (lumi) {
    lumi.scale.setScalar(6.5)
    lumi.position.set(1.2, 2.5, 0.5)
    lumi.rotation.y = Math.PI - 0.35
    scene.add(lumi)
  }
  const cam = new THREE.PerspectiveCamera(34, 16 / 10, 0.1, 30)
  cam.position.set(0, 1.25, 4.6)
  cam.lookAt(0, 1.3, 0)
  const bg = auroraTexture()
  const url = shoot(scene, cam, 640, 400, bg)
  bg.dispose()
  cache.set(key, url)
  return url
}
