import type { Actor, WeaponId } from './types.ts'
import { DIFFICULTY, agentById } from './content.ts'
import type { DiffTune } from './content.ts'
import { angNorm } from './util.ts'
import { EYE } from './physics.ts'

export type AiHooks = {
  now: number
  dt: number
  actors: Actor[]
  waypoints: { x: number; y: number; z: number; cover: boolean; flank: boolean }[]
  tune: DiffTune
  allyBias: number
  los: (from: Actor, to: Actor) => boolean
  fire: (actor: Actor) => void
  signature: (actor: Actor) => void
  ultimate: (actor: Actor) => void
  rng: () => number
}

const PREFERRED: Record<WeaponId, [number, number]> = {
  rapid: [10, 24],
  sniper: [22, 48],
  splash: [5, 13],
}

export function tickBot(bot: Actor, hooks: AiHooks): void {
  if (bot.state === 'dead') {
    bot.wishSpeed = 0
    return
  }
  if (bot.state === 'downed') {
    const away = threat(bot, hooks)
    if (away) {
      const dx = bot.x - away.x
      const dz = bot.z - away.z
      const len = Math.hypot(dx, dz) || 1
      bot.wishX = dx / len
      bot.wishZ = dz / len
      bot.wishSpeed = 2.1
      bot.yaw = Math.atan2(-bot.wishX, -bot.wishZ)
    } else bot.wishSpeed = 0
    return
  }

  const tune = hooks.tune
  const thinking = hooks.now >= bot.thinkAt
  if (thinking) bot.thinkAt = hooks.now + tune.think * (0.75 + hooks.rng() * 0.5)

  const enemies = hooks.actors.filter((a) => a.team !== bot.team && a.state !== 'dead')
  let target: Actor | null = null
  let seen = false
  let best = Infinity
  const focus = new Map<number, number>()
  if (tune.coord) {
    for (const mate of hooks.actors) {
      if (mate.team !== bot.team || mate.state !== 'alive' || mate.targetId < 0) continue
      focus.set(mate.targetId, (focus.get(mate.targetId) ?? 0) + 1)
    }
  }
  for (const enemy of enemies) {
    const visible = hooks.los(bot, enemy)
    const known = enemy.knownUntil > hooks.now || enemy.spottedUntil > hooks.now
    if (!visible && !known) continue
    let score = Math.hypot(enemy.x - bot.x, enemy.z - bot.z)
    if (!visible) score += 12
    score -= (100 - enemy.hp) * 0.08
    if (tune.coord) score -= (focus.get(enemy.id) ?? 0) * 4
    if (enemy.isPlayer) score -= 6 * (1.2 - hooks.allyBias)
    if (score < best) {
      best = score
      target = enemy
      seen = visible
    }
  }

  if (thinking && target && seen && bot.targetId !== target.id) {
    bot.aimReadyAt = hooks.now + tune.react * (0.8 + hooks.rng() * 0.4)
  }
  if (target) bot.targetId = target.id
  else if (thinking) bot.targetId = -1

  if (target && seen && tune.coord) {
    target.knownUntil = Math.max(target.knownUntil, hooks.now + 1.3)
  }

  const hpLow = bot.hp < 42
  if (thinking) {
    if (hpLow && tune.cover && target) {
      bot.retreat = true
      const cover = pickCover(bot, target, hooks)
      if (cover >= 0) bot.waypointI = cover
    } else if (target && tune.flank && hooks.rng() < 0.35 && Math.hypot(target.x - bot.x, target.z - bot.z) > 14) {
      bot.retreat = false
      const flank = pickFlank(bot, target, hooks)
      if (flank >= 0) bot.waypointI = flank
    } else {
      bot.retreat = false
      if (!target || !seen) {
        const roam = pickRoam(bot, target, hooks)
        if (roam >= 0) bot.waypointI = roam
      }
    }
  }

  if (target) aimAt(bot, target, hooks, seen)
  if (target && seen && hooks.now >= bot.aimReadyAt && aligned(bot, target, tune.aim)) {
    const [minR, maxR] = PREFERRED[bot.weaponId]
    const dist = Math.hypot(target.x - bot.x, target.z - bot.z)
    const friendly = teammateInLine(bot, target, hooks)
    if (!friendly && dist < maxR + 8) hooks.fire(bot)
    if (dist > maxR) bot.ads = bot.weaponId === 'sniper'
    else bot.ads = bot.weaponId === 'sniper' && dist > minR
    if (hooks.rng() < tune.ability) useKit(bot, target, hooks, dist)
  } else {
    bot.ads = false
    if (target && hooks.rng() < tune.ability * 0.5) useKit(bot, target, hooks, Math.hypot(target.x - bot.x, target.z - bot.z))
  }

  moveToward(bot, hooks, target, seen)
}

