import * as THREE from 'three'
import type {
  Actor,
  AgentId,
  ControlSettings,
  FrameState,
  InputState,
  MapDef,
  MatchConfig,
  PersonalStats,
  Pickup,
  Projectile,
  Team,
  WeaponId,
} from './types.ts'
import {
  AGENTS,
  BOT_NAMES,
  DIFFICULTY,
  agentById,
  cosmetic,
  teamColor,
  weaponById,
} from './content.ts'
import { mapById } from './maps.ts'
import { buildWorld } from './world.ts'
import { createCharacter, createWeapon, type Rig } from './characters.ts'
import { SplatField, makeSprayTexture } from './effects.ts'
import { GEO, basic } from './materials.ts'
import {
  BODY_HEIGHT,
  BODY_RADIUS,
  EYE,
  closestSegments,
  depenetrate,
  segmentCast,
  standHeight,
  steer,
  simulate,
} from './physics.ts'
import type { Colliders } from './types.ts'
import { tickBot } from './ai.ts'
import { oneGunWeapon } from './lobby.ts'
import { mulberry32, pick, shuffle } from './rng.ts'
import { clamp, lerp, mixHex } from './util.ts'
import type { AudioBus } from './audio.ts'

const ROUND_TIME = 150
const GRAVITY = 26
const LOW_GRAVITY = 9.2
const JUMP = 8.9

type Floater3 = { x: number; y: number; z: number; text: string; head: boolean; life: number }
type Feed = { id: number; text: string; tone: 'blue' | 'orange' | 'neutral'; until: number }
type Bit = { mesh: THREE.Mesh; vx: number; vy: number; vz: number; life: number }

type Visual = {
  rig: Rig
  shield: THREE.Mesh
  chevron: THREE.Mesh
  fortify: THREE.Mesh
  flash: THREE.Mesh
  label: THREE.Sprite
  bar: THREE.Group
  fill: THREE.Mesh
}

export type MatchOutcome = {
  won: boolean
  blue: number
  orange: number
  stats: PersonalStats
}

function look(yaw: number, pitch: number) {
  const cp = Math.cos(pitch)
  const sp = Math.sin(pitch)
  return { x: -Math.sin(yaw) * cp, y: sp, z: -Math.cos(yaw) * cp }
}

function basis(yaw: number, pitch: number) {
  const f = look(yaw, pitch)
  const rx = Math.cos(yaw)
  const rz = -Math.sin(yaw)
  const ux = -rz * f.y
  const uy = rz * f.x - rx * f.z
  const uz = rx * f.y
  return { f, r: { x: rx, y: 0, z: rz }, u: { x: ux, y: uy, z: uz } }
}

export class Match {
  readonly scene = new THREE.Scene()
  readonly camera = new THREE.PerspectiveCamera(74, 1, 0.08, 280)
  private readonly map: MapDef
  private readonly col: Colliders
  private readonly rng: () => number
  private readonly actors: Actor[] = []
  private readonly visuals = new Map<number, Visual>()
  private readonly projectiles: Projectile[] = []
  private readonly pickups: Pickup[] = []
  private readonly pickupMeshes: THREE.Mesh[] = []
  private readonly splats: SplatField
  private readonly ballPool: THREE.Mesh[] = []
  private readonly bits: Bit[] = []
  private readonly confetti: Bit[] = []
  private readonly floaters: Floater3[] = []
  private readonly feedItems: Feed[] = []
  private readonly hitShots = new Set<number>()
  private readonly headShots = new Set<number>()
  private readonly floorTexture: THREE.Texture
  private readonly view: THREE.Group
  private readonly stormMesh: THREE.Mesh
  private readonly nextRing: THREE.Mesh
  private readonly sprayTex: THREE.Texture
  private readonly sprays: THREE.Mesh[] = []
  private sprayCursor = 0
  private sprayCd = 0
  private gravity: number
  private projGravityScale: number
  private now = 0
  private phase: FrameState['phase'] = 'countdown'
  private countdown = 4
  private timeLeft = ROUND_TIME
  private stormClock = 0
  private stormIndex = 0
  private stormRadius: number
  private stormX: number
  private stormZ: number
  private readonly stormPlan: { r: number; dps: number; x: number; z: number }[]
  private overtime = false
  private round = 0
  private score = { blue: 0, orange: 0 }
  private endAt = 0
  private firstBlood = true
  private shotSeq = 1
  private projSeq = 1
  private feedSeq = 1
  private hitSeq = 0
  private hitHead = false
  private bannerText = ''
  private bannerSub = ''
  private bannerUntil = 0
  private recoil = 0
  private pain = 0
  private spectateId = -1
  private orbitYaw = 0
  private orbitPitch = 0.3
  private reported = false
  private ping: { x: number; y: number; z: number; until: number } | null = null
  private readonly pingMesh: THREE.Mesh
  private fov = 74
  private lowgrav: boolean
  private stormEnabled: boolean
  private readonly player: Actor
  private readonly config: MatchConfig
  private readonly audio: AudioBus
  private readonly getControls: () => ControlSettings
  private readonly onResult: (outcome: MatchOutcome) => void

  constructor(
    config: MatchConfig,
    audio: AudioBus,
    getControls: () => ControlSettings,
    onResult: (outcome: MatchOutcome) => void,
  ) {
    this.config = config
    this.audio = audio
    this.getControls = getControls
    this.onResult = onResult
    this.rng = mulberry32(config.seed || 1)
    this.map = mapById(config.mapId)
    this.lowgrav = config.lowgrav || this.map.mutator === 'lowgrav'
    this.stormEnabled = config.storm
    this.gravity = this.lowgrav ? LOW_GRAVITY : GRAVITY
    this.projGravityScale = this.lowgrav ? 0.38 : 1
    const built = buildWorld(this.scene, this.map)
    this.col = built.colliders
    this.floorTexture = built.floorTexture
    this.splats = new SplatField()
    this.scene.add(this.splats.mesh)

    const onegun = config.onegun || this.map.mutator === 'onegun'
    const forced = onegun ? oneGunWeapon(config.seed) : null
    const names = shuffle(BOT_NAMES, this.rng)
    const ids = AGENTS.map((a) => a.id)
    const rest = shuffle(ids.filter((id) => id !== config.agentId), this.rng)
    const blueAgents = [config.agentId, ...rest.slice(0, config.teamSize - 1)]
    const orangeAgents = shuffle(ids, this.rng).slice(0, config.teamSize)
    let nameI = 0
    const weapons: WeaponId[] = ['rapid', 'sniper', 'splash']
    const spawnTeam = (team: Team, agents: AgentId[]) => {
      agents.forEach((agentId, index) => {
        const isPlayer = team === 'blue' && index === 0
        const weaponId = forced ?? (isPlayer ? config.weaponId : pick(this.rng, weapons))
        const actor = this.makeActor(
          isPlayer ? config.playerName : names[nameI++] ?? `Bot${nameI}`,
          isPlayer,
          team,
          agentId,
          weaponId,
        )
        this.actors.push(actor)
        this.visuals.set(actor.id, this.makeVisual(actor))
      })
    }
    spawnTeam('blue', blueAgents)
    spawnTeam('orange', orangeAgents)
    this.player = this.actors[0]!

    this.stormPlan = this.planStorm()
    this.stormRadius = this.stormPlan[0]!.r
    this.stormX = this.stormPlan[0]!.x
    this.stormZ = this.stormPlan[0]!.z
    this.stormMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(1, 1, 26, 40, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xff4d9a,
        transparent: true,
        opacity: 0.14,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    )
    this.stormMesh.position.y = 12
    this.scene.add(this.stormMesh)
    this.nextRing = new THREE.Mesh(
      new THREE.TorusGeometry(1, 0.08, 6, 48),
      basic(0xffe14a),
    )
    this.nextRing.rotation.x = Math.PI / 2
    this.nextRing.position.y = 0.2
    this.nextRing.visible = false
    this.scene.add(this.nextRing)

    this.map.pickups.forEach((p, i) => {
      const kinds = ['speed', 'hopper', 'vest'] as const
      this.pickups.push({
        id: i,
        kind: kinds[i % 3]!,
        x: p.x,
        y: p.y,
        z: p.z,
        active: true,
        respawnAt: 0,
      })
      const color = kinds[i % 3] === 'speed' ? 0x3de1ff : kinds[i % 3] === 'hopper' ? 0xffe14a : 0xf4f7ff
      const mesh = new THREE.Mesh(GEO.sphereSm, basic(color))
      mesh.scale.setScalar(0.38)
      mesh.position.set(p.x, 0.9, p.z)
      this.scene.add(mesh)
      this.pickupMeshes.push(mesh)
    })

    this.view = createWeapon(this.player.weaponId, config.wrapId)
    this.view.traverse((obj) => {
      const mesh = obj as THREE.Mesh
      if (mesh.isMesh) mesh.castShadow = false
    })
    this.camera.add(this.view)
    this.scene.add(this.camera)

    this.sprayTex = makeSprayTexture(config.sprayId)
    this.pingMesh = new THREE.Mesh(GEO.cone, basic(0x3de1ff))
    this.pingMesh.scale.set(0.28, 0.7, 0.28)
    this.pingMesh.visible = false
    this.scene.add(this.pingMesh)

    this.startRound()
  }

  resize(w: number, h: number): void {
    this.camera.aspect = w / Math.max(1, h)
    this.camera.updateProjectionMatrix()
  }

