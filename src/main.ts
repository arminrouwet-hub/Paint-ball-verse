import '@fontsource/outfit/400.css'
import '@fontsource/outfit/700.css'
import '@fontsource/outfit/800.css'
import '@fontsource/russo-one/400.css'
import './style.css'

import * as THREE from 'three'
import { AudioBus } from './audio.ts'
import { COSMETICS, calcSr, calcXp, levelFromXp } from './content.ts'
import { MAPS, mapById } from './maps.ts'
import { Match, type MatchOutcome } from './match.ts'
import { MenuScene } from './menuScene.ts'
import { defaultSave, loadSave, sanitize, writeSave, type Save } from './save.ts'
import type { InputState, MatchConfig, MatchResult, UnlockNote } from './types.ts'
import { Ui } from './ui.ts'

const viewEl = document.querySelector<HTMLCanvasElement>('#view')
const rootEl = document.querySelector<HTMLElement>('#ui')
if (!viewEl || !rootEl) throw new Error('Missing game mount')
const view: HTMLCanvasElement = viewEl
const root: HTMLElement = rootEl

const renderer = new THREE.WebGLRenderer({
  canvas: view,
  antialias: true,
  powerPreference: 'high-performance',
})
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75))
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
renderer.toneMapping = THREE.NoToneMapping

const audio = new AudioBus()
let save = loadSave()
audio.setVolume(save.volume)

const input: InputState = {
  keys: new Set(),
  dx: 0,
  dy: 0,
  left: false,
  leftEdge: false,
  right: false,
  midEdge: false,
  reloadEdge: false,
  abilityEdge: false,
  ultEdge: false,
  sprayEdge: false,
  scoreboard: false,
  pauseEdge: false,
}

let menu = new MenuScene()
let match: Match | null = null
let paused = false
let posted = false
let lastConfig: MatchConfig | null = null

function patch(fn: (save: Save) => void): void {
  fn(save)
  save = sanitize(save)
  writeSave(save)
  audio.setVolume(save.volume)
}

function unlocksBetween(beforeXp: number, afterXp: number): MatchResult['unlocks'] {
  const before = levelFromXp(beforeXp).level
  const after = levelFromXp(afterXp).level
  const notes: UnlockNote[] = COSMETICS.filter((item) => item.level > before && item.level <= after).map((item) => ({
    name: item.name,
    kind: item.kind,
  }))
  for (const map of MAPS) {
    if (map.unlockLevel > before && map.unlockLevel <= after) notes.push({ name: map.name, kind: 'arena' })
  }
  return notes
}

function applyResult(config: MatchConfig, outcome: MatchOutcome): MatchResult {
  const xpBefore = save.xp
  const srBefore = save.sr
  const xp = calcXp(outcome.stats, outcome.won)
  const srDelta = config.ranked ? calcSr(outcome.stats, outcome.won) : 0
  save.xp += xp
  if (config.ranked) {
    save.sr = Math.max(0, save.sr + srDelta)
    if (outcome.won) save.wins += 1
    else save.losses += 1
  }
  save.history.unshift({
    won: outcome.won,
    map: mapById(config.mapId).name,
    tags: outcome.stats.tags,
    deaths: outcome.stats.deaths,
    srDelta,
    ranked: config.ranked,
    xp,
  })
  save.history = save.history.slice(0, 8)
  save = sanitize(save)
  writeSave(save)
  return {
    won: outcome.won,
    blue: outcome.blue,
    orange: outcome.orange,
    ranked: config.ranked,
    mapName: mapById(config.mapId).name,
    difficulty: config.difficulty,
    stats: outcome.stats,
    xp,
    xpBefore,
    srBefore,
    srDelta,
    unlocks: unlocksBetween(xpBefore, save.xp),
  }
}

function clearEdges(): void {
  input.dx = 0
  input.dy = 0
  input.leftEdge = false
  input.midEdge = false
  input.reloadEdge = false
  input.abilityEdge = false
  input.ultEdge = false
  input.sprayEdge = false
  input.pauseEdge = false
}

function resize(): void {
  renderer.setSize(window.innerWidth, window.innerHeight)
  menu.resize(window.innerWidth, window.innerHeight)
  match?.resize(window.innerWidth, window.innerHeight)
}