function threat(bot: Actor, hooks: AiHooks): Actor | null {
  let best: Actor | null = null
  let d = Infinity
  for (const a of hooks.actors) {
    if (a.team === bot.team || a.state === 'dead') continue
    const dist = Math.hypot(a.x - bot.x, a.z - bot.z)
    if (dist < d) {
      d = dist
      best = a
    }
  }
  return best
}

function aimAt(bot: Actor, target: Actor, hooks: AiHooks, seen: boolean): void {
  const tune = hooks.tune
  const ex = target.x
  const ez = target.z
  const ey = target.y + (target.state === 'downed' ? 0.5 : EYE)
  let tx = ex - bot.x
  let ty = ey - (bot.y + EYE)
  let tz = ez - bot.z
  const dist = Math.hypot(tx, tz)
  if (tune.lead > 0 && seen) {
    const speed = bot.weaponId === 'sniper' ? 92 : bot.weaponId === 'splash' ? 42 : 54
    const t = dist / speed
    tx += target.vx * t * tune.lead
    tz += target.vz * t * tune.lead
  }
  const wobble = tune.error * Math.sin(hooks.now * 3.1 + bot.id)
  const yaw = Math.atan2(-tx, -tz) + wobble
  const pitch = Math.atan2(ty, Math.hypot(tx, tz)) + wobble * 0.4
  const maxStep = tune.turn * hooks.dt
  bot.yaw += clampStep(angNorm(yaw - bot.yaw), maxStep)
  bot.pitch += clampStep(pitch - bot.pitch, maxStep)
  bot.pitch = Math.max(-1.1, Math.min(1.1, bot.pitch))
}

function clampStep(delta: number, max: number): number {
  return Math.max(-max, Math.min(max, delta))
}

function aligned(bot: Actor, target: Actor, aim: number): boolean {
  const tx = target.x - bot.x
  const tz = target.z - bot.z
  const yaw = Math.atan2(-tx, -tz)
  return Math.abs(angNorm(yaw - bot.yaw)) < aim
}

function teammateInLine(bot: Actor, target: Actor, hooks: AiHooks): boolean {
  const dx = target.x - bot.x
  const dz = target.z - bot.z
  const len = Math.hypot(dx, dz) || 1
  const nx = dx / len
  const nz = dz / len
  for (const mate of hooks.actors) {
    if (mate.team !== bot.team || mate.id === bot.id || mate.state === 'dead') continue
    const mx = mate.x - bot.x
    const mz = mate.z - bot.z
    const along = mx * nx + mz * nz
    if (along < 0.5 || along > len - 0.4) continue
    const px = along * nx
    const pz = along * nz
    if (Math.hypot(mx - px, mz - pz) < 0.7) return true
  }
  return false
}

function moveToward(bot: Actor, hooks: AiHooks, target?: Actor | null, seen?: boolean): void {
  const [minR, maxR] = PREFERRED[bot.weaponId]
  let dx = 0
  let dz = 0
  if (target && seen && !bot.retreat) {
    const dist = Math.hypot(target.x - bot.x, target.z - bot.z) || 1
    const toX = (target.x - bot.x) / dist
    const toZ = (target.z - bot.z) / dist
    if (dist > maxR) {
      dx += toX
      dz += toZ
    } else if (dist < minR) {
      dx -= toX
      dz -= toZ
    }
    if (hooks.now > bot.strafeUntil) {
      bot.strafe = bot.strafe > 0 ? -1 : 1
      bot.strafeUntil = hooks.now + 0.7 + hooks.rng() * 1.1
    }
    const rx = Math.cos(bot.yaw)
    const rz = -Math.sin(bot.yaw)
    dx += rx * bot.strafe * 0.85
    dz += rz * bot.strafe * 0.85
  } else {
    const point = hooks.waypoints[bot.waypointI]
    if (!point) {
      bot.waypointI = Math.floor(hooks.rng() * hooks.waypoints.length)
    } else {
      dx = point.x - bot.x
      dz = point.z - bot.z
      if (Math.hypot(dx, dz) < 1.4) bot.waypointI = -1
    }
  }
  const len = Math.hypot(dx, dz)
  if (len > 0.05) {
    bot.wishX = dx / len
    bot.wishZ = dz / len
    bot.wishSpeed = bot.retreat ? 8.2 : 7.1
  } else bot.wishSpeed = 0

  const moved = Math.hypot(bot.x - bot.lastX, bot.z - bot.lastZ)
  if (moved < 0.08 && bot.wishSpeed > 0) bot.stuck += hooks.dt
  else bot.stuck = 0
  bot.lastX = bot.x
  bot.lastZ = bot.z
  if (bot.stuck > 0.7) {
    bot.wantJump = true
    bot.waypointI = Math.floor(hooks.rng() * hooks.waypoints.length)
    bot.stuck = 0
  }
}

