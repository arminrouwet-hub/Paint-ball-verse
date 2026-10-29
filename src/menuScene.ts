import * as THREE from 'three'
import { createCharacter, type Look, type Rig } from './characters.ts'
import { GEO, basic, matte } from './materials.ts'

export type LobbyView = 'play' | 'locker' | 'shop' | 'career'

function skyTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 32
  c.height = 512
  const g = c.getContext('2d')!
  const grad = g.createLinearGradient(0, 0, 0, 512)
  grad.addColorStop(0, '#1238b8')
  grad.addColorStop(0.42, '#2f8cff')
  grad.addColorStop(0.7, '#7fd0ff')
  grad.addColorStop(0.86, '#ffd3a8')
  grad.addColorStop(1, '#ff9a5a')
  g.fillStyle = grad
  g.fillRect(0, 0, 32, 512)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

export class MenuScene {
  readonly scene = new THREE.Scene()
  readonly camera = new THREE.PerspectiveCamera(36, 1, 0.1, 120)
  private rig: Rig
  private readonly holder = new THREE.Group()
  private readonly clouds: THREE.Group[] = []
  private readonly ring: THREE.Mesh
  private time = 0
  private spin = 0
  private spinVel = 0
  private view: LobbyView = 'play'
  private camX = 0
  private aspect = 1

  constructor(look: Look) {
    this.scene.background = skyTexture()
    this.scene.fog = new THREE.Fog(0x8fd0ff, 26, 70)
    this.scene.add(new THREE.HemisphereLight(0xfff1dc, 0x4a6bd8, 1.15))
    const sun = new THREE.DirectionalLight(0xfff4ea, 2.4)
    sun.position.set(4, 9, 6)
    this.scene.add(sun)
    const rim = new THREE.DirectionalLight(0xff9a5a, 1.1)
    rim.position.set(-5, 3, -4)
    this.scene.add(rim)

    const ground = new THREE.Mesh(GEO.circle, matte(0x5aa0ff))
    ground.rotation.x = -Math.PI / 2
    ground.scale.setScalar(60)
    ground.position.y = -0.6
    this.scene.add(ground)

    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.7, 0.5, 28), matte(0x1b2a6b))
    base.position.y = -0.25
    this.scene.add(base)
    const top = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.45, 0.06, 28), matte(0x2a3f9a))
    top.position.y = 0.01
    this.scene.add(top)
    this.ring = new THREE.Mesh(new THREE.TorusGeometry(1.48, 0.05, 6, 48), basic(0xffe14a))
    this.ring.rotation.x = Math.PI / 2
    this.ring.position.y = 0.04
    this.scene.add(this.ring)
    const orange = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.04, 6, 48), basic(0xff7424))
    orange.rotation.x = Math.PI / 2
    orange.position.y = -0.3
    this.scene.add(orange)

    const paints = [0x3c7dff, 0xff7424, 0xff4d8d, 0x3de1ff, 0xffe14a]
    paints.forEach((color, i) => {
      const splat = new THREE.Mesh(GEO.circle, basic(color))
      const a = (i / paints.length) * Math.PI * 2 + 0.4
      splat.position.set(Math.cos(a) * 0.95, 0.05, Math.sin(a) * 0.95)
      splat.rotation.x = -Math.PI / 2
      splat.scale.setScalar(0.18 + (i % 3) * 0.06)
      this.scene.add(splat)
    })

    const cloudMat = matte(0xffffff)
    for (let i = 0; i < 9; i++) {
      const cloud = new THREE.Group()
      for (let j = 0; j < 4; j++) {
        const puff = new THREE.Mesh(GEO.sphere, cloudMat)
        puff.scale.set(1.2 + j * 0.3, 0.8 + (j % 2) * 0.3, 1)
        puff.position.set(j * 1.1 - 1.6, (j % 2) * 0.35, 0)
        cloud.add(puff)
      }
      const side = i % 2 ? 1 : -1
      cloud.position.set(side * (7 + (i % 4) * 3.5), 1.5 + (i % 3) * 2.4, -14 - (i % 5) * 4)
      cloud.scale.setScalar(0.8 + (i % 3) * 0.3)
      this.scene.add(cloud)
      this.clouds.push(cloud)
    }


    this.rig = createCharacter('blue', look)
    this.holder.add(this.rig.group)
    this.scene.add(this.holder)
    this.camera.position.set(0, 1.45, 5.6)
    this.camera.lookAt(0, 1.05, 0)
  }

  setLook(look: Look): void {
    this.holder.remove(this.rig.group)
    this.rig = createCharacter('blue', look)
    this.holder.add(this.rig.group)
  }

  setView(view: LobbyView): void {
    this.view = view
  }

  drag(dx: number): void {
    this.spinVel = dx * 0.012
    this.spin += dx * 0.012
  }

  resize(w: number, h: number): void {
    this.aspect = w / Math.max(1, h)
    this.camera.aspect = this.aspect
    this.camera.updateProjectionMatrix()
  }

  update(dt: number): void {
    this.time += dt
    this.spinVel *= Math.exp(-4 * dt)
    this.spin += this.spinVel * dt * 20
    this.spin *= Math.exp(-0.6 * dt)
    this.holder.rotation.y = Math.PI + this.spin + Math.sin(this.time * 0.5) * 0.08
    this.rig.update(this.time, false)
    const narrow = this.aspect < 0.9
    const target = narrow ? 0 : this.view === 'locker' ? -1.25 : this.view === 'career' ? 1.3 : 0
    this.camX += (target - this.camX) * (1 - Math.exp(-5 * dt))
    const dist = narrow ? 7.2 : 5.6
    this.camera.position.set(this.camX, 1.45, dist)
    this.camera.lookAt(this.camX, 1.05, 0)
    this.ring.rotation.z = this.time * 0.4
    this.clouds.forEach((cloud, i) => {
      cloud.position.x += dt * (0.15 + (i % 3) * 0.05)
      if (cloud.position.x > 22) cloud.position.x = -22
    })
  }
}
