import * as THREE from 'three'
import type { AgentId } from './types.ts'
import { createCharacter } from './characters.ts'
import { GEO, basic, lambert } from './materials.ts'

export class MenuScene {
  readonly scene = new THREE.Scene()
  readonly camera = new THREE.PerspectiveCamera(50, 1, 0.1, 80)
  private rig = createCharacter('blitz', 'blue', 'default', 'rapid', 'factory')
  private readonly balls: THREE.Mesh[] = []
  private spin = 0

  constructor() {
    this.scene.background = new THREE.Color(0x1a1033)
    this.scene.fog = new THREE.Fog(0x1a1033, 12, 28)
    this.scene.add(new THREE.HemisphereLight(0xffe7c2, 0x3a2460, 0.9))
    const sun = new THREE.DirectionalLight(0xfff4ea, 2.2)
    sun.position.set(4, 8, 6)
    this.scene.add(sun)
    const fill = new THREE.DirectionalLight(0x7aa2ff, 0.7)
    fill.position.set(-6, 3, -2)
    this.scene.add(fill)

    const floor = new THREE.Mesh(GEO.circle, lambert(0x2a1848, false))
    floor.rotation.x = -Math.PI / 2
    floor.scale.setScalar(8)
    this.scene.add(floor)
    const ring = new THREE.Mesh(GEO.torus, basic(0xffe14a))
    ring.rotation.x = Math.PI / 2
    ring.scale.setScalar(2.4)
    ring.position.y = 0.05
    this.scene.add(ring)

    const paints = [0x3c7dff, 0xff7424, 0xff4d8d, 0x3de1ff, 0xffe14a, 0x5dff9a]
    paints.forEach((color, i) => {
      const splat = new THREE.Mesh(GEO.circle, basic(color))
      const a = (i / paints.length) * Math.PI * 2
      splat.position.set(Math.cos(a) * 2.2, 0.04, Math.sin(a) * 1.6)
      splat.rotation.x = -Math.PI / 2
      splat.rotateZ(i)
      splat.scale.setScalar(0.55 + (i % 3) * 0.15)
      this.scene.add(splat)
    })

    const crate = new THREE.Mesh(GEO.box, lambert(0xe08a2e))
    crate.scale.set(0.8, 0.7, 0.8)
    crate.position.set(2.4, 0.35, 1.2)
    crate.rotation.y = 0.4
    this.scene.add(crate)
    const crate2 = new THREE.Mesh(GEO.box, lambert(0x3c7dff))
    crate2.scale.set(0.55, 0.9, 0.55)
    crate2.position.set(-2.5, 0.45, 0.4)
    this.scene.add(crate2)

    for (let i = 0; i < 8; i++) {
      const ball = new THREE.Mesh(GEO.sphere, basic(paints[i % paints.length]!))
      ball.scale.setScalar(0.12 + (i % 3) * 0.04)
      this.scene.add(ball)
      this.balls.push(ball)
    }

    this.scene.add(this.rig.group)
    this.camera.position.set(2.8, 1.7, 4.4)
    this.camera.lookAt(0, 1.15, 0)
  }

  setAgent(agent: AgentId, outfit: string): void {
    this.scene.remove(this.rig.group)
    this.rig = createCharacter(agent, 'blue', outfit, 'rapid', 'factory')
    this.scene.add(this.rig.group)
  }

  resize(w: number, h: number): void {
    this.camera.aspect = w / Math.max(1, h)
    this.camera.updateProjectionMatrix()
  }

  update(dt: number): void {
    this.spin += dt
    this.rig.group.rotation.y = this.spin * 0.45
    this.rig.update(this.spin, true, false)
    this.rig.group.position.y = Math.sin(this.spin * 1.4) * 0.04
    this.balls.forEach((ball, i) => {
      const a = this.spin * 0.35 + (i / this.balls.length) * Math.PI * 2
      const r = 2.6 + (i % 2) * 0.4
      ball.position.set(Math.cos(a) * r, 1.1 + Math.sin(this.spin * 2 + i) * 0.35, Math.sin(a) * r * 0.72)
    })
  }
}