function pickCover(bot: Actor, threatActor: Actor, hooks: AiHooks): number {
  let best = -1
  let score = -Infinity
  hooks.waypoints.forEach((p, i) => {
    if (!p.cover) return
    const fromThreat = Math.hypot(p.x - threatActor.x, p.z - threatActor.z)
    const fromBot = Math.hypot(p.x - bot.x, p.z - bot.z)
    if (fromBot > 28) return
    const s = fromThreat - fromBot * 0.35
    if (s > score) {
      score = s
      best = i
    }
  })
  return best
}

function pickFlank(bot: Actor, target: Actor, hooks: AiHooks): number {
  let best = -1
  let score = -Infinity
  hooks.waypoints.forEach((p, i) => {
    if (!p.flank && !p.cover) return
    const side = Math.abs((p.z - target.z) * (bot.x - target.x) - (p.x - target.x) * (bot.z - target.z))
    const dist = Math.hypot(p.x - target.x, p.z - target.z)
    if (dist < 8 || dist > 36) return
    const s = side * 0.15 - Math.hypot(p.x - bot.x, p.z - bot.z) * 0.2
    if (s > score) {
      score = s
      best = i
    }
  })
  return best
}

function pickRoam(bot: Actor, target: Actor | null, hooks: AiHooks): number {
  if (target && (target.knownUntil > hooks.now || target.spottedUntil > hooks.now)) {
    let best = -1
    let d = Infinity
    hooks.waypoints.forEach((p, i) => {
      const dist = Math.hypot(p.x - target.x, p.z - target.z)
      if (dist < d) {
        d = dist
        best = i
      }
    })
    return best
  }
  if (bot.waypointI >= 0 && bot.waypointI < hooks.waypoints.length) return bot.waypointI
  return Math.floor(hooks.rng() * hooks.waypoints.length)
}

function useKit(bot: Actor, target: Actor, hooks: AiHooks, dist: number): void {
  const def = agentById(bot.agentId)
  if (bot.ult >= 100) {
    if (bot.agentId === 'blitz' && dist < 28) hooks.ultimate(bot)
    else if (bot.agentId === 'guardian' && (bot.hp < 55 || dist < 16)) hooks.ultimate(bot)
    else if (bot.agentId === 'scout') hooks.ultimate(bot)
    else if (bot.agentId === 'splatter' && dist < 30) hooks.ultimate(bot)
    else if (bot.agentId === 'medic') {
      const need = hooks.actors.some((a) => a.team === bot.team && a.id !== bot.id && (a.state === 'downed' || a.hp < 55))
      if (need) hooks.ultimate(bot)
    }
  }
  if (bot.sigCd > 0) return
  if (bot.agentId === 'blitz' && dist > 5 && dist < 16) hooks.signature(bot)
  else if (bot.agentId === 'guardian' && dist < 26 && bot.hp < 80) hooks.signature(bot)
  else if (bot.agentId === 'scout' && target.spottedUntil < hooks.now) hooks.signature(bot)
  else if (bot.agentId === 'splatter' && dist > 6 && dist < 22) hooks.signature(bot)
  else if (bot.agentId === 'medic') {
    const pack = hooks.actors.some((a) => a.team === bot.team && (a.state === 'downed' || (a.hp < 60 && a.state === 'alive')))
    if (pack) hooks.signature(bot)
  }
  void def
}

export function tuneFor(id: keyof typeof DIFFICULTY) {
  return DIFFICULTY[id]
}