const ui = new Ui(root, {
  save: () => save,
  patch,
  reset: () => {
    save = defaultSave()
    writeSave(save)
    audio.setVolume(save.volume)
  },
  preview: (agent, outfit) => menu.setAgent(agent, outfit),
  start: (config) => begin(config),
  resume: () => {
    if (!match || posted) return
    paused = false
    ui.setPaused(false)
    view.requestPointerLock()
  },
  abandon: () => {
    if (lastConfig?.ranked && match && !posted) {
      save.sr = Math.max(0, save.sr - 20)
      save.losses += 1
      save.history.unshift({
        won: false,
        map: mapById(lastConfig.mapId).name,
        tags: 0,
        deaths: 0,
        srDelta: -20,
        ranked: true,
        xp: 0,
      })
      save.history = save.history.slice(0, 8)
      save = sanitize(save)
      writeSave(save)
    }
    teardown()
  },
  rematch: () => {
    if (!lastConfig) return
    begin({ ...lastConfig, seed: (lastConfig.seed + 97) % 1_000_000_000 })
  },
  leave: () => teardown(),
})

function teardown(): void {
  match?.dispose()
  match = null
  paused = false
  posted = false
  document.exitPointerLock()
  ui.setScreen('menu')
}

function begin(config: MatchConfig): void {
  audio.unlock()
  match?.dispose()
  paused = false
  posted = false
  lastConfig = config
  input.keys.clear()
  clearEdges()
  match = new Match(
    config,
    audio,
    () => ({ sensitivity: save.sensitivity, invertY: save.invertY, bob: save.bob }),
    (outcome) => {
      posted = true
      document.exitPointerLock()
      ui.showPost(applyResult(config, outcome))
    },
  )
  match.resize(window.innerWidth, window.innerHeight)
  ui.showMatch()
  view.requestPointerLock()
}

window.addEventListener('resize', resize)
resize()
menu.setAgent(save.equipped.agent, save.equipped.outfit)

window.addEventListener('keydown', (event) => {
  if (event.repeat) return
  const tag = (event.target as HTMLElement | null)?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA') return
  if (event.code === 'Tab') {
    event.preventDefault()
    input.scoreboard = true
  }
  if (event.code === 'Escape') {
    event.preventDefault()
    input.pauseEdge = true
  }
  const map: Record<string, string> = {
    KeyW: 'w',
    KeyA: 'a',
    KeyS: 's',
    KeyD: 'd',
    ShiftLeft: 'shift',
    ShiftRight: 'shift',
    Space: ' ',
  }
  const key = map[event.code]
  if (key) {
    input.keys.add(key)
    if (event.code === 'Space') event.preventDefault()
  }
  if (event.code === 'KeyR') input.reloadEdge = true
  if (event.code === 'KeyQ') input.abilityEdge = true
  if (event.code === 'KeyX') input.ultEdge = true
  if (event.code === 'KeyT') input.sprayEdge = true
})

window.addEventListener('keyup', (event) => {
  const map: Record<string, string> = {
    KeyW: 'w',
    KeyA: 'a',
    KeyS: 's',
    KeyD: 'd',
    ShiftLeft: 'shift',
    ShiftRight: 'shift',
    Space: ' ',
  }
  const key = map[event.code]
  if (key) input.keys.delete(key)
  if (event.code === 'Tab') input.scoreboard = false
})

window.addEventListener('blur', () => {
  input.keys.clear()
  input.left = false
  input.right = false
  input.scoreboard = false
})

window.addEventListener('mousedown', (event) => {
  if (!match || paused || posted) return
  if (event.button === 0) {
    input.left = true
    input.leftEdge = true
  } else if (event.button === 2) input.right = true
  else if (event.button === 1) {
    input.midEdge = true
    event.preventDefault()
  }
})

window.addEventListener('mouseup', (event) => {
  if (event.button === 0) input.left = false
  if (event.button === 2) input.right = false
})

window.addEventListener('mousemove', (event) => {
  if (document.pointerLockElement !== view) return
  input.dx += event.movementX
  input.dy += event.movementY
})

view.addEventListener('contextmenu', (event) => event.preventDefault())
view.addEventListener('click', () => {
  audio.unlock()
  if (match && !paused && !posted) view.requestPointerLock()
})

let last = performance.now()
function loop(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000)
  last = now
  if (input.pauseEdge && match && !posted) {
    paused = !paused
    ui.setPaused(paused)
    if (paused) document.exitPointerLock()
    else view.requestPointerLock()
  }
  if (match && !paused) {
    match.update(dt, input)
    renderer.render(match.scene, match.camera)
    const canvas = ui.minimap()
    const ctx = canvas.getContext('2d')
    if (ctx) match.drawMinimap(ctx, canvas.width)
    ui.sync(match.frame(window.innerWidth, window.innerHeight), input.scoreboard, document.pointerLockElement === view)
  } else if (match) {
    renderer.render(match.scene, match.camera)
    ui.sync(match.frame(window.innerWidth, window.innerHeight), input.scoreboard, false)
  } else {
    menu.update(dt)
    renderer.render(menu.scene, menu.camera)
  }
  clearEdges()
  requestAnimationFrame(loop)
}
requestAnimationFrame(loop)