  update(dt: number, input: InputState): void {
    this.now += dt
    const player = this.player
    const controls = this.getControls()
    const sens = 0.00215 * controls.sensitivity
    if (player.state === 'dead') {
      this.orbitYaw -= input.dx * sens
      this.orbitPitch = clamp(this.orbitPitch + input.dy * sens * (controls.invertY ? -1 : 1), -0.2, 1.15)
      if (input.leftEdge) this.cycleSpectate()
    } else {
      player.yaw -= input.dx * sens
      player.pitch = clamp(
        player.pitch - input.dy * sens * (controls.invertY ? -1 : 1),
        -1.2,
        1.2,
      )
    }

    if (this.phase === 'countdown') {
      this.countdown -= dt
      const n = Math.ceil(this.countdown)
      if (n > 1) this.setBanner(this.map.name.toUpperCase(), n === 4 || n === 3 ? 'Hold the lane' : 'Markers up', 0.4)
      else if (n === 1) this.setBanner('1', this.lowgrav ? 'Low gravity' : 'Paint incoming', 0.4)
      if (this.countdown <= 0) {
        this.phase = 'live'
        this.timeLeft = ROUND_TIME
        this.stormClock = 0
        this.setBanner('PAINT!', 'First wipe takes the round', 1.3)
        for (const a of this.actors) if (a.state === 'alive') a.protectUntil = this.now + 1.15
      }
    } else if (this.phase === 'end') {
      if (this.now >= this.endAt) this.startRound()
    }

    const live = this.phase === 'live'
    if (live && player.state !== 'dead') this.controlPlayer(player, input)
    else if (player.state !== 'dead') {
      player.wishSpeed = 0
      player.ads = false
    }

    if (live) {
      const tune = DIFFICULTY[this.config.difficulty]
      for (const bot of this.actors) {
        if (bot.isPlayer || bot.state === 'dead') continue
        tickBot(bot, {
          now: this.now,
          dt,
          actors: this.actors,
          waypoints: this.map.waypoints,
          tune,
          allyBias: bot.team === 'blue' ? 1 : 0,
          los: (from, to) => this.los(from, to),
          fire: (actor) => this.tryFire(actor, true, true),
          signature: (actor) => this.signature(actor),
          ultimate: (actor) => this.ultimate(actor),
          rng: this.rng,
        })
      }
      if (player.state === 'alive') {
        if (input.reloadEdge) this.startReload(player)
        if (input.abilityEdge) this.signature(player)
        if (input.ultEdge) this.ultimate(player)
        if (input.midEdge) this.placePing(player)
        if (input.sprayEdge) this.placeSpray(player)
        this.tryFire(player, input.left, input.leftEdge)
      }
    }

    for (const actor of this.actors) {
      if (actor.state === 'dead') continue
      if (!live) {
        actor.wishSpeed = 0
        actor.wantJump = false
      }
      this.moveActor(actor, dt)
      if (live && actor.state === 'alive') {
        actor.ult = Math.min(100, actor.ult + dt * 2.05)
        if (actor.sigCd > 0) actor.sigCd = Math.max(0, actor.sigCd - dt)
        if (actor.fireLeft > 0) actor.fireLeft = Math.max(0, actor.fireLeft - dt)
        if (actor.reloadLeft > 0) {
          const mult = actor.fireRateUntil > this.now ? 4 : 1
          actor.reloadLeft -= dt * mult
          if (actor.reloadLeft <= 0) {
            actor.ammo = actor.mag
            actor.reloadLeft = -1
          }
        }
        if (actor.resistUntil <= this.now) actor.resist = 1
        if (actor.dashUntil > this.now) this.dashTouch(actor)
      }
      if (actor.state === 'downed' && this.now >= actor.downUntil) {
        const killer = this.actor(actor.downerId)
        this.eliminate(actor, killer, 'bleed')
      }
    }

    if (live) {
      this.separate()
      this.updateProjectiles(dt)
      this.updatePickups()
      this.updateStorm(dt)
      this.sprayCd = Math.max(0, this.sprayCd - dt)
      if (this.timeLeft > 0) this.timeLeft -= dt
      else if (!this.overtime) this.checkClock()
    }

    this.updateBits(this.bits, dt)
    this.updateBits(this.confetti, dt)
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i]!
      f.life -= dt
      f.y += dt * 1.4
      if (f.life <= 0) this.floaters.splice(i, 1)
    }
    this.recoil = lerp(this.recoil, 0, 1 - Math.exp(-10 * dt))
    this.pain = lerp(this.pain, 0, 1 - Math.exp(-6 * dt))
    this.updateCamera(dt)
    this.updateVisuals(dt)
    if (live) this.resolveRound()
  }

  frame(width: number, height: number): FrameState {
    const player = this.player
    const weapon = weaponById(player.weaponId)
    const agent = agentById(player.agentId)
    const w = weaponById(player.weaponId)
    const reload = player.reloadLeft > 0 ? 1 - player.reloadLeft / w.reload : -1
    const spec = player.state === 'dead' ? this.actor(this.spectateId) : null
    const rows = this.actors.map((a) => ({
      name: a.name,
      team: a.team,
      agent: agentById(a.agentId).name,
      weapon: weaponById(a.weaponId).name,
      tags: a.tags,
      deaths: a.deaths,
      assists: a.assists,
      damage: Math.round(a.damage),
      you: a.isPlayer,
      state: a.state,
    }))
    let hurtAngle: number | null = null
    if (player.hurtUntil > this.now) {
      const dx = player.hurtFromX - player.x
      const dz = player.hurtFromZ - player.z
      const f = look(player.yaw, 0)
      const rx = Math.cos(player.yaw)
      const rz = -Math.sin(player.yaw)
      hurtAngle = Math.atan2(dx * rx + dz * rz, dx * f.x + dz * f.z)
    }
    const floaters = this.floaters.slice(0, 12).map((f) => {
      const v = new THREE.Vector3(f.x, f.y, f.z).project(this.camera)
      return {
        x: (v.x * 0.5 + 0.5) * width,
        y: (-v.y * 0.5 + 0.5) * height,
        text: f.text,
        head: f.head,
      }
    }).filter((f) => f.x > -40 && f.x < width + 40 && f.y > -40 && f.y < height + 40)
    const spread = player.ads ? 0.35 : clamp(0.55 + Math.hypot(player.vx, player.vz) * 0.08, 0.55, 2.4)
    const stormLeft = this.overtime ? 0 : Math.max(0, 30 - this.stormClock)
    return {
      hp: Math.max(0, Math.ceil(player.hp)),
      downed: player.state === 'downed',
      downLeft: player.state === 'downed' ? Math.max(0, player.downUntil - this.now) : 0,
      dead: player.state === 'dead',
      spectate: spec ? spec.name : null,
      ammo: player.ammo,
      mag: player.mag,
      reload,
      weapon: weapon.name,
      weaponId: player.weaponId,
      sigLabel: agent.sigLabel,
      ultLabel: agent.ultLabel,
      sigCd: player.sigCd,
      sigMax: agent.cd,
      ult: player.ult,
      vest: player.vest,
      haste: Math.max(0, player.hasteUntil - this.now),
      resist: player.resistUntil > this.now,
      fireRate: player.fireRateUntil > this.now,
      blue: this.score.blue,
      orange: this.score.orange,
      need: this.config.roundsToWin,
      blueAlive: this.actors.filter((a) => a.team === 'blue' && a.state !== 'dead').length,
      orangeAlive: this.actors.filter((a) => a.team === 'orange' && a.state !== 'dead').length,
      timeLeft: this.timeLeft,
      stormLeft,
      stormOn: this.stormEnabled,
      stormClosing: this.stormEnabled && (this.overtime || stormLeft < 8),
      inStorm: this.stormEnabled && this.outside(player),
      feed: this.feedItems.filter((f) => f.until > this.now).map(({ id, text, tone }) => ({ id, text, tone })),
      banner: this.now < this.bannerUntil ? this.bannerText : '',
      sub: this.now < this.bannerUntil ? this.bannerSub : '',
      scope: player.state === 'alive' && player.ads && player.weaponId === 'sniper',
      spread,
      scoreboard: false,
      rows,
      low: player.state === 'dead' ? 0.35 : clamp((40 - player.hp) / 40, 0, 1) + (player.hurtUntil > this.now ? 0.25 : 0),
      hurtAngle,
      hitSeq: this.hitSeq,
      hitHead: this.hitHead,
      floaters,
      phase: this.phase,
      hint: this.phase === 'countdown' ? 'WASD move · mouse aim · click fire · Q kit · X ult · R reload' : '',
      crosshair: player.state === 'alive',
      protect: player.protectUntil > this.now,
      round: this.round,
    }
  }

  drawMinimap(ctx: CanvasRenderingContext2D, size: number): void {
    const b = this.map.bounds
    const pad = 10
    ctx.clearRect(0, 0, size, size)
    ctx.fillStyle = 'rgba(10, 8, 20, 0.55)'
    ctx.fillRect(0, 0, size, size)
    const sx = (x: number) => pad + ((x - b.minX) / (b.maxX - b.minX)) * (size - pad * 2)
    const sz = (z: number) => pad + ((z - b.minZ) / (b.maxZ - b.minZ)) * (size - pad * 2)
    ctx.fillStyle = 'rgba(255,255,255,0.16)'
    for (const box of this.col.boxes) {
      if (box.maxY < 0.8) continue
      const x = sx(box.minX)
      const y = sz(box.minZ)
      ctx.fillRect(x, y, Math.max(1.5, sx(box.maxX) - x), Math.max(1.5, sz(box.maxZ) - y))
    }
    if (this.stormEnabled) {
      ctx.beginPath()
      ctx.strokeStyle = 'rgba(255, 77, 154, 0.9)'
      ctx.lineWidth = 2
      ctx.arc(sx(this.stormX), sz(this.stormZ), (this.stormRadius / (b.maxX - b.minX)) * (size - pad * 2), 0, Math.PI * 2)
      ctx.stroke()
    }
    for (const a of this.actors) {
      if (a.state === 'dead') continue
      const seen = a.team === 'blue' || a.spottedUntil > this.now || (a !== this.player && this.los(this.player, a) && a.team === 'orange')
      if (a.team === 'orange' && !seen) continue
      ctx.beginPath()
      ctx.fillStyle = a.team === 'blue' ? '#7eb0ff' : '#ffb078'
      ctx.globalAlpha = a.state === 'downed' ? 0.45 : 1
      ctx.arc(sx(a.x), sz(a.z), a.isPlayer ? 4 : 3, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1
    }
    const p = this.player
    ctx.save()
    ctx.translate(sx(p.x), sz(p.z))
    ctx.rotate(p.yaw)
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.moveTo(0, -6)
    ctx.lineTo(4, 4)
    ctx.lineTo(-4, 4)
    ctx.fill()
    ctx.restore()
  }

  dispose(): void {
    this.floorTexture.dispose()
    this.sprayTex.dispose()
    const splatMat = this.splats.mesh.material
    if (!Array.isArray(splatMat)) splatMat.dispose()
    for (const v of this.visuals.values()) {
      const mat = v.label.material as THREE.SpriteMaterial
      mat.map?.dispose()
      mat.dispose()
    }
    this.scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh
      if (!mesh.isMesh) return
      const mat = mesh.material
      const list = Array.isArray(mat) ? mat : [mat]
      for (const m of list) {
        if (m && 'map' in m && m.map && m.map !== this.floorTexture) {
          /* wrap textures are cached and shared */
        }
      }
    })
    this.scene.clear()
  }

  private makeActor(name: string, isPlayer: boolean, team: Team, agentId: AgentId, weaponId: WeaponId): Actor {
    const weapon = weaponById(weaponId)
    return {
      id: this.actors.length + 1,
      name,
      isPlayer,
      team,
      agentId,
      weaponId,
      paintId: isPlayer ? this.config.paintId : 'classic',
      state: 'alive',
      hp: 100,
      x: 0,
      y: 0,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      radius: BODY_RADIUS,
      height: BODY_HEIGHT,
      onGround: true,
      yaw: 0,
      pitch: 0,
      wishX: 0,
      wishZ: 0,
      wishSpeed: 0,
      wantJump: false,
      ads: false,
      moving: false,
      ammo: weapon.mag,
      mag: weapon.mag,
      reloadLeft: -1,
      fireLeft: 0,
      sigCd: 0,
      ult: 0,
      dashUntil: 0,
      dashX: 0,
      dashZ: 0,
      dashHits: [],
      shieldUntil: 0,
      resistUntil: 0,
      resist: 1,
      hasteUntil: 0,
      fireRateUntil: 0,
      vest: false,
      protectUntil: 0,
      spottedUntil: 0,
      knownUntil: 0,
      downUntil: 0,
      downerId: -1,
      flashUntil: 0,
      hurtUntil: 0,
      hurtFromX: 0,
      hurtFromZ: 0,
      tags: 0,
      deaths: 0,
      assists: 0,
      damage: 0,
      shots: 0,
      hits: 0,
      headshots: 0,
      revives: 0,
      roundTags: 0,
      hurts: [],
      thinkAt: 0,
      waypointI: -1,
      strafe: 1,
      strafeUntil: 0,
      aimReadyAt: 0,
      targetId: -1,
      stuck: 0,
      lastX: 0,
      lastZ: 0,
      retreat: false,
    }
  }

  private makeVisual(actor: Actor): Visual {
    const rig = createCharacter(
      actor.agentId,
      actor.team,
      actor.isPlayer ? this.config.outfitId : 'default',
      actor.weaponId,
      actor.isPlayer ? this.config.wrapId : 'factory',
    )
    const shield = new THREE.Mesh(GEO.box, basic(teamColor(actor.team), 0.38))
    shield.scale.set(1.55, 1.5, 0.08)
    shield.position.set(0, 1.2, -1.05)
    shield.visible = false
    const chevron = new THREE.Mesh(
      GEO.cone,
      new THREE.MeshBasicMaterial({ color: 0xffe14a, depthTest: false, transparent: true, opacity: 0.95 }),
    )
    chevron.scale.set(0.18, 0.32, 0.18)
    chevron.position.y = 2.45
    chevron.visible = false
    chevron.renderOrder = 6
    const fortify = new THREE.Mesh(GEO.torus, basic(0xffd056))
    fortify.rotation.x = Math.PI / 2
    fortify.position.y = 0.2
    fortify.scale.setScalar(0.85)
    fortify.visible = false
    const flash = new THREE.Mesh(GEO.sphere, basic(0xfff6ea))
    flash.scale.setScalar(0.45)
    flash.position.y = 1.2
    flash.visible = false
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 64
    const g = canvas.getContext('2d')!
    g.font = '700 32px Outfit, sans-serif'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.lineWidth = 6
    g.strokeStyle = 'rgba(8,6,16,0.9)'
    g.strokeText(actor.name, 128, 34)
    g.fillStyle = actor.team === 'blue' ? '#9ec0ff' : '#ffc097'
    g.fillText(actor.name, 128, 34)
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: true }))
    label.scale.set(2, 0.5, 1)
    label.position.y = 2.15
    const bar = new THREE.Group()
    const bg = new THREE.Mesh(GEO.plane, basic(0x120814))
    bg.scale.set(0.86, 0.12, 1)
    const fill = new THREE.Mesh(GEO.plane, basic(teamColor(actor.team)))
    fill.scale.set(0.8, 0.07, 1)
    bar.add(bg, fill)
    bar.position.y = 1.92
    rig.group.add(shield, chevron, fortify, flash, label, bar)
    this.scene.add(rig.group)
    return { rig, shield, chevron, fortify, flash, label, bar, fill }
  }

  private startRound(): void {
    this.round += 1
    this.phase = 'countdown'
    this.countdown = 4
    this.timeLeft = ROUND_TIME
    this.stormClock = 0
    this.stormIndex = 0
    this.overtime = false
    this.firstBlood = true
    this.hitShots.clear()
    this.headShots.clear()
    const plan = this.stormPlan[0]!
    this.stormRadius = plan.r
    this.stormX = plan.x
    this.stormZ = plan.z
    this.projectiles.forEach((p) => (p.alive = false))
    this.projectiles.length = 0
    for (const mesh of this.ballPool) mesh.visible = false
    const swapped = this.round % 2 === 0
    const aSpawns = this.pickSpawns(swapped ? this.map.spawnsB : this.map.spawnsA)
    const bSpawns = this.pickSpawns(swapped ? this.map.spawnsA : this.map.spawnsB)
    let bi = 0
    let oi = 0
    for (const actor of this.actors) {
      const spawn = actor.team === 'blue' ? aSpawns[bi++]! : bSpawns[oi++]!
      actor.x = spawn.x
      actor.z = spawn.z
      actor.y = standHeight(this.col, spawn.x, spawn.z)
      actor.vx = actor.vy = actor.vz = 0
      actor.yaw = spawn.yaw
      actor.pitch = 0
      actor.state = 'alive'
      actor.hp = 100
      actor.onGround = true
      actor.ammo = actor.mag
      actor.reloadLeft = -1
      actor.fireLeft = 0
      actor.sigCd = 0
      actor.dashUntil = 0
      actor.shieldUntil = 0
      actor.resistUntil = 0
      actor.resist = 1
      actor.hasteUntil = 0
      actor.fireRateUntil = 0
      actor.vest = false
      actor.protectUntil = 0
      actor.spottedUntil = 0
      actor.knownUntil = 0
      actor.downUntil = 0
      actor.roundTags = 0
      actor.hurts = []
      actor.ads = false
      actor.waypointI = -1
      actor.targetId = -1
      depenetrate(actor, this.col)
      const vis = this.visuals.get(actor.id)
      if (vis) vis.rig.group.visible = !actor.isPlayer
    }
    for (const pickup of this.pickups) {
      pickup.active = true
      pickup.respawnAt = 0
    }
    this.ping = null
    const swap = swapped ? 'Spawns swapped' : `First to ${this.config.roundsToWin}`
    this.setBanner(this.map.name.toUpperCase(), swap, 1.2)
  }

  private pickSpawns(spawns: MapDef['spawnsA']): MapDef['spawnsA'] {
    const size = this.config.teamSize
    if (size >= spawns.length) return spawns.slice(0, size)
    const out = []
    for (let i = 0; i < size; i++) {
      const idx = Math.round((i * (spawns.length - 1)) / (size - 1))
      out.push(spawns[idx]!)
    }
    return out
  }

  private controlPlayer(player: Actor, input: InputState): void {
    if (player.state !== 'alive' && player.state !== 'downed') return
    let ix = 0
    let iz = 0
    if (input.keys.has('w')) iz += 1
    if (input.keys.has('s')) iz -= 1
    if (input.keys.has('d')) ix += 1
    if (input.keys.has('a')) ix -= 1
    const f = look(player.yaw, 0)
    const rx = Math.cos(player.yaw)
    const rz = -Math.sin(player.yaw)
    const len = Math.hypot(ix, iz)
    if (len > 0) {
      player.wishX = (f.x * iz + rx * ix) / len
      player.wishZ = (f.z * iz + rz * ix) / len
    } else {
      player.wishX = 0
      player.wishZ = 0
    }
    const sprint = input.keys.has('shift') && player.state === 'alive'
    player.ads = input.right && player.state === 'alive'
    let speed = player.state === 'downed' ? 2.15 : sprint ? 8.45 : 6.15
    if (player.agentId === 'blitz') speed *= 1.08
    if (player.hasteUntil > this.now) speed *= 1.34
    if (player.ads) speed *= weaponById(player.weaponId).adsMove
    player.wishSpeed = len > 0 ? speed : 0
    player.wantJump = input.keys.has(' ') && player.state === 'alive'
  }

  private moveActor(actor: Actor, dt: number): void {
    if (actor.state === 'dead') return
    const dashing = actor.dashUntil > this.now
    if (dashing) {
      actor.vx = actor.dashX * 33
      actor.vz = actor.dashZ * 33
    } else {
      let speed = actor.wishSpeed
      if (!actor.isPlayer && actor.state === 'alive') {
        if (actor.agentId === 'blitz') speed *= 1.08
        if (actor.hasteUntil > this.now) speed *= 1.34
        if (actor.ads) speed *= weaponById(actor.weaponId).adsMove
      }
      steer(actor, actor.wishX, actor.wishZ, speed, dt, !actor.onGround)
      if (actor.wantJump && actor.onGround) {
        actor.vy = JUMP
        actor.onGround = false
      }
    }
    actor.wantJump = false
    simulate(actor, dt, this.col, this.gravity)
    actor.moving = Math.hypot(actor.vx, actor.vz) > 1.2
    if (dashing && Math.floor(this.now * 24) !== Math.floor((this.now - dt) * 24)) {
      this.splats.add(actor.x, actor.y + 0.05, actor.z, 0, 1, 0, this.paintOf(actor), 0.55)
    }
  }

  private separate(): void {
    for (let i = 0; i < this.actors.length; i++) {
      const a = this.actors[i]!
      if (a.state === 'dead') continue
      for (let j = i + 1; j < this.actors.length; j++) {
        const b = this.actors[j]!
        if (b.state === 'dead') continue
        if (Math.abs(a.y - b.y) > 1.5) continue
        let dx = b.x - a.x
        let dz = b.z - a.z
        let dist = Math.hypot(dx, dz)
        const min = BODY_RADIUS * 2
        if (dist >= min) continue
        if (dist < 1e-4) {
          dx = 1
          dz = 0
          dist = 1
        }
        const push = (min - dist) / 2 / dist
        a.x -= dx * push
        a.z -= dz * push
        b.x += dx * push
        b.z += dz * push
      }
    }
  }

  private tryFire(actor: Actor, held: boolean, edge: boolean): void {
    if (this.phase !== 'live' || actor.state !== 'alive') return
    const weapon = weaponById(actor.weaponId)
    const wants = weapon.auto ? held || edge : edge
    if (!wants) return
    if (actor.reloadLeft > 0 || actor.fireLeft > 0) return
    if (actor.ammo <= 0) {
      this.startReload(actor)
      return
    }
    actor.ammo -= 1
    actor.shots += 1
    const rate = actor.fireRateUntil > this.now ? 0.38 : 1
    actor.fireLeft = (60 / weapon.rpm) * rate
    const { f, r, u } = basis(actor.yaw, actor.pitch)
    const eye = this.eye(actor)
    const ox = eye.x + f.x * 0.45
    const oy = eye.y + f.y * 0.45
    const oz = eye.z + f.z * 0.45
    const moving = Math.hypot(actor.vx, actor.vz) > 4.2
    let spread = actor.ads ? weapon.spreadAds : weapon.spread
    if (!(actor.ads && actor.weaponId === 'sniper')) {
      if (moving) spread *= 1.65
      if (!actor.onGround) spread *= 1.7
    }
    const shotId = this.shotSeq++
    for (let i = 0; i < weapon.pellets; i++) {
      let damage = weapon.damage
      if (weapon.id === 'rapid') damage = 26 + this.rng() * 10
      const dir = this.spread(f, r, u, spread, this.rng)
      this.spawn({
        kind: 'ball',
        ownerId: actor.id,
        team: actor.team,
        weaponId: weapon.id,
        shotId,
        x: ox,
        y: oy,
        z: oz,
        vx: dir.x * weapon.speed,
        vy: dir.y * weapon.speed,
        vz: dir.z * weapon.speed,
        gravity: weapon.gravity * this.projGravityScale,
        radius: weapon.id === 'sniper' ? 0.09 : 0.075,
        damage,
        blast: 0,
        blastRadius: 0,
        life: weapon.id === 'sniper' ? 1.7 : 1.35,
        arm: 0,
        color: this.paintOf(actor),
      })
    }
    actor.flashUntil = this.now + 0.04
    if (actor.isPlayer) {
      this.recoil = weapon.id === 'sniper' ? 0.05 : weapon.id === 'splash' ? 0.028 : 0.012
      this.audio.shoot(weapon.id)
    } else if (this.near(actor, 32)) this.audio.shoot(weapon.id)
    if (actor.ammo <= 0) this.startReload(actor)
  }

  private startReload(actor: Actor): void {
    if (actor.state !== 'alive' || actor.reloadLeft > 0 || actor.ammo >= actor.mag) return
    actor.reloadLeft = weaponById(actor.weaponId).reload
    if (actor.isPlayer) this.audio.reload()
  }

  private spread(
    f: { x: number; y: number; z: number },
    r: { x: number; y: number; z: number },
    u: { x: number; y: number; z: number },
    degrees: number,
    rng: () => number,
  ) {
    const mag = Math.tan((degrees * Math.PI) / 180)
    let rx = 0
    let ry = 0
    for (let i = 0; i < 5; i++) {
      rx = rng() * 2 - 1
      ry = rng() * 2 - 1
      if (rx * rx + ry * ry <= 1) break
    }
    const x = f.x + r.x * rx * mag + u.x * ry * mag
    const y = f.y + r.y * rx * mag + u.y * ry * mag
    const z = f.z + r.z * rx * mag + u.z * ry * mag
    const len = Math.hypot(x, y, z) || 1
    return { x: x / len, y: y / len, z: z / len }
  }

  private spawn(partial: Omit<Projectile, 'id' | 'px' | 'py' | 'pz' | 'age' | 'stickId' | 'stuck' | 'alive'>): void {
    const proj: Projectile = {
      ...partial,
      id: this.projSeq++,
      px: partial.x,
      py: partial.y,
      pz: partial.z,
      age: 0,
      stickId: -1,
      stuck: false,
      alive: true,
    }
    this.projectiles.push(proj)
  }

  private updateProjectiles(dt: number): void {
    for (const proj of this.projectiles) {
      if (!proj.alive) continue
      if (proj.stuck) {
        if (proj.stickId >= 0) {
          const host = this.actor(proj.stickId)
          if (host && host.state !== 'dead') {
            proj.x = host.x
            proj.y = host.y + 1.25
            proj.z = host.z
          }
        }
        proj.age += dt
        proj.life -= dt
        if (proj.kind === 'dart') this.pulseDart(proj)
        if (proj.life <= 0) proj.alive = false
        continue
      }
      proj.px = proj.x
      proj.py = proj.y
      proj.pz = proj.z
      proj.vy -= proj.gravity * dt
      proj.x += proj.vx * dt
      proj.y += proj.vy * dt
      proj.z += proj.vz * dt
      proj.age += dt
      proj.life -= dt
      const dx = proj.x - proj.px
      const dy = proj.y - proj.py
      const dz = proj.z - proj.pz
      const length = Math.hypot(dx, dy, dz)
      const world = segmentCast(this.col, proj.px, proj.py, proj.pz, proj.x, proj.y, proj.z)
      let best = world ? world.t : Infinity
      let mode: 'world' | 'actor' | 'shield' | null = world ? 'world' : null
      let victim: Actor | null = null
      let head = false
      let hx = world?.x ?? proj.x
      let hy = world?.y ?? proj.y
      let hz = world?.z ?? proj.z
      let nx = world?.nx ?? 0
      let ny = world?.ny ?? 1
      let nz = world?.nz ?? 0

      for (const actor of this.actors) {
        if (actor.shieldUntil < this.now || actor.state === 'dead' || actor.team === proj.team) continue
        const hit = this.shieldDistance(proj, actor, length)
        if (hit !== null && hit < best) {
          best = hit
          mode = 'shield'
          const t = length > 0 ? hit / length : 0
          hx = proj.px + dx * t
          hy = proj.py + dy * t
          hz = proj.pz + dz * t
          const fwd = look(actor.yaw, 0)
          nx = fwd.x
          ny = 0
          nz = fwd.z
          victim = actor
        }
      }

      for (const actor of this.actors) {
        if (actor.team === proj.team || actor.id === proj.ownerId || actor.state === 'dead') continue
        const feetY = actor.y + (actor.state === 'downed' ? 0.25 : 0.35)
        const topY = actor.y + (actor.state === 'downed' ? 0.7 : 1.2)
        const body = closestSegments(proj.px, proj.py, proj.pz, proj.x, proj.y, proj.z, actor.x, feetY, actor.z, actor.x, topY, actor.z)
        const headY = actor.y + (actor.state === 'downed' ? 0.85 : 1.55)
        const headHit = closestSegments(proj.px, proj.py, proj.pz, proj.x, proj.y, proj.z, actor.x, headY, actor.z, actor.x, headY, actor.z)
        const bodyOk = body.dist <= 0.42 + proj.radius
        const headOk = actor.state !== 'downed' && headHit.dist <= 0.28 + proj.radius
        if (!bodyOk && !headOk) continue
        const useHead = headOk && (!bodyOk || headHit.s <= body.s)
        const chosen = useHead ? headHit : body
        const dist = chosen.s * length
        if (dist < best) {
          best = dist
          mode = 'actor'
          victim = actor
          head = useHead
          hx = chosen.x
          hy = chosen.y
          hz = chosen.z
          nx = 0
          ny = 1
          nz = 0
        }
      }

      if (mode) {
        proj.x = hx
        proj.y = hy
        proj.z = hz
        this.resolveImpact(proj, mode, victim, head, hx, hy, hz, nx, ny, nz)
      } else if (proj.life <= 0 || proj.y < -8) {
        if (proj.kind === 'grenade' || proj.kind === 'cannon') this.explode(proj, proj.x, proj.y, proj.z)
        proj.alive = false
      }
    }
    this.projectiles.splice(0, this.projectiles.length, ...this.projectiles.filter((p) => p.alive))
    this.syncBalls()
  }

  private shieldDistance(proj: Projectile, actor: Actor, length: number): number | null {
    const fwd = look(actor.yaw, 0)
    const cx = actor.x + fwd.x * 1.05
    const cy = actor.y + 1.2
    const cz = actor.z + fwd.z * 1.05
    const dx = proj.x - proj.px
    const dy = proj.y - proj.py
    const dz = proj.z - proj.pz
    const den = dx * fwd.x + dz * fwd.z
    if (Math.abs(den) < 1e-5) return null
    const t = ((cx - proj.px) * fwd.x + (cz - proj.pz) * fwd.z) / den
    if (t < 0 || t > 1) return null
    const hy = proj.py + dy * t
    const hx = proj.px + dx * t
    const hz = proj.pz + dz * t
    const rightx = Math.cos(actor.yaw)
    const rightz = -Math.sin(actor.yaw)
    const lx = (hx - cx) * rightx + (hz - cz) * rightz
    const ly = hy - cy
    if (Math.abs(lx) > 0.8 || Math.abs(ly) > 0.78) return null
    return t * length
  }

  private resolveImpact(
    proj: Projectile,
    mode: 'world' | 'actor' | 'shield',
    victim: Actor | null,
    head: boolean,
    x: number,
    y: number,
    z: number,
    nx: number,
    ny: number,
    nz: number,
  ): void {
    const owner = this.actor(proj.ownerId)
    if (proj.kind === 'dart') {
      proj.stuck = true
      proj.vx = proj.vy = proj.vz = 0
      proj.gravity = 0
      if (mode === 'actor' && victim) proj.stickId = victim.id
      this.splats.add(x, y, z, nx, ny, nz, proj.color, 0.7)
      if (this.nearPos(x, y, z, 30)) this.audio.splat()
      return
    }
    if (proj.kind === 'pack') {
      this.pulsePack(proj, x, y, z)
      proj.alive = false
      return
    }
    if (proj.kind === 'grenade' || proj.kind === 'cannon') {
      if (proj.age >= proj.arm) this.explode(proj, x, y, z)
      else proj.alive = false
      return
    }
    if (mode === 'shield') {
      this.splats.add(x, y, z, nx, ny, nz, proj.color, 0.45)
      proj.alive = false
      if (this.nearPos(x, y, z, 28)) this.audio.splat()
      return
    }
    if (mode === 'actor' && victim) {
      const traveled = Math.hypot(x - (owner?.x ?? x), y - (owner?.y ?? y), z - (owner?.z ?? z))
      let dmg = proj.damage
      if (proj.weaponId !== 'ability') {
        const weapon = weaponById(proj.weaponId)
        if (traveled > weapon.falloffStart) {
          const t = clamp((traveled - weapon.falloffStart) / (weapon.falloffEnd - weapon.falloffStart), 0, 1)
          dmg = lerp(dmg, weapon.minDamage, t)
        }
      }
      if (head) dmg *= 2
      this.noteHit(proj, head)
      this.hurt(victim, dmg, owner, head, 'gun')
      this.splats.add(x, victim.y + 1.1, z, 0, 0, 1, proj.color, head ? 0.55 : 0.4)
    } else {
      this.splats.add(x, y, z, nx, ny, nz, proj.color, 0.48 + Math.random() * 0.25)
      if (this.nearPos(x, y, z, 26)) this.audio.splat()
    }
    proj.alive = false
  }

  private pulseDart(proj: Projectile): void {
    if (Math.floor(proj.age * 4) === Math.floor((proj.age - 0.02) * 4)) return
    const owner = this.actor(proj.ownerId)
    const extra = owner?.agentId === 'scout' ? 1.4 : 0.4
    for (const actor of this.actors) {
      if (actor.team === proj.team || actor.state === 'dead') continue
      const dist = Math.hypot(actor.x - proj.x, actor.y - proj.y, actor.z - proj.z)
      const stuck = proj.stickId === actor.id
      if (stuck || dist < 18) {
        actor.spottedUntil = Math.max(actor.spottedUntil, this.now + extra)
        actor.knownUntil = Math.max(actor.knownUntil, this.now + extra)
      }
    }
  }

  private pulsePack(proj: Projectile, x: number, y: number, z: number): void {
    const owner = this.actor(proj.ownerId)
    let helped = false
    for (const actor of this.actors) {
      if (actor.team !== proj.team || actor.state === 'dead') continue
      if (Math.hypot(actor.x - x, actor.z - z) > 4.6) continue
      if (actor.state === 'downed') {
        this.revive(actor, 55, owner)
        helped = true
      } else if (this.heal(actor, 35) > 0) helped = true
    }
    if (owner && owner.state === 'alive') {
      if (!helped) this.heal(owner, 40)
      else if (Math.hypot(owner.x - x, owner.z - z) < 4.6) this.heal(owner, 15)
    }
    this.splats.add(x, y, z, 0, 1, 0, 0x5dff9a, 1.4)
    if (owner?.isPlayer || this.nearPos(x, y, z, 24)) this.audio.ult()
  }

  private explode(proj: Projectile, x: number, y: number, z: number): void {
    proj.alive = false
    const owner = this.actor(proj.ownerId)
    const radius = proj.blastRadius
    const paint = proj.color
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2
      this.splats.add(x + Math.cos(a) * radius * 0.45, y + 0.05, z + Math.sin(a) * radius * 0.45, 0, 1, 0, paint, 0.7)
    }
    for (const actor of this.actors) {
      if (actor.state === 'dead' || actor.team === proj.team) continue
      const dist = Math.hypot(actor.x - x, actor.y + 0.8 - y, actor.z - z)
      if (dist > radius) continue
      if (!this.clearLine(x, y, z, actor.x, actor.y + 1, actor.z)) continue
      const fall = 1 - dist / radius
      const dmg = proj.blast * (0.32 + 0.68 * fall)
      this.noteHit(proj, false)
      this.hurt(actor, dmg, owner, false, 'blast')
    }
    if (owner && owner.state !== 'dead') {
      const dist = Math.hypot(owner.x - x, owner.y + 0.8 - y, owner.z - z)
      if (dist < radius * 0.85) {
        const fall = 1 - dist / radius
        const self = Math.min(proj.kind === 'cannon' ? 36 : 24, proj.blast * fall * 0.28)
        if (self > 6) this.hurt(owner, self, null, false, 'blast')
      }
    }
    if (this.nearPos(x, y, z, 40)) this.audio.explode()
  }

  private noteHit(proj: Projectile, head: boolean): void {
    if (proj.weaponId === 'ability') return
    const owner = this.actor(proj.ownerId)
    if (!owner) return
    if (!this.hitShots.has(proj.shotId)) {
      this.hitShots.add(proj.shotId)
      owner.hits += 1
      if (head) {
        owner.headshots += 1
        this.headShots.add(proj.shotId)
      }
      if (owner.isPlayer) {
        this.hitSeq += 1
        this.hitHead = head
        this.audio.hit(head)
      }
      return
    }
    if (head && !this.headShots.has(proj.shotId)) {
      this.headShots.add(proj.shotId)
      owner.headshots += 1
      if (owner.isPlayer) this.hitHead = true
    }
  }

  private hurt(target: Actor, amount: number, attacker: Actor | null, head: boolean, cause: 'gun' | 'blast' | 'dash' | 'storm'): void {
    if (target.state === 'dead' || amount <= 0) return
    if (cause !== 'storm' && target.protectUntil > this.now) return
    if (cause !== 'storm' && cause !== 'blast' && target.vest) {
      target.vest = false
      this.pushFeed(`${this.label(attacker)} soaked off ${target.isPlayer ? 'your' : `${target.name}'s`} vest`, 'neutral')
      this.splats.add(target.x, target.y + 1.2, target.z, 0, 1, 0, 0xf4f7ff, 0.9)
      return
    }
    let dmg = amount
    if (target.resistUntil > this.now) dmg *= target.resist
    if (target.state === 'downed') {
      if (cause === 'storm') {
        target.downUntil -= dtStorm(dmg)
        return
      }
      this.eliminate(target, attacker, 'pop')
      return
    }
    target.hp -= dmg
    if (attacker && attacker !== target) {
      attacker.damage += dmg
      attacker.ult = Math.min(100, attacker.ult + dmg * 0.16)
      target.hurts.push({ id: attacker.id, time: this.now, amount: dmg })
      target.hurtFromX = attacker.x
      target.hurtFromZ = attacker.z
    }
    if (cause !== 'storm') {
      target.flashUntil = this.now + 0.09
      target.hurtUntil = this.now + 0.4
      if (target.isPlayer) this.pain = Math.min(1, this.pain + 0.45)
      this.floaters.push({
        x: target.x,
        y: target.y + 1.7,
        z: target.z,
        text: `${head ? 'HEAD ' : ''}${Math.round(dmg)}`,
        head,
        life: 0.7,
      })
      if (this.floaters.length > 16) this.floaters.shift()
    } else if (target.isPlayer) {
      target.hurtUntil = this.now + 0.25
      const dx = target.x - this.stormX
      const dz = target.z - this.stormZ
      target.hurtFromX = target.x + dx
      target.hurtFromZ = target.z + dz
      this.pain = Math.min(1, this.pain + 0.08)
    }
    if (target.hp <= 0) {
      if (this.canDown(target)) this.drop(target, attacker)
      else this.eliminate(target, attacker, cause === 'storm' ? 'mist' : 'tag')
    }
  }

  private canDown(target: Actor): boolean {
    return this.actors.some((a) => a.team === target.team && a.agentId === 'medic' && a.state === 'alive' && a.id !== target.id)
  }

  private drop(target: Actor, attacker: Actor | null): void {
    target.state = 'downed'
    target.hp = 0
    target.downUntil = this.now + 8
    target.downerId = attacker?.id ?? -1
    target.wishSpeed = 0
    this.pushFeed(`${this.label(attacker)} dropped ${target.isPlayer ? 'you' : target.name}`, attacker?.team ?? 'neutral')
    if (target.isPlayer || attacker?.isPlayer) this.audio.down()
  }

  private eliminate(target: Actor, attacker: Actor | null, how: 'tag' | 'pop' | 'bleed' | 'mist'): void {
    if (target.state === 'dead') return
    target.state = 'dead'
    target.hp = 0
    target.deaths += 1
    const verb = how === 'pop' ? 'popped' : how === 'bleed' ? 'left' : 'tagged'
    if (how === 'bleed' && !attacker) attacker = this.actor(target.downerId)
    if (attacker && attacker.id !== target.id && how !== 'bleed') {
      attacker.tags += 1
      attacker.roundTags += 1
      attacker.ult = Math.min(100, attacker.ult + 18)
      const seen = new Set<number>([attacker.id])
      for (const hit of target.hurts) {
        if (this.now - hit.time > 8 || seen.has(hit.id)) continue
        seen.add(hit.id)
        const mate = this.actor(hit.id)
        if (mate) mate.assists += 1
      }
      if (this.firstBlood) {
        this.firstBlood = false
        this.setBanner('FIRST TAG', `${attacker.isPlayer ? 'You' : attacker.name} opened the round`, 1.4)
      }
      if (attacker.isPlayer && attacker.roundTags >= this.config.teamSize) {
        this.setBanner('CLEAN SWEEP', 'Every opposing marker is down', 1.6)
      }
    } else if (how === 'bleed' && attacker && attacker.id !== target.id) {
      attacker.tags += 1
      attacker.roundTags += 1
    }
    const tone = attacker?.team ?? 'neutral'
    if (how === 'mist' || (!attacker && how !== 'bleed')) {
      this.pushFeed(`The mist tagged ${target.isPlayer ? 'you' : target.name}`, 'neutral')
    } else {
      this.pushFeed(`${this.label(attacker)} ${verb} ${target.isPlayer ? 'you' : target.name}`, tone)
    }
    this.burst(target)
    const vis = this.visuals.get(target.id)
    if (vis) vis.rig.group.visible = false
    if (target.isPlayer && this.phase === 'live') this.spectateId = this.nextLiving(target.team)
  }

  private heal(actor: Actor, amount: number): number {
    if (actor.state !== 'alive') return 0
    const before = actor.hp
    actor.hp = Math.min(100, actor.hp + amount)
    return actor.hp - before
  }

  private revive(actor: Actor, hp: number, medic: Actor | null): void {
    actor.state = 'alive'
    actor.hp = hp
    actor.downUntil = 0
    actor.protectUntil = this.now + 0.55
    const vis = this.visuals.get(actor.id)
    if (vis && !actor.isPlayer) vis.rig.group.visible = true
    if (medic && medic.state !== 'dead') {
      medic.revives += 1
      medic.ult = Math.min(100, medic.ult + 12)
    }
    this.pushFeed(`${actor.isPlayer ? 'You are' : `${actor.name} is`} back in`, actor.team)
  }

  private signature(actor: Actor): void {
    if (this.phase !== 'live' || actor.state !== 'alive' || actor.sigCd > 0) return
    const agent = agentById(actor.agentId)
    actor.sigCd = agent.cd
    if (actor.agentId === 'blitz') {
      const dir = look(actor.yaw, 0)
      actor.dashUntil = this.now + 0.2
      actor.dashX = dir.x
      actor.dashZ = dir.z
      actor.dashHits = []
      if (actor.isPlayer) this.audio.dash()
    } else if (actor.agentId === 'guardian') {
      actor.shieldUntil = this.now + 3.2
      if (actor.isPlayer) this.audio.shoot('ability')
    } else if (actor.agentId === 'scout') {
      const dir = look(actor.yaw, actor.pitch)
      const eye = this.eye(actor)
      this.spawn({
        kind: 'dart',
        ownerId: actor.id,
        team: actor.team,
        weaponId: 'ability',
        shotId: this.shotSeq++,
        x: eye.x + dir.x * 0.6,
        y: eye.y + dir.y * 0.6,
        z: eye.z + dir.z * 0.6,
        vx: dir.x * 48,
        vy: dir.y * 48,
        vz: dir.z * 48,
        gravity: 6 * this.projGravityScale,
        radius: 0.1,
        damage: 0,
        blast: 0,
        blastRadius: 0,
        life: 8,
        arm: 0,
        color: 0xb388ff,
      })
      if (actor.isPlayer) this.audio.shoot('ability')
    } else if (actor.agentId === 'splatter') {
      this.lob(actor, 'grenade', 16, 7.5, 52, 5.2, 0xff4d8d, 0.16)
    } else {
      this.lob(actor, 'pack', 14, 6.5, 0, 0, 0x5dff9a, 0.18)
    }
  }

  private ultimate(actor: Actor): void {
    if (this.phase !== 'live' || actor.state !== 'alive' || actor.ult < 100) return
    actor.ult = 0
    if (actor.isPlayer || this.near(actor, 30)) this.audio.ult()
    if (actor.agentId === 'blitz') {
      actor.fireRateUntil = this.now + 7
      actor.ammo = actor.mag
      actor.reloadLeft = -1
      this.setBanner(actor.isPlayer ? 'TRIGGER STORM' : `${actor.name} is hot`, 'Fire rate up', 1.2)
    } else if (actor.agentId === 'guardian') {
      actor.resistUntil = this.now + 6
      actor.resist = 0.5
      actor.shieldUntil = Math.max(actor.shieldUntil, this.now + 6)
      for (const mate of this.actors) {
        if (mate.team !== actor.team || mate.id === actor.id || mate.state !== 'alive') continue
        if (Math.hypot(mate.x - actor.x, mate.z - actor.z) > 8) continue
        mate.resistUntil = this.now + 6
        mate.resist = Math.min(mate.resist, 0.75)
      }
      this.setBanner(actor.isPlayer ? 'FORTIFY' : `${actor.name} fortifies`, 'Damage cut in half', 1.2)
    } else if (actor.agentId === 'scout') {
      for (const enemy of this.actors) {
        if (enemy.team === actor.team || enemy.state === 'dead') continue
        enemy.spottedUntil = Math.max(enemy.spottedUntil, this.now + 5)
        enemy.knownUntil = Math.max(enemy.knownUntil, this.now + 5)
      }
      this.setBanner(actor.isPlayer ? 'FULL SCAN' : `${actor.name} scans`, 'Everyone is marked', 1.2)
    } else if (actor.agentId === 'splatter') {
      const dir = look(actor.yaw, actor.pitch)
      const eye = this.eye(actor)
      this.spawn({
        kind: 'cannon',
        ownerId: actor.id,
        team: actor.team,
        weaponId: 'ability',
        shotId: this.shotSeq++,
        x: eye.x + dir.x * 0.8,
        y: eye.y + dir.y * 0.8,
        z: eye.z + dir.z * 0.8,
        vx: dir.x * 32,
        vy: dir.y * 32 + 2,
        vz: dir.z * 32,
        gravity: 5 * this.projGravityScale,
        radius: 0.32,
        damage: 0,
        blast: 80,
        blastRadius: 6.4,
        life: 3,
        arm: 0.12,
        color: this.paintOf(actor),
      })
    } else {
      for (const mate of this.actors) {
        if (mate.team !== actor.team || mate.state === 'dead') continue
        if (mate.state === 'downed') this.revive(mate, 50, actor)
        else this.heal(mate, 40)
      }
      this.setBanner(actor.isPlayer ? 'TEAM HEAL' : `${actor.name} heals`, 'Fresh paint for the squad', 1.2)
    }
  }

  private lob(actor: Actor, kind: 'grenade' | 'pack', speed: number, lift: number, blast: number, radius: number, color: number, size: number): void {
    const dir = look(actor.yaw, actor.pitch)
    const eye = this.eye(actor)
    this.spawn({
      kind,
      ownerId: actor.id,
      team: actor.team,
      weaponId: 'ability',
      shotId: this.shotSeq++,
      x: eye.x + dir.x * 0.7,
      y: eye.y + dir.y * 0.7,
      z: eye.z + dir.z * 0.7,
      vx: dir.x * speed + actor.vx * 0.25,
      vy: dir.y * speed + lift,
      vz: dir.z * speed + actor.vz * 0.25,
      gravity: 14 * this.projGravityScale,
      radius: size,
      damage: 0,
      blast,
      blastRadius: radius,
      life: 2.4,
      arm: 0.12,
      color,
    })
    if (actor.isPlayer) this.audio.shoot('ability')
  }

  private dashTouch(actor: Actor): void {
    for (const other of this.actors) {
      if (other.team === actor.team || other.state === 'dead' || actor.dashHits.includes(other.id)) continue
      if (Math.hypot(other.x - actor.x, other.z - actor.z) > 1.35) continue
      if (Math.abs(other.y - actor.y) > 1.4) continue
      actor.dashHits.push(other.id)
      this.hurt(other, 18, actor, false, 'dash')
    }
  }

  private updatePickups(): void {
    this.pickups.forEach((pickup, index) => {
      const mesh = this.pickupMeshes[index]
      if (!pickup.active) {
        if (mesh) mesh.visible = false
        if (this.now >= pickup.respawnAt) pickup.active = true
        return
      }
      if (mesh) {
        mesh.visible = true
        mesh.position.y = 0.85 + Math.sin(this.now * 3 + index) * 0.12
        mesh.rotation.y = this.now * 2
      }
      for (const actor of this.actors) {
        if (actor.state !== 'alive') continue
        if (Math.hypot(actor.x - pickup.x, actor.z - pickup.z) > 1.35) continue
        if (Math.abs(actor.y - pickup.y) > 2) continue
        if (pickup.kind === 'speed') actor.hasteUntil = this.now + 8
        else if (pickup.kind === 'vest') actor.vest = true
        else {
          actor.ammo = actor.mag + Math.ceil(actor.mag * 0.5)
          actor.reloadLeft = -1
        }
        pickup.active = false
        pickup.respawnAt = this.now + 18
        if (actor.isPlayer) {
          const name = pickup.kind === 'speed' ? 'SPEED GEL' : pickup.kind === 'vest' ? 'IMPACT VEST' : 'EXTRA HOPPER'
          this.setBanner(name, 'Power-up online', 1)
          this.audio.ui()
        }
        break
      }
    })
  }

  private updateStorm(dt: number): void {
    if (!this.stormEnabled) {
      this.stormMesh.visible = false
      this.nextRing.visible = false
      return
    }
    this.stormMesh.visible = true
    if (!this.overtime) {
      this.stormClock += dt
      if (this.stormClock >= 30 && this.stormIndex < this.stormPlan.length - 1) {
        this.stormClock = 0
        this.stormIndex += 1
        this.setBanner('MIST CLOSING', 'Get inside the paint', 1.4)
      }
    }
    const plan = this.stormPlan[Math.min(this.stormIndex, this.stormPlan.length - 1)]!
    const targetR = this.overtime ? 5 : plan.r
    const targetX = this.overtime ? this.stormX : plan.x
    const targetZ = this.overtime ? this.stormZ : plan.z
    this.stormRadius = lerp(this.stormRadius, targetR, 1 - Math.exp(-dt * 1.4))
    this.stormX = lerp(this.stormX, targetX, 1 - Math.exp(-dt * 1.4))
    this.stormZ = lerp(this.stormZ, targetZ, 1 - Math.exp(-dt * 1.4))
    this.stormMesh.scale.set(this.stormRadius, 1, this.stormRadius)
    this.stormMesh.position.x = this.stormX
    this.stormMesh.position.z = this.stormZ
    const mat = this.stormMesh.material as THREE.MeshBasicMaterial
    mat.opacity = 0.1 + Math.sin(this.now * 3) * 0.03
    const next = this.stormPlan[this.stormIndex + 1]
    const warn = !this.overtime && next && this.stormClock > 22
    this.nextRing.visible = Boolean(warn)
    if (next && warn) {
      this.nextRing.position.x = next.x
      this.nextRing.position.z = next.z
      this.nextRing.scale.set(next.r, next.r, 1)
    }
    const dps = this.overtime ? 12 : plan.dps
    for (const actor of this.actors) {
      if (actor.state === 'dead') continue
      if (!this.outside(actor)) continue
      this.hurt(actor, dps * dt, null, false, 'storm')
      if (actor.isPlayer && Math.floor(this.now * 2) !== Math.floor((this.now - dt) * 2)) {
        this.splats.add(actor.x, actor.y + 0.2, actor.z, 0, 1, 0, 0xff4d8d, 0.6)
      }
    }
  }

  private outside(actor: Actor): boolean {
    return Math.hypot(actor.x - this.stormX, actor.z - this.stormZ) > this.stormRadius
  }

  private checkClock(): void {
    const blue = this.actors.filter((a) => a.team === 'blue' && a.state === 'alive').length
    const orange = this.actors.filter((a) => a.team === 'orange' && a.state === 'alive').length
    if (blue === orange) {
      this.overtime = true
      this.setBanner('OVERTIME', 'The mist is the tiebreaker', 1.5)
      return
    }
    this.endRound(blue > orange ? 'blue' : 'orange')
  }

  private resolveRound(): void {
    if (this.phase !== 'live') return
    const blue = this.actors.some((a) => a.team === 'blue' && a.state !== 'dead')
    const orange = this.actors.some((a) => a.team === 'orange' && a.state !== 'dead')
    if (blue && orange) return
    if (!blue && !orange) {
      this.setBanner('WASHED OUT', 'Nobody left standing', 1.2)
      this.phase = 'end'
      this.endAt = this.now + 2.4
      return
    }
    this.endRound(blue ? 'blue' : 'orange')
  }

  private endRound(winner: Team): void {
    if (this.phase !== 'live') return
    this.score[winner] += 1
    const won = winner === 'blue'
    this.setBanner(won ? 'ROUND WON' : 'ROUND LOST', `${this.score.blue} – ${this.score.orange}`, 2.4)
    if (won) this.audio.win()
    else this.audio.lose()
    this.spawnConfetti(won)
    if (this.score[winner] >= this.config.roundsToWin) {
      this.phase = 'match'
      this.finish(won)
    } else {
      this.phase = 'end'
      this.endAt = this.now + 3.3
    }
  }

  private finish(won: boolean): void {
    if (this.reported) return
    this.reported = true
    const p = this.player
    this.onResult({
      won,
      blue: this.score.blue,
      orange: this.score.orange,
      stats: {
        tags: p.tags,
        deaths: p.deaths,
        assists: p.assists,
        damage: Math.round(p.damage),
        shots: p.shots,
        hits: p.hits,
        headshots: p.headshots,
        revives: p.revives,
      },
    })
  }

  private planStorm(): { r: number; dps: number; x: number; z: number }[] {
    const base = this.map.storm
    const scales = [1, 0.72, 0.5, 0.33, 0.18]
    const dps = [6, 6, 8, 10, 12]
    let x = base.x
    let z = base.z
    return scales.map((scale, i) => {
      if (i > 0) {
        const ang = this.rng() * Math.PI * 2
        const dist = this.rng() * base.radius * 0.18 * scale
        x += Math.cos(ang) * dist
        z += Math.sin(ang) * dist
      }
      return { r: base.radius * scale, dps: dps[i]!, x, z }
    })
  }

  private updateCamera(dt: number): void {
    const player = this.player
    const controls = this.getControls()
    if (player.state === 'dead') {
      const target = this.actor(this.spectateId) ?? this.actors.find((a) => a.state !== 'dead') ?? player
      const dist = 5.5
      const cp = Math.cos(this.orbitPitch)
      this.camera.position.set(
        target.x - Math.sin(this.orbitYaw) * dist * cp,
        target.y + 1.5 + Math.sin(this.orbitPitch) * dist,
        target.z - Math.cos(this.orbitYaw) * dist * cp,
      )
      this.camera.lookAt(target.x, target.y + 1.2, target.z)
      this.view.visible = false
      return
    }
    const eye = player.state === 'downed' ? 0.62 : EYE
    let bob = 0
    let roll = 0
    if (controls.bob && player.onGround && player.moving && player.state === 'alive') {
      bob = Math.sin(this.now * 10) * 0.035
      roll = Math.sin(this.now * 5) * 0.012
    }
    this.camera.position.set(player.x, player.y + eye + bob, player.z)
    this.camera.rotation.order = 'YXZ'
    this.camera.rotation.y = player.yaw
    this.camera.rotation.x = -player.pitch + this.recoil + this.pain * 0.02
    this.camera.rotation.z = roll
    const scoped = player.ads && player.state === 'alive'
    const targetFov = scoped ? weaponById(player.weaponId).adsFov : 74
    this.fov = lerp(this.fov, targetFov, 1 - Math.exp(-12 * dt))
    if (Math.abs(this.camera.fov - this.fov) > 0.05) {
      this.camera.fov = this.fov
      this.camera.updateProjectionMatrix()
    }
    const hideGun = player.weaponId === 'sniper' && scoped || player.state === 'downed'
    this.view.visible = !hideGun
    const reloadDip = player.reloadLeft > 0 ? Math.sin((1 - player.reloadLeft / weaponById(player.weaponId).reload) * Math.PI) : 0
    this.view.position.set(0.34, -0.3 - bob * 0.4 - reloadDip * 0.18, -0.55 + this.recoil * 2)
    this.view.rotation.set(reloadDip * 0.8, 0.04, 0)
  }

  private updateVisuals(dt: number): void {
    for (const actor of this.actors) {
      const vis = this.visuals.get(actor.id)
      if (!vis) continue
      vis.rig.group.position.set(actor.x, actor.y, actor.z)
      vis.rig.group.rotation.y = actor.yaw
      vis.rig.update(this.now, actor.moving, actor.state === 'downed')
      vis.rig.group.visible = actor.state !== 'dead'
      const body = vis.rig.group.getObjectByName('agent-body')
      if (body) body.visible = !actor.isPlayer
      vis.shield.visible = actor.shieldUntil > this.now && actor.state !== 'dead'
      vis.fortify.visible = actor.resistUntil > this.now && actor.state === 'alive'
      vis.flash.visible = actor.flashUntil > this.now && !actor.isPlayer
      const spotted = actor.team === 'orange' && actor.spottedUntil > this.now && actor.state !== 'dead'
      vis.chevron.visible = spotted
      const showInfo = !actor.isPlayer && actor.state !== 'dead' && (actor.team === 'blue' || spotted || actor.hurtUntil > this.now)
      vis.label.visible = showInfo && actor.team === 'blue'
      vis.bar.visible = showInfo
      if (actor.state === 'downed') {
        const pct = clamp((actor.downUntil - this.now) / 8, 0, 1)
        vis.fill.scale.x = Math.max(0.05, 0.8 * pct)
        vis.fill.position.x = (vis.fill.scale.x - 0.8) * 0.5
      } else {
        const pct = clamp(actor.hp / 100, 0, 1)
        vis.fill.scale.x = Math.max(0.02, 0.8 * pct)
        vis.fill.position.x = (vis.fill.scale.x - 0.8) * 0.5
      }
      vis.bar.lookAt(this.camera.position)
      void dt
    }
    if (this.ping && this.ping.until > this.now) {
      this.pingMesh.visible = true
      this.pingMesh.position.set(this.ping.x, this.ping.y + 1.2 + Math.sin(this.now * 4) * 0.15, this.ping.z)
    } else this.pingMesh.visible = false
  }

  private syncBalls(): void {
    let n = 0
    for (const proj of this.projectiles) {
      if (!proj.alive) continue
      let mesh = this.ballPool[n]
      if (!mesh) {
        mesh = new THREE.Mesh(GEO.sphereSm, new THREE.MeshBasicMaterial({ color: 0xffffff }))
        this.scene.add(mesh)
        this.ballPool[n] = mesh
      }
      mesh.visible = true
      const mat = mesh.material as THREE.MeshBasicMaterial
      mat.color.setHex(proj.color)
      const s = proj.kind === 'cannon' ? 0.34 : proj.kind === 'grenade' ? 0.18 : proj.kind === 'pack' ? 0.2 : proj.radius
      mesh.scale.setScalar(s)
      mesh.position.set(proj.x, proj.y, proj.z)
      n += 1
    }
    for (let i = n; i < this.ballPool.length; i++) this.ballPool[i]!.visible = false
  }

  private burst(actor: Actor): void {
    const color = teamColor(actor.team)
    for (let i = 0; i < 22; i++) {
      const mesh = new THREE.Mesh(GEO.sphere, basic(i % 4 === 0 ? this.paintOf(actor) : color))
      mesh.scale.setScalar(0.12 + Math.random() * 0.18)
      mesh.position.set(actor.x, actor.y + 1, actor.z)
      this.scene.add(mesh)
      this.bits.push({
        mesh,
        vx: (Math.random() - 0.5) * 8,
        vy: 3 + Math.random() * 6,
        vz: (Math.random() - 0.5) * 8,
        life: 0.9 + Math.random() * 0.4,
      })
    }
    this.splats.add(actor.x, actor.y + 0.05, actor.z, 0, 1, 0, color, 1.5)
  }

  private spawnConfetti(won: boolean): void {
    const colors = won ? [0x3de1ff, 0xffe14a, 0xff4d8d, 0x5dff9a, 0xfff4ea] : [0x8a6a7a, 0x445066, 0xff7424]
    const origin = this.player
    for (let i = 0; i < (won ? 90 : 40); i++) {
      const mesh = new THREE.Mesh(GEO.box, basic(colors[i % colors.length]!))
      mesh.scale.set(0.12, 0.18, 0.04)
      mesh.position.set(origin.x, origin.y + 2, origin.z)
      this.scene.add(mesh)
      this.confetti.push({
        mesh,
        vx: (Math.random() - 0.5) * 14,
        vy: 6 + Math.random() * 8,
        vz: (Math.random() - 0.5) * 14,
        life: 2.4,
      })
    }
  }

  private updateBits(list: Bit[], dt: number): void {
    for (let i = list.length - 1; i >= 0; i--) {
      const bit = list[i]!
      bit.life -= dt
      bit.vy -= this.gravity * 0.35 * dt
      bit.mesh.position.x += bit.vx * dt
      bit.mesh.position.y += bit.vy * dt
      bit.mesh.position.z += bit.vz * dt
      bit.mesh.rotation.x += dt * 4
      bit.mesh.rotation.y += dt * 3
      if (bit.life <= 0) {
        this.scene.remove(bit.mesh)
        list.splice(i, 1)
      }
    }
  }

  private placePing(actor: Actor): void {
    const hit = this.aimHit(actor, 70)
    if (!hit) return
    this.ping = { x: hit.x, y: hit.y, z: hit.z, until: this.now + 5 }
    for (const bot of this.actors) {
      if (bot.team !== 'blue' || bot.isPlayer || bot.state !== 'alive') continue
      let best = -1
      let d = Infinity
      this.map.waypoints.forEach((p, i) => {
        const dist = Math.hypot(p.x - hit.x, p.z - hit.z)
        if (dist < d) {
          d = dist
          best = i
        }
      })
      if (best >= 0 && bot.targetId < 0) bot.waypointI = best
    }
  }

  private placeSpray(actor: Actor): void {
    if (this.sprayCd > 0 || actor.state !== 'alive') return
    const hit = this.aimHit(actor, 8)
    if (!hit) return
    this.sprayCd = 6
    let mesh = this.sprays[this.sprayCursor]
    if (!mesh) {
      mesh = new THREE.Mesh(
        GEO.plane,
        new THREE.MeshBasicMaterial({ map: this.sprayTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
      )
      this.scene.add(mesh)
      this.sprays[this.sprayCursor] = mesh
    }
    const n = new THREE.Vector3(hit.nx, hit.ny, hit.nz).normalize()
    mesh.position.set(hit.x, hit.y, hit.z).addScaledVector(n, 0.04)
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n)
    mesh.rotateZ(this.rng() * Math.PI * 2)
    mesh.scale.set(1.25, 1.25, 1)
    mesh.visible = true
    this.sprayCursor = (this.sprayCursor + 1) % 4
  }

  private aimHit(actor: Actor, max: number) {
    const dir = look(actor.yaw, actor.pitch)
    const eye = this.eye(actor)
    const end = { x: eye.x + dir.x * max, y: eye.y + dir.y * max, z: eye.z + dir.z * max }
    return segmentCast(this.col, eye.x, eye.y, eye.z, end.x, end.y, end.z)
  }

  private los(from: Actor, to: Actor): boolean {
    if (to.state === 'dead') return false
    return this.clearLine(from.x, from.y + EYE, from.z, to.x, to.y + (to.state === 'downed' ? 0.5 : 1.15), to.z)
  }

  private clearLine(ax: number, ay: number, az: number, bx: number, by: number, bz: number): boolean {
    const hit = segmentCast(this.col, ax, ay, az, bx, by, bz)
    if (!hit) return true
    const dist = Math.hypot(bx - ax, by - ay, bz - az)
    return hit.t > dist - 0.6
  }

  private eye(actor: Actor) {
    return { x: actor.x, y: actor.y + (actor.state === 'downed' ? 0.55 : EYE), z: actor.z }
  }

  private actor(id: number): Actor | null {
    return this.actors.find((a) => a.id === id) ?? null
  }

  private paintOf(actor: Actor): number {
    const team = teamColor(actor.team)
    if (!actor.isPlayer) return team
    const tint = cosmetic(actor.paintId).color
    return mixHex(team, tint, actor.paintId === 'classic' ? 0 : 0.55)
  }

  private label(actor: Actor | null): string {
    if (!actor) return 'The mist'
    return actor.isPlayer ? 'You' : actor.name
  }

  private near(actor: Actor, range: number): boolean {
    return Math.hypot(actor.x - this.player.x, actor.z - this.player.z) < range
  }

  private nearPos(x: number, y: number, z: number, range: number): boolean {
    return Math.hypot(x - this.player.x, y - this.player.y, z - this.player.z) < range
  }

  private pushFeed(text: string, tone: Feed['tone']): void {
    this.feedItems.push({ id: this.feedSeq++, text, tone, until: this.now + 6 })
    if (this.feedItems.length > 6) this.feedItems.shift()
  }

  private setBanner(text: string, sub: string, duration: number): void {
    this.bannerText = text
    this.bannerSub = sub
    this.bannerUntil = this.now + duration
  }

  private cycleSpectate(): void {
    const living = this.actors.filter((a) => a.state !== 'dead' && !a.isPlayer)
    if (!living.length) return
    const idx = living.findIndex((a) => a.id === this.spectateId)
    this.spectateId = living[(idx + 1) % living.length]!.id
  }

  private nextLiving(team: Team): number {
    return this.actors.find((a) => a.team === team && a.state !== 'dead' && !a.isPlayer)?.id
      ?? this.actors.find((a) => a.state !== 'dead' && !a.isPlayer)?.id
      ?? -1
  }
}

function dtStorm(dmg: number): number {
  return dmg * 0.08
}
