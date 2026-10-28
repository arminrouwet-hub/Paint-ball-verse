import {
  BUNDLES,
  PC_PER_TAGS,
  TIERS,
  VESPER,
  WEAPONS,
  bundleValue,
  cosmetic,
  cosmeticsOf,
  difficultyForSr,
  levelFromXp,
  rankFor,
  weaponById,
  type Bundle,
  type Cosmetic,
  type ItemKind,
} from './content.ts'
import { MAPS, mapById, BASE_MAP_IDS } from './maps.ts'
import { decodeLobby, encodeLobby, oneGunWeapon, type LobbyOpts } from './lobby.ts'
import { lockReason, owns, type Save } from './save.ts'
import type { Difficulty, FrameState, MatchConfig, MatchResult, WeaponId } from './types.ts'
import type { Look } from './characters.ts'
import type { LobbyView } from './menuScene.ts'
import { bundleArt, itemThumb, weaponThumb } from './thumbs.ts'
import { esc, formatTime } from './util.ts'

export type UiHooks = {
  save: () => Save
  patch: (fn: (save: Save) => void) => void
  reset: () => void
  preview: (look: Look) => void
  view: (view: LobbyView | null) => void
  start: (config: MatchConfig) => void
  resume: () => void
  abandon: () => void
  rematch: () => void
  leave: () => void
}

type Tab = LobbyView
type Overlay = null | 'modes' | 'settings' | 'buy'
type Mode = 'quick' | 'ranked' | 'custom'
type Slot = ItemKind | 'marker'

const SLOTS: { id: Slot; label: string }[] = [
  { id: 'outfit', label: 'Outfit' },
  { id: 'marker', label: 'Marker' },
  { id: 'wrap', label: 'Wrap' },
  { id: 'buddy', label: 'Buddy' },
  { id: 'spray', label: 'Spray' },
  { id: 'paint', label: 'Paint' },
]

const KIND_LABEL: Record<ItemKind, string> = {
  outfit: 'Outfit',
  wrap: 'Marker Wrap',
  buddy: 'Gun Buddy',
  spray: 'Spray',
  paint: 'Paint',
}

const CAP_SVG = `<svg class="cap" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#ffe14a" stroke="#120814" stroke-width="2"/><path d="M5 13a7 5 0 0 1 14 0z" fill="#ff7424"/><circle cx="9" cy="9" r="2" fill="#fff" opacity=".8"/></svg>`
const GEAR_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M19.4 13a7.5 7.5 0 0 0 0-2l2.1-1.6-2-3.5-2.5 1a7 7 0 0 0-1.7-1L15 3h-4l-.4 2.9a7 7 0 0 0-1.7 1l-2.5-1-2 3.5L6.6 11a7.5 7.5 0 0 0 0 2l-2.1 1.6 2 3.5 2.5-1a7 7 0 0 0 1.7 1L11 21h4l.4-2.9a7 7 0 0 0 1.7-1l2.5 1 2-3.5zM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z"/></svg>`

export class Ui {
  private screenEl: HTMLElement
  private hud: HTMLElement
  private floaters: HTMLElement
  private click: HTMLElement
  private tab: Tab = 'play'
  private overlay: Overlay = null
  private inMatch = false
  private paused = false
  private confirmQuit = false
  private post: MatchResult | null = null
  private lastHit = -1
  private lastPc = -1
  private scoreLatched = false
  private frames = 0
  private fpsTime = performance.now()
  private fps = 0
  private toast = ''
  private toastTimer = 0
  private draft: {
    mode: Mode
    difficulty: Difficulty
    mapId: string
    teamSize: 3 | 4 | 5
    rounds: 2 | 3
    storm: boolean
    lowgrav: boolean
    onegun: boolean
    seed: number
    codeInput: string
    error: string
    confirmReset: boolean
    slot: Slot
    buy: { type: 'item' | 'bundle'; id: string } | null
  }

  private readonly hooks: UiHooks

  constructor(root: HTMLElement, hooks: UiHooks) {
    this.hooks = hooks
    this.draft = {
      mode: 'quick',
      difficulty: 'rookie',
      mapId: 'warehouse',
      teamSize: 5,
      rounds: 3,
      storm: true,
      lowgrav: false,
      onegun: false,
      seed: Math.floor(Math.random() * 1e9),
      codeInput: '',
      error: '',
      confirmReset: false,
      slot: 'outfit',
      buy: null,
    }
    root.innerHTML = `
      <div id="screen"></div>
      <div id="hud" class="hidden"></div>
      <div id="floaters"></div>
      <button id="clicklock" class="hidden" type="button">CLICK TO PLAY</button>
    `
    this.screenEl = root.querySelector('#screen')!
    this.hud = root.querySelector('#hud')!
    this.floaters = root.querySelector('#floaters')!
    this.click = root.querySelector('#clicklock')!
    this.hud.innerHTML = this.hudHtml()
    for (let i = 0; i < 12; i++) {
      const el = document.createElement('div')
      el.className = 'floater hidden'
      this.floaters.append(el)
    }
    this.screenEl.addEventListener('click', (event) => this.onScreenClick(event))
    this.screenEl.addEventListener('input', (event) => this.onInput(event))
    this.hud.addEventListener('click', (event) => this.onHudClick(event))
    this.click.addEventListener('click', () => this.hooks.resume())
    window.addEventListener('keydown', (event) => {
      if (event.code === 'Escape' && !this.inMatch && this.overlay) {
        this.overlay = null
        this.render()
      }
    })
    this.render()
  }

  showLobby(): void {
    this.inMatch = false
    this.post = null
    this.paused = false
    this.confirmQuit = false
    this.overlay = null
    this.hud.classList.add('hidden')
    this.click.classList.add('hidden')
    this.render()
    this.hooks.preview(this.look())
    this.hooks.view(this.tab)
  }

  showMatch(): void {
    this.inMatch = true
    this.scoreLatched = false
    this.lastPc = -1
    this.screenEl.innerHTML = ''
    this.hud.classList.remove('hidden')
    this.post = null
    this.paused = false
    this.confirmQuit = false
    this.hud.querySelector('#pause')?.classList.add('hidden')
    this.hud.querySelector('#post')?.classList.add('hidden')
  }

  setPaused(paused: boolean): void {
    this.paused = paused
    if (!paused) this.confirmQuit = false
    this.hud.querySelector('#pause')?.classList.toggle('hidden', !paused)
    const ask = this.hud.querySelector('#quit-ask')
    const yes = this.hud.querySelector('#quit-yes')
    ask?.classList.toggle('hidden', this.confirmQuit)
    yes?.classList.toggle('hidden', !this.confirmQuit)
  }

  showPost(result: MatchResult): void {
    this.post = result
    this.paused = false
    this.hud.querySelector('#pause')?.classList.add('hidden')
    const post = this.hud.querySelector('#post')!
    post.classList.remove('hidden')
    const acc = result.stats.shots > 0 ? Math.round((result.stats.hits / result.stats.shots) * 100) : 0
    const level = levelFromXp(result.xpBefore + result.xp)
    const before = levelFromXp(result.xpBefore)
    const rank = rankFor(result.srBefore + result.srDelta)
    const save = this.hooks.save()
    post.innerHTML = `
      <div class="panel">
        <h2 class="${result.won ? 'win' : 'loss'}">${result.won ? 'MATCH WON' : 'MATCH LOST'}</h2>
        <p class="sub">${esc(result.mapName)} · ${esc(result.difficulty)} · ${result.blue}–${result.orange}</p>
        <div class="stats">
          <div><b>${result.stats.tags}</b><span>TAGS</span></div>
          <div><b>${result.stats.deaths}</b><span>OUT</span></div>
          <div><b>${result.stats.assists}</b><span>ASSISTS</span></div>
          <div><b>${result.stats.damage}</b><span>DAMAGE</span></div>
          <div><b>${acc}%</b><span>ACCURACY</span></div>
          <div><b>${result.stats.headshots}</b><span>HEADS</span></div>
          <div class="pc-stat"><b>${CAP_SVG}+${result.pcEarned}</b><span>PAINTBALL CAPS</span></div>
          <div><b>+${result.xp}</b><span>XP</span></div>
        </div>
        <p class="note">You hold <b>${result.pcTotal} PC</b>. ${save.pcBank}/${PC_PER_TAGS} tags toward the next cap.</p>
        <div class="level-pill">Level ${level.level}
          <div class="bar"><i style="width:${Math.round((level.into / level.next) * 100)}%"></i></div>
        </div>
        <p class="note">Was level ${before.level}. ${Math.max(0, level.next - level.into)} XP to the next level.</p>
        ${result.ranked ? `<p class="note">${esc(rank.name)} · ${result.srDelta >= 0 ? '+' : ''}${result.srDelta} SR · now ${result.srBefore + result.srDelta}</p>` : ''}
        ${result.unlocks.length ? `<div class="unlocks">${result.unlocks.map((u) => `<span>${esc(u.name)}</span>`).join('')}</div>` : ''}
        <div class="row-btns">
          <button class="btn orange" type="button" data-act="post:rematch">RUN IT BACK</button>
          <button class="btn ghost" type="button" data-act="post:menu">LOBBY</button>
        </div>
      </div>`
  }

  minimap(): HTMLCanvasElement {
    return this.hud.querySelector('#minimap') as HTMLCanvasElement
  }

  sync(frame: FrameState | null, scoreboard: boolean, locked: boolean): void {
    this.frames += 1
    const now = performance.now()
    if (now - this.fpsTime > 400) {
      this.fps = Math.round((this.frames * 1000) / (now - this.fpsTime))
      this.frames = 0
      this.fpsTime = now
    }
    if (!frame || this.hud.classList.contains('hidden')) return
    const save = this.hooks.save()
    const fps = this.hud.querySelector('#fps')!
    fps.classList.toggle('hidden', !save.showFps)
    fps.textContent = `${this.fps} FPS`
    this.click.classList.toggle('hidden', locked || this.paused || !!this.post || frame.dead)
    const spec = this.hud.querySelector('#spec')!
    spec.classList.toggle('hidden', !frame.spectate)
    spec.textContent = frame.spectate ? `WATCHING ${frame.spectate} · CLICK TO SWAP` : ''
    this.text('#clock', formatTime(frame.phase === 'countdown' ? 0 : frame.timeLeft))
    const storm = this.hud.querySelector('#storm')!
    storm.classList.toggle('hidden', !frame.stormOn)
    storm.classList.toggle('safe', !frame.inStorm && !frame.stormClosing)
    storm.textContent = frame.inStorm ? 'IN THE MIST' : `MIST ${formatTime(frame.stormLeft)}`
    this.pips('blue-pips', frame.blue, frame.need, 'blue')
    this.pips('orange-pips', frame.orange, frame.need, 'orange')
    this.text('#blue-score', String(frame.blueAlive))
    this.text('#orange-score', String(frame.orangeAlive))
    const hp = this.hud.querySelector('#hp-fill') as HTMLElement
    hp.style.width = `${Math.max(0, frame.hp)}%`
    this.text('#hp-num', frame.dead ? 'OUT' : String(frame.hp))
    const buffs = this.hud.querySelector('#buffs')!
    const bits: string[] = []
    if (frame.vest) bits.push('VEST')
    if (frame.haste > 0) bits.push(`GEL ${frame.haste.toFixed(0)}`)
    if (frame.blind > 0) bits.push('BLIND')
    if (frame.protect) bits.push('FRESH')
    const buffKey = bits.join('|')
    if ((buffs as HTMLElement).dataset.key !== buffKey) {
      ;(buffs as HTMLElement).dataset.key = buffKey
      buffs.innerHTML = bits.map((b) => `<span>${b}</span>`).join('')
    }
    this.text('#ammo', String(frame.ammo))
    this.text('#weapon-name', frame.weapon.toUpperCase())
    const reload = this.hud.querySelector('#reload') as HTMLElement
    reload.parentElement?.classList.toggle('hidden', frame.reload < 0)
    reload.style.width = `${Math.max(0, frame.reload) * 100}%`
    this.ability('#sig', frame.sigLabel, 'Q', frame.sigCd, frame.sigMax, frame.sigCd <= 0)
    this.ability('#ult', frame.ultLabel, 'X', frame.ult >= 100 ? 0 : 100 - frame.ult, 100, frame.ult >= 100)
    const pcKey = frame.pc * 10 + frame.pcProgress
    if (pcKey !== this.lastPc) {
      const chip = this.hud.querySelector('#pc-chip') as HTMLElement
      chip.innerHTML = `${CAP_SVG}<b>+${frame.pc}</b><span class="dots">${Array.from({ length: PC_PER_TAGS }, (_, i) => `<i class="${i < frame.pcProgress ? 'on' : ''}"></i>`).join('')}</span>`
      if (this.lastPc >= 0 && Math.floor(pcKey / 10) > Math.floor(this.lastPc / 10)) {
        chip.classList.remove('pop')
        void chip.offsetWidth
        chip.classList.add('pop')
      }
      this.lastPc = pcKey
    }
    const blind = this.hud.querySelector('#blind') as HTMLElement
    blind.style.opacity = String(frame.blind)
    const cross = this.hud.querySelector('#cross')!
    cross.classList.toggle('hidden', !frame.crosshair || frame.scope)
    ;(cross as HTMLElement).style.setProperty('--gap', `${frame.spread * 6}px`)
    if (frame.hitSeq !== this.lastHit) {
      this.lastHit = frame.hitSeq
      cross.classList.add('hit')
      cross.classList.toggle('head', frame.hitHead)
      window.setTimeout(() => cross.classList.remove('hit', 'head'), 120)
    }
    this.hud.querySelector('#scope')?.classList.toggle('hidden', !frame.scope)
    const vig = this.hud.querySelector('#vig') as HTMLElement
    vig.style.opacity = String(Math.min(0.85, frame.low))
    const hurt = this.hud.querySelector('#hurt') as HTMLElement
    hurt.classList.toggle('hidden', frame.hurtAngle === null)
    if (frame.hurtAngle !== null) hurt.style.setProperty('--ang', `${frame.hurtAngle}rad`)
    const banner = this.hud.querySelector('#banner')!
    banner.classList.toggle('hidden', !frame.banner)
    this.text('#banner-title', frame.banner)
    this.text('#banner-sub', frame.sub)
    const hint = this.hud.querySelector('#hint')!
    hint.classList.toggle('hidden', !frame.hint)
    hint.textContent = frame.hint
    const feed = this.hud.querySelector('#feed') as HTMLElement
    const feedKey = frame.feed.map((f) => f.id).join(',')
    if (feed.dataset.key !== feedKey) {
      feed.dataset.key = feedKey
      feed.innerHTML = frame.feed.map((f) => `<div class="${f.tone}">${esc(f.text)}</div>`).join('')
    }
    const showBoard = (scoreboard || this.scoreLatched) && !this.post
    const board = this.hud.querySelector('#board')!
    board.classList.toggle('hidden', !showBoard)
    const scoreBtn = this.hud.querySelector('.score-btn')
    scoreBtn?.classList.toggle('on', showBoard)
    if (showBoard) {
      const blue = frame.rows.filter((r) => r.team === 'blue')
      const orange = frame.rows.filter((r) => r.team === 'orange')
      const row = (r: FrameState['rows'][number]) =>
        `<tr class="${r.you ? 'you' : ''}"><td class="team-${r.team}">${esc(r.name)}${r.state === 'dead' ? ' · out' : ''}</td><td>${esc(r.weapon)}</td><td>${r.tags}</td><td>${r.deaths}</td><td>${r.assists}</td><td>${r.damage}</td></tr>`
      board.innerHTML = `<table><thead><tr><th>PLAYER</th><th>MARKER</th><th>TAGS</th><th>OUT</th><th>AST</th><th>DMG</th></tr></thead><tbody>${[...blue, ...orange].map(row).join('')}</tbody></table>`
    }
    const nodes = [...this.floaters.children] as HTMLElement[]
    nodes.forEach((node, i) => {
      const f = frame.floaters[i]
      if (!f) {
        node.classList.add('hidden')
        return
      }
      node.classList.remove('hidden')
      node.classList.toggle('head', f.head)
      node.classList.toggle('pc', f.text.endsWith('PC'))
      node.style.left = `${f.x}px`
      node.style.top = `${f.y}px`
      node.textContent = f.text
    })
  }

  private look(): Look {
    const save = this.hooks.save()
    return {
      outfit: save.equipped.outfit,
      weapon: save.equipped.weapon,
      wrap: save.equipped.wrap,
      buddy: save.equipped.buddy,
    }
  }

  private render(): void {
    if (this.inMatch) return
    const save = this.hooks.save()
    const body =
      this.tab === 'play' ? this.playTab(save) : this.tab === 'locker' ? this.lockerTab(save) : this.tab === 'shop' ? this.shopTab(save) : this.careerTab(save)
    const overlay =
      this.overlay === 'modes' ? this.modesOverlay(save) : this.overlay === 'settings' ? this.settingsOverlay(save) : this.overlay === 'buy' ? this.buyOverlay(save) : ''
    this.screenEl.innerHTML = `<div class="lobby tab-${this.tab}">
      ${this.topbar(save)}
      <main class="lobby-body">${body}</main>
      ${overlay}
      ${this.toast ? `<div class="toast">${esc(this.toast)}</div>` : ''}
    </div>`
  }

  private topbar(save: Save): string {
    const level = levelFromXp(save.xp)
    const rank = rankFor(save.sr)
    const tab = (id: Tab, label: string) => `<button type="button" class="tab${this.tab === id ? ' on' : ''}" data-act="tab:${id}">${label}</button>`
    return `<header class="topbar">
      <div class="brand"><span class="b1">PAINTBALL</span><span class="b2">VERSE</span></div>
      <nav class="tabs">${tab('play', 'PLAY')}${tab('locker', 'LOCKER')}${tab('shop', 'ITEM SHOP')}${tab('career', 'CAREER')}</nav>
      <div class="wallet">
        <button type="button" class="pc-pill" data-act="tab:shop" title="Paintball Caps. Earn 1 for every ${PC_PER_TAGS} tags.">${CAP_SVG}<b>${save.pc}</b><span>PC</span></button>
        <div class="lvl-badge" title="Level ${level.level}"><b>${level.level}</b><i style="--p:${Math.round((level.into / level.next) * 100)}%"></i></div>
        <div class="rank-chip" style="--rc:${rank.color}">${esc(rank.name)}</div>
        <button type="button" class="icon-btn" data-act="overlay:settings" aria-label="Settings">${GEAR_SVG}</button>
      </div>
    </header>`
  }

  private modeSummary(save: Save): { kicker: string; title: string; sub: string } {
    if (this.draft.mode === 'ranked') {
      const rank = rankFor(save.sr)
      return { kicker: 'RANKED', title: `${rank.name} Ladder`, sub: `${difficultyForSr(save.sr)} bots · 5v5 · random arena` }
    }
    const map = mapById(this.draft.mapId)
    if (this.draft.mode === 'custom') {
      return { kicker: 'CUSTOM LOBBY', title: map.name, sub: `${this.draft.teamSize}v${this.draft.teamSize} · first to ${this.draft.rounds} · ${this.draft.difficulty}` }
    }
    return { kicker: map.mutator !== 'none' ? 'BONUS ARENA' : 'QUICK MATCH', title: map.name, sub: `${this.draft.difficulty} bots · 5v5 · best of 5` }
  }

  private playTab(save: Save): string {
    const level = levelFromXp(save.xp)
    const sum = this.modeSummary(save)
    const locked = this.draft.mode !== 'ranked' && this.mapLocked(save)
    const weapon = weaponById(save.equipped.weapon)
    return `
      <button type="button" class="party-slot left" data-act="party"><span>+</span><small>INVITE WITH CODE</small></button>
      <button type="button" class="party-slot right" data-act="party"><span>+</span><small>INVITE WITH CODE</small></button>
      <div class="nameplate"><b>${esc(save.name)}</b><span>${save.equipped.outfit === 'default' ? esc(VESPER.name) : `${esc(VESPER.name)} · ${esc(cosmetic(save.equipped.outfit).name)}`}</span></div>
      <aside class="kit-card">
        <div class="kicker">YOUR AGENT</div>
        <h3>${esc(VESPER.name)} <small>${esc(VESPER.role)}</small></h3>
        <p><kbd>Q</kbd><b>${esc(VESPER.signature)}</b> ${esc(VESPER.signatureBlurb)}</p>
        <p><kbd>X</kbd><b>${esc(VESPER.ultimate)}</b> ${esc(VESPER.ultimateBlurb)}</p>
        <p class="passive">${esc(VESPER.passive)}</p>
      </aside>
      <aside class="quest-card">
        <div class="kicker">PC BOUNTY</div>
        <b>Tag ${PC_PER_TAGS} painters</b>
        <div class="bar gold"><i style="width:${Math.round((save.pcBank / PC_PER_TAGS) * 100)}%"></i></div>
        <small>${save.pcBank}/${PC_PER_TAGS} · reward ${CAP_SVG} 1 PC · repeats forever</small>
        <div class="kicker" style="margin-top:12px">LEVEL ${level.level}</div>
        <div class="bar"><i style="width:${Math.round((level.into / level.next) * 100)}%"></i></div>
        <small>${level.next - level.into} XP to level ${level.level + 1}</small>
      </aside>
      <div class="play-dock">
        <button type="button" class="mode-card" data-act="overlay:modes">
          <span class="mode-kicker">${sum.kicker}</span>
          <b>${esc(sum.title)}</b>
          <small>${esc(sum.sub)} · ${esc(weapon.name)}</small>
          <span class="change">CHANGE</span>
        </button>
        <button type="button" class="play-btn" data-act="start" ${locked ? 'disabled' : ''}>${locked ? `LEVEL ${mapById(this.draft.mapId).unlockLevel}` : 'PLAY'}</button>
      </div>`
  }

  private modesOverlay(save: Save): string {
    const mode = this.draft.mode
    const rank = rankFor(save.sr)
    const card = (id: Mode, title: string, sub: string) =>
      `<button type="button" class="mode-tile m-${id}${mode === id ? ' on' : ''}" data-act="mode:${id}"><b>${title}</b><small>${sub}</small></button>`
    let detail = ''
    if (mode === 'quick') {
      detail = `
        <div class="section-label">Bots</div>
        <div class="choices">
          ${this.choice('diff:rookie', this.draft.difficulty === 'rookie', 'Rookie', 'They rush and spray wide.')}
          ${this.choice('diff:veteran', this.draft.difficulty === 'veteran', 'Veteran', 'They use cover and Shade Step in.')}
          ${this.choice('diff:champion', this.draft.difficulty === 'champion', 'Champion', 'They flank, focus, and Blackout you.')}
        </div>
        <div class="section-label">Arena</div>
        <div class="map-grid">${MAPS.map((m) => this.mapButton(m.id, save)).join('')}</div>`
    } else if (mode === 'ranked') {
      const next = rank.next ? `${rank.span - rank.into} SR to ${rank.next}` : 'Top of the ladder'
      detail = `
        <div class="rank-pill" style="border-color:${rank.color}"><b style="color:${rank.color}">${esc(rank.name)}</b><span>${save.sr} SR · ${next}</span>
          <div class="bar"><i style="width:${Math.min(100, Math.round((rank.into / rank.span) * 100))}%;background:${rank.color}"></i></div>
        </div>
        <p class="note">5v5, best of five, storm on, random standard arena. Bots play at <b>${difficultyForSr(save.sr)}</b> for your rank. Leaving early counts as a loss.</p>`
    } else {
      const code = encodeLobby(this.lobbyFromDraft())
      const forced = mapById(this.draft.mapId)
      detail = `
        <p class="note">The code carries the arena, bots, and rules. A friend who enters it plays the same custom match on their machine. Bots fill every other slot — there is no live network session.</p>
        <div class="grid-2">
          <div>
            <div class="section-label">Arena</div>
            <div class="map-grid">${MAPS.map((m) => this.mapButton(m.id, save)).join('')}</div>
            <div class="section-label">Bots</div>
            <div class="choices">
              ${this.choice('diff:rookie', this.draft.difficulty === 'rookie', 'Rookie', 'Loose aim')}
              ${this.choice('diff:veteran', this.draft.difficulty === 'veteran', 'Veteran', 'Uses cover')}
              ${this.choice('diff:champion', this.draft.difficulty === 'champion', 'Champion', 'Flanks')}
            </div>
            <div class="section-label">Rules</div>
            <div class="choices">
              ${this.choice('size:3', this.draft.teamSize === 3, '3v3', 'Tight')}
              ${this.choice('size:4', this.draft.teamSize === 4, '4v4', 'Mid')}
              ${this.choice('size:5', this.draft.teamSize === 5, '5v5', 'Full')}
              ${this.choice('rounds:2', this.draft.rounds === 2, 'Best of 3', 'First to 2')}
              ${this.choice('rounds:3', this.draft.rounds === 3, 'Best of 5', 'First to 3')}
            </div>
            <div class="choices" style="margin-top:8px">
              ${this.choice('toggle:storm', this.draft.storm, 'Storm', this.draft.storm ? 'Mist on' : 'Mist off')}
              ${this.choice('toggle:lowgrav', this.draft.lowgrav || forced.mutator === 'lowgrav', 'Low gravity', 'Floaty jumps')}
              ${this.choice('toggle:onegun', this.draft.onegun || forced.mutator === 'onegun', 'One gun', 'Shared marker')}
            </div>
          </div>
          <div class="cta">
            <div class="section-label">Lobby code</div>
            <input class="code" readonly value="${esc(code)}" aria-label="Lobby code" />
            <div class="row-btns">
              <button class="btn slim" type="button" data-act="code:copy">COPY</button>
              <button class="btn slim ghost" type="button" data-act="code:reroll">REROLL</button>
            </div>
            <label class="field">Join a code<input data-field="code" type="text" value="${esc(this.draft.codeInput)}" placeholder="PV-..." /></label>
            <button class="btn slim" type="button" data-act="code:apply">APPLY CODE</button>
            ${this.draft.error ? `<p class="error">${esc(this.draft.error)}</p>` : ''}
            ${forced.mutator !== 'none' ? `<p class="note">${esc(forced.name)} always uses its bonus rule.</p>` : ''}
          </div>
        </div>`
    }
    return `<div class="overlay" data-act="overlay:close-bg">
      <div class="dialog wide" role="dialog" aria-label="Select mode">
        <div class="dialog-head"><h2>SELECT MODE</h2><button type="button" class="icon-btn" data-act="overlay:close" aria-label="Close">✕</button></div>
        <div class="mode-tiles">
          ${card('quick', 'QUICK MATCH', 'You and four bots vs five')}
          ${card('ranked', 'RANKED', `${esc(rank.name)} · ${save.wins}W ${save.losses}L`)}
          ${card('custom', 'CUSTOM LOBBY', 'House rules and a share code')}
        </div>
        ${detail}
        <div class="row-btns end"><button type="button" class="play-btn small" data-act="overlay:close">CONFIRM</button></div>
      </div>
    </div>`
  }

  private lockerTab(save: Save): string {
    const slot = this.draft.slot
    const slotThumb = (s: Slot) => {
      if (s === 'marker') return weaponThumb(save.equipped.weapon, save.equipped.wrap, save.equipped.buddy)
      return itemThumb(save.equipped[s])
    }
    const slotName = (s: Slot) => (s === 'marker' ? weaponById(save.equipped.weapon).name : cosmetic(save.equipped[s]).name)
    const slots = SLOTS.map(
      (s) => `<button type="button" class="slot${slot === s.id ? ' on' : ''}" data-act="slot:${s.id}">
        <img src="${slotThumb(s.id)}" alt="" />
        <span><small>${s.label}</small><b>${esc(slotName(s.id))}</b></span>
      </button>`,
    ).join('')
    let grid = ''
    let detail = ''
    if (slot === 'marker') {
      grid = WEAPONS.map((w) => {
        const on = save.equipped.weapon === w.id
        return `<button type="button" class="tile r-common${on ? ' on' : ''}" data-act="weapon:${w.id}">
          <img src="${weaponThumb(w.id, save.equipped.wrap, save.equipped.buddy)}" alt="" />
          <b>${esc(w.name)}</b><small>${w.mag} in the hopper</small>
        </button>`
      }).join('')
      const w = weaponById(save.equipped.weapon)
      detail = `<b>${esc(w.name)}</b><p>${esc(w.blurb)}</p>`
    } else {
      grid = cosmeticsOf(slot)
        .map((item) => {
          const reason = lockReason(save, item)
          const on = save.equipped[slot] === item.id
          return `<button type="button" class="tile r-${item.rarity ?? 'common'}${on ? ' on' : ''}${reason ? ' locked' : ''}" data-act="equip:${slot}:${item.id}">
            <img src="${itemThumb(item.id)}" alt="" />
            <b>${esc(item.name)}</b><small>${reason ? (item.price !== undefined ? `${CAP_SVG} ${item.price} · Item Shop` : esc(reason)) : on ? 'Equipped' : esc(KIND_LABEL[item.kind])}</small>
          </button>`
        })
        .join('')
      const item = cosmetic(save.equipped[slot])
      detail = `<b>${esc(item.name)}</b><p>${esc(item.blurb)}</p>`
    }
    return `<section class="locker-panel">
      <div class="slots">${slots}</div>
      <div class="locker-grid">
        <div class="kicker">${esc(SLOTS.find((s) => s.id === slot)!.label.toUpperCase())}</div>
        <div class="tiles">${grid}</div>
        <div class="equipped-note">${detail}</div>
      </div>
    </section>
    <p class="drag-hint">Drag the character to spin</p>`
  }

  private shopTab(save: Save): string {
    const bundle = BUNDLES[0]!
    const price = this.bundlePrice(bundle, save)
    const ownedAll = price === 0
    const value = bundleValue(bundle)
    const items = bundle.items.map((id) => cosmetic(id))
    return `<section class="shop">
      <div class="shop-head">
        <div><h2>ITEM SHOP</h2><p class="sub">Spend Paintball Caps. You earn ${CAP_SVG} 1 PC for every ${PC_PER_TAGS} tags in any mode.</p></div>
        <div class="balance">${CAP_SVG}<b>${save.pc}</b><span>PC</span></div>
      </div>
      <div class="shop-grid">
        <button type="button" class="bundle-tile${ownedAll ? ' owned' : ''}" data-act="buy:bundle:${bundle.id}">
          <img src="${bundleArt(bundle)}" alt="Evori Dream Wings bundle: pearl cloak with butterfly wings, pastel markers, and Lumi the star cat" />
          <div class="bundle-info">
            <span class="badge">FEATURED BUNDLE · ${items.length} ITEMS</span>
            <b>${esc(bundle.name)}</b>
            <small>${esc(bundle.tagline)}</small>
            <div class="price">${ownedAll ? '<span class="owned-tag">OWNED</span>' : `${CAP_SVG}<b>${price}</b>${price < value ? `<s>${value}</s>` : ''}`}</div>
          </div>
        </button>
        <div class="shop-items">
          ${items.map((item) => this.shopTile(item, save)).join('')}
        </div>
      </div>
    </section>`
  }

  private shopTile(item: Cosmetic, save: Save): string {
    const have = owns(save, item.id)
    return `<button type="button" class="tile shop-tile r-${item.rarity ?? 'common'}${have ? ' owned' : ''}" data-act="buy:item:${item.id}">
      <img src="${itemThumb(item.id)}" alt="" />
      <span class="kind">${esc(KIND_LABEL[item.kind])}</span>
      <b>${esc(item.name)}</b>
      <span class="price">${have ? 'OWNED' : `${CAP_SVG}${item.price ?? 0}`}</span>
    </button>`
  }

  private bundlePrice(bundle: Bundle, save: Save): number {
    const value = bundleValue(bundle)
    const missing = bundle.items.filter((id) => !owns(save, id)).reduce((sum, id) => sum + (cosmetic(id).price ?? 0), 0)
    if (missing === 0) return 0
    return Math.max(1, Math.round((bundle.price * missing) / value))
  }

  private buyOverlay(save: Save): string {
    const buy = this.draft.buy
    if (!buy) return ''
    let art = ''
    let title = ''
    let sub = ''
    let blurb = ''
    let price = 0
    let owned = false
    let extra = ''
    if (buy.type === 'bundle') {
      const bundle = BUNDLES.find((b) => b.id === buy.id) ?? BUNDLES[0]!
      art = bundleArt(bundle)
      title = bundle.name
      sub = `Bundle · ${bundle.items.length} items`
      blurb = bundle.tagline
      price = this.bundlePrice(bundle, save)
      owned = price === 0
      extra = `<ul class="bundle-list">${bundle.items
        .map((id) => {
          const item = cosmetic(id)
          return `<li><img src="${itemThumb(id)}" alt="" /><span><b>${esc(item.name)}</b><small>${esc(KIND_LABEL[item.kind])}${owns(save, id) ? ' · owned' : ''}</small></span></li>`
        })
        .join('')}</ul>`
    } else {
      const item = cosmetic(buy.id)
      art = itemThumb(item.id)
      title = item.name
      sub = `${KIND_LABEL[item.kind]}${item.bundle ? ' · Evori Dream Wings set' : ''}`
      blurb = item.blurb
      price = item.price ?? 0
      owned = owns(save, item.id)
    }
    const short = Math.max(0, price - save.pc)
    const action = owned
      ? `<button type="button" class="play-btn small" data-act="equip-buy">EQUIP</button>`
      : short > 0
        ? `<button type="button" class="play-btn small" disabled>NEED ${short} MORE PC</button>`
        : `<button type="button" class="play-btn small" data-act="purchase">${CAP_SVG} BUY FOR ${price}</button>`
    return `<div class="overlay" data-act="overlay:close-bg">
      <div class="dialog buy" role="dialog" aria-label="${esc(title)}">
        <div class="buy-art ${buy.type}"><img src="${art}" alt="" /></div>
        <div class="buy-info">
          <div class="dialog-head"><span class="kicker">${esc(sub)}</span><button type="button" class="icon-btn" data-act="overlay:close" aria-label="Close">✕</button></div>
          <h2>${esc(title)}</h2>
          <p class="note">${esc(blurb)}</p>
          ${extra}
          <p class="note">Balance: <b>${save.pc} PC</b>${short > 0 && !owned ? ` · that's about ${short * PC_PER_TAGS} more tags` : ''}</p>
          <div class="row-btns">${action}<button type="button" class="btn ghost slim" data-act="overlay:close">BACK</button></div>
        </div>
      </div>
    </div>`
  }

  private careerTab(save: Save): string {
    const level = levelFromXp(save.xp)
    const rank = rankFor(save.sr)
    const total = save.wins + save.losses
    const history = save.history.length
      ? save.history
          .map(
            (h) =>
              `<div class="hist ${h.won ? 'w' : 'l'}"><span><b>${h.won ? 'WIN' : 'LOSS'}</b> ${esc(h.map)}</span><span>${h.tags} tags · ${h.ranked ? `${h.srDelta >= 0 ? '+' : ''}${h.srDelta} SR` : `+${h.xp} XP`}${h.pc ? ` · +${h.pc} PC` : ''}</span></div>`,
          )
          .join('')
      : '<p class="note">No matches yet. Hit PLAY and your history shows up here.</p>'
    return `<section class="career">
      <h2>CAREER</h2>
      <div class="career-cards">
        <div class="ccard"><span class="kicker">LEVEL</span><b>${level.level}</b><div class="bar"><i style="width:${Math.round((level.into / level.next) * 100)}%"></i></div><small>${level.into}/${level.next} XP</small></div>
        <div class="ccard"><span class="kicker">RANK</span><b style="color:${rank.color}">${esc(rank.name)}</b><div class="bar"><i style="width:${Math.min(100, Math.round((rank.into / rank.span) * 100))}%;background:${rank.color}"></i></div><small>${save.sr} SR${rank.next ? ` · ${rank.span - rank.into} to ${rank.next}` : ''}</small></div>
        <div class="ccard"><span class="kicker">RANKED RECORD</span><b>${save.wins}–${save.losses}</b><small>${total ? Math.round((save.wins / total) * 100) : 0}% win rate</small></div>
        <div class="ccard"><span class="kicker">PAINTBALL CAPS</span><b>${CAP_SVG}${save.pc}</b><small>${save.pcLifetime} earned all time</small></div>
      </div>
      <div class="section-label">Rank ladder</div>
      <div class="ladder">${TIERS.map((t) => `<span class="${t.name === rank.name ? 'on' : ''}" style="--rc:${t.color}">${t.name}<small>${t.min}</small></span>`).join('')}</div>
      <div class="section-label">Recent matches</div>
      <div class="history">${history}</div>
    </section>`
  }

  private settingsOverlay(save: Save): string {
    return `<div class="overlay" data-act="overlay:close-bg">
      <div class="dialog" role="dialog" aria-label="Settings">
        <div class="dialog-head"><h2>SETTINGS</h2><button type="button" class="icon-btn" data-act="overlay:close" aria-label="Close">✕</button></div>
        <label class="field">Painter name<input data-field="name" type="text" maxlength="16" value="${esc(save.name)}" /></label>
        <label class="field">Mouse sensitivity <span id="sens-out">${save.sensitivity.toFixed(2)}</span>
          <input data-field="sens" type="range" min="0.4" max="2.2" step="0.05" value="${save.sensitivity}" />
        </label>
        <label class="field">Volume <span id="vol-out">${Math.round(save.volume * 100)}</span>
          <input data-field="vol" type="range" min="0" max="1" step="0.01" value="${save.volume}" />
        </label>
        <div class="choices">
          ${this.choice('toggle-set:invert', save.invertY, 'Invert Y', save.invertY ? 'On' : 'Off')}
          ${this.choice('toggle-set:bob', save.bob, 'Head bob', save.bob ? 'On' : 'Off')}
          ${this.choice('toggle-set:fps', save.showFps, 'FPS counter', save.showFps ? 'On' : 'Off')}
        </div>
        <p class="note">WASD move · mouse aim · click fire · right click focus · R reload · Q Shade Step · X Blackout · Tab board · T spray · middle mouse ping · Esc pause.</p>
        ${
          this.draft.confirmReset
            ? `<div class="row-btns"><button class="btn pink slim" type="button" data-act="reset:yes">CONFIRM RESET</button><button class="btn ghost slim" type="button" data-act="reset:no">CANCEL</button></div>`
            : `<button class="btn ghost slim" type="button" data-act="reset:ask">RESET PROGRESS</button>`
        }
      </div>
    </div>`
  }

  private choice(act: string, on: boolean, title: string, sub: string): string {
    return `<button type="button" class="choice${on ? ' on' : ''}" data-act="${act}"><b>${esc(title)}</b><small>${esc(sub)}</small></button>`
  }

  private mapButton(id: string, save: Save): string {
    const map = mapById(id)
    const locked = levelFromXp(save.xp).level < map.unlockLevel
    const on = this.draft.mapId === id
    const bonus = map.mutator !== 'none'
    const tag = locked ? `Level ${map.unlockLevel}` : map.mutator === 'lowgrav' ? 'Bonus · Low gravity' : map.mutator === 'onegun' ? 'Bonus · One gun' : map.tagline
    return `<button type="button" class="map-card${on ? ' on' : ''}${locked ? ' locked' : ''}${bonus ? ' bonus' : ''}" data-act="map:${id}"><b>${esc(map.name)}</b><small>${esc(tag)}</small></button>`
  }

  private mapLocked(save: Save): boolean {
    return levelFromXp(save.xp).level < mapById(this.draft.mapId).unlockLevel
  }

  private lobbyFromDraft(): LobbyOpts {
    return {
      mapId: this.draft.mapId,
      difficulty: this.draft.difficulty,
      teamSize: this.draft.teamSize,
      roundsToWin: this.draft.rounds,
      storm: this.draft.storm,
      lowgrav: this.draft.lowgrav,
      onegun: this.draft.onegun,
      seed: this.draft.seed,
    }
  }

  private flash(text: string): void {
    this.toast = text
    window.clearTimeout(this.toastTimer)
    this.toastTimer = window.setTimeout(() => {
      this.toast = ''
      this.screenEl.querySelector('.toast')?.remove()
    }, 2200)
  }

  private onScreenClick(event: Event): void {
    const target = (event.target as HTMLElement).closest<HTMLElement>('[data-act]')
    if (!target) return
    const act = target.dataset.act ?? ''
    if (act === 'overlay:close-bg' && event.target !== target) return
    const save = this.hooks.save()
    if (act.startsWith('tab:')) {
      this.tab = act.slice(4) as Tab
      this.overlay = null
      this.hooks.view(this.tab)
    } else if (act === 'overlay:close' || act === 'overlay:close-bg') {
      this.overlay = null
      this.draft.buy = null
      this.draft.confirmReset = false
    } else if (act === 'overlay:modes') this.overlay = 'modes'
    else if (act === 'overlay:settings') this.overlay = 'settings'
    else if (act === 'party') {
      this.draft.mode = 'custom'
      this.overlay = 'modes'
    } else if (act.startsWith('mode:')) this.draft.mode = act.slice(5) as Mode
    else if (act.startsWith('diff:')) this.draft.difficulty = act.slice(5) as Difficulty
    else if (act.startsWith('slot:')) this.draft.slot = act.slice(5) as Slot
    else if (act.startsWith('weapon:')) {
      const id = act.slice(7) as WeaponId
      this.hooks.patch((next) => {
        next.equipped.weapon = id
      })
      this.hooks.preview(this.look())
    } else if (act.startsWith('map:')) {
      const id = act.slice(4)
      if (levelFromXp(save.xp).level >= mapById(id).unlockLevel) this.draft.mapId = id
      else this.flash(`${mapById(id).name} opens at level ${mapById(id).unlockLevel}`)
    } else if (act.startsWith('size:')) this.draft.teamSize = Number(act.slice(5)) as 3 | 4 | 5
    else if (act.startsWith('rounds:')) this.draft.rounds = Number(act.slice(7)) as 2 | 3
    else if (act === 'toggle:storm') this.draft.storm = !this.draft.storm
    else if (act === 'toggle:lowgrav') this.draft.lowgrav = !this.draft.lowgrav
    else if (act === 'toggle:onegun') this.draft.onegun = !this.draft.onegun
    else if (act.startsWith('equip:')) {
      const [, kind, id] = act.split(':')
      if (!kind || !id) return
      const item = cosmetic(id)
      if (!owns(save, id)) {
        if (item.price !== undefined) {
          this.draft.buy = { type: 'item', id }
          this.overlay = 'buy'
        } else this.flash(`${item.name} unlocks at level ${item.level}`)
      } else {
        this.hooks.patch((next) => {
          if (kind === 'outfit' || kind === 'wrap' || kind === 'buddy' || kind === 'paint' || kind === 'spray') next.equipped[kind] = id
        })
        this.hooks.preview(this.look())
      }
    } else if (act.startsWith('buy:')) {
      const [, type, id] = act.split(':')
      if ((type === 'item' || type === 'bundle') && id) {
        this.draft.buy = { type, id }
        this.overlay = 'buy'
      }
    } else if (act === 'purchase') this.purchase()
    else if (act === 'equip-buy') this.equipPurchase()
    else if (act === 'code:copy') {
      void navigator.clipboard?.writeText(encodeLobby(this.lobbyFromDraft())).then(() => this.flash('Lobby code copied'))
      return
    } else if (act === 'code:reroll') this.draft.seed = Math.floor(Math.random() * 1e9)
    else if (act === 'code:apply') {
      const parsed = decodeLobby(this.draft.codeInput)
      if (!parsed) this.draft.error = "That code doesn't match a Paintball Verse lobby."
      else {
        this.draft.error = ''
        this.draft.mapId = parsed.mapId
        this.draft.difficulty = parsed.difficulty
        this.draft.teamSize = parsed.teamSize
        this.draft.rounds = parsed.roundsToWin
        this.draft.storm = parsed.storm
        this.draft.lowgrav = parsed.lowgrav
        this.draft.onegun = parsed.onegun
        this.draft.seed = parsed.seed
        this.flash('Lobby code applied')
      }
    } else if (act === 'reset:ask') this.draft.confirmReset = true
    else if (act === 'reset:no') this.draft.confirmReset = false
    else if (act === 'reset:yes') {
      this.draft.confirmReset = false
      this.hooks.reset()
      this.hooks.preview(this.look())
    } else if (act === 'start') {
      this.launch(save)
      return
    } else if (act.startsWith('toggle-set:')) {
      const key = act.slice(11)
      this.hooks.patch((next) => {
        if (key === 'invert') next.invertY = !next.invertY
        if (key === 'bob') next.bob = !next.bob
        if (key === 'fps') next.showFps = !next.showFps
      })
    }
    this.render()
  }

  private purchase(): void {
    const buy = this.draft.buy
    if (!buy) return
    const save = this.hooks.save()
    let price = 0
    let ids: string[] = []
    if (buy.type === 'bundle') {
      const bundle = BUNDLES.find((b) => b.id === buy.id)
      if (!bundle) return
      price = this.bundlePrice(bundle, save)
      ids = bundle.items.filter((id) => !owns(save, id))
    } else {
      const item = cosmetic(buy.id)
      if (item.price === undefined || owns(save, item.id)) return
      price = item.price
      ids = [item.id]
    }
    if (!ids.length || save.pc < price) return
    this.hooks.patch((next) => {
      next.pc -= price
      next.owned = [...next.owned, ...ids]
    })
    this.flash(buy.type === 'bundle' ? 'Evori Dream Wings unlocked' : `${cosmetic(buy.id).name} unlocked`)
  }

  private equipPurchase(): void {
    const buy = this.draft.buy
    if (!buy) return
    const ids = buy.type === 'bundle' ? (BUNDLES.find((b) => b.id === buy.id)?.items ?? []) : [buy.id]
    const save = this.hooks.save()
    this.hooks.patch((next) => {
      for (const id of ids) {
        if (!owns(save, id)) continue
        const kind = cosmetic(id).kind
        next.equipped[kind] = id
      }
    })
    this.hooks.preview(this.look())
    this.overlay = null
    this.draft.buy = null
    this.flash('Equipped')
  }

  private onInput(event: Event): void {
    const el = event.target as HTMLInputElement
    const field = el.dataset.field
    if (!field) return
    if (field === 'code') {
      this.draft.codeInput = el.value
      return
    }
    if (field === 'name') {
      this.hooks.patch((save) => {
        save.name = el.value
      })
      return
    }
    if (field === 'sens') {
      this.hooks.patch((save) => {
        save.sensitivity = Number(el.value)
      })
      const out = this.screenEl.querySelector('#sens-out')
      if (out) out.textContent = Number(el.value).toFixed(2)
    }
    if (field === 'vol') {
      this.hooks.patch((save) => {
        save.volume = Number(el.value)
      })
      const out = this.screenEl.querySelector('#vol-out')
      if (out) out.textContent = String(Math.round(Number(el.value) * 100))
    }
  }

  private onHudClick(event: Event): void {
    const target = (event.target as HTMLElement).closest<HTMLElement>('[data-act]')
    if (!target) return
    const act = target.dataset.act
    if (act === 'score') this.scoreLatched = !this.scoreLatched
    else if (act === 'pause:resume') this.hooks.resume()
    else if (act === 'pause:quit') this.confirmQuit = true
    else if (act === 'pause:no') this.confirmQuit = false
    else if (act === 'pause:yes') this.hooks.abandon()
    else if (act === 'post:rematch') this.hooks.rematch()
    else if (act === 'post:menu') this.hooks.leave()
    if (act?.startsWith('pause:')) this.setPaused(this.paused)
  }

  private launch(save: Save): void {
    const kind = this.draft.mode
    if (kind !== 'ranked' && this.mapLocked(save)) return
    const map = kind === 'ranked' ? mapById(BASE_MAP_IDS[Math.floor(Math.random() * BASE_MAP_IDS.length)]!) : mapById(this.draft.mapId)
    const onegun = kind === 'custom' ? this.draft.onegun || map.mutator === 'onegun' : map.mutator === 'onegun'
    const lowgrav = kind === 'custom' ? this.draft.lowgrav || map.mutator === 'lowgrav' : map.mutator === 'lowgrav'
    const seed = kind === 'custom' ? this.draft.seed : Math.floor(Math.random() * 1e9)
    const config: MatchConfig = {
      mapId: map.id,
      difficulty: kind === 'ranked' ? difficultyForSr(save.sr) : this.draft.difficulty,
      teamSize: kind === 'custom' ? this.draft.teamSize : 5,
      roundsToWin: kind === 'custom' ? this.draft.rounds : 3,
      storm: kind === 'custom' ? this.draft.storm : true,
      lowgrav,
      onegun,
      weaponId: onegun ? oneGunWeapon(seed) : save.equipped.weapon,
      agentId: VESPER.id,
      outfitId: save.equipped.outfit,
      wrapId: save.equipped.wrap,
      paintId: save.equipped.paint,
      sprayId: save.equipped.spray,
      buddyId: save.equipped.buddy,
      pcBank: save.pcBank,
      ranked: kind === 'ranked',
      seed,
      playerName: save.name || 'Painter',
    }
    this.hooks.start(config)
  }

  private hudHtml(): string {
    return `
      <div id="fps" class="fps hidden"></div>
      <div class="blind" id="blind"></div>
      <div class="top">
        <div class="scoreline">
          <span class="pips" id="blue-pips"></span>
          <span class="blue" id="blue-score">5</span>
          <span class="clock" id="clock">2:30</span>
          <span class="orange" id="orange-score">5</span>
          <span class="pips" id="orange-pips"></span>
        </div>
        <div class="storm safe" id="storm">MIST 0:30</div>
      </div>
      <div class="feed" id="feed"></div>
      <div class="minimap-wrap">
        <button class="score-btn" type="button" data-act="score">TAB</button>
        <canvas id="minimap" width="168" height="168"></canvas>
        <div class="pc-chip" id="pc-chip" title="Paintball Caps earned this match"></div>
      </div>
      <div class="banner hidden" id="banner"><b id="banner-title"></b><span id="banner-sub"></span></div>
      <div class="crosshair" id="cross" style="--gap:6px"><i></i><i></i><i></i><i></i></div>
      <div class="scope hidden" id="scope"></div>
      <div class="vignette" id="vig"></div>
      <div class="hurt hidden" id="hurt"></div>
      <div class="cluster">
        <div class="buffs" id="buffs"></div>
        <div class="hp"><i id="hp-fill"></i></div>
        <div class="hp-num" id="hp-num">100</div>
      </div>
      <div class="right-hud">
        <div class="abilities">
          <div class="ability" id="sig"><span class="key">Q</span><span class="name">STEP</span><i class="mask"></i></div>
          <div class="ability ult" id="ult"><span class="key">X</span><span class="name">BLACKOUT</span><i class="mask"></i></div>
        </div>
        <div class="ammo"><b id="ammo">15</b><small id="weapon-name">RAPID MARKER</small><div class="reload hidden"><i id="reload"></i></div></div>
      </div>
      <div class="hint hidden" id="hint"></div>
      <div class="spec hidden" id="spec"></div>
      <div class="board hidden" id="board"></div>
      <div class="pause hidden" id="pause">
        <div class="panel">
          <h2>PAUSED</h2>
          <p class="note">The round holds. Mist included.</p>
          <button class="btn orange" type="button" data-act="pause:resume">RESUME</button>
          <button class="btn" type="button" id="quit-ask" data-act="pause:quit">LEAVE MATCH</button>
          <div id="quit-yes" class="hidden">
            <p class="note">Leaving a ranked match counts as a loss.</p>
            <button class="btn pink" type="button" data-act="pause:yes">CONFIRM LEAVE</button>
            <button class="btn ghost" type="button" data-act="pause:no">STAY</button>
          </div>
        </div>
      </div>
      <div class="post hidden" id="post"></div>
    `
  }

  private text(sel: string, value: string): void {
    const el = this.hud.querySelector(sel)
    if (el && el.textContent !== value) el.textContent = value
  }

  private pips(id: string, score: number, need: number, team: string): void {
    const el = this.hud.querySelector(`#${id}`) as HTMLElement | null
    if (!el) return
    const key = `${score}/${need}`
    if (el.dataset.key === key) return
    el.dataset.key = key
    el.innerHTML = Array.from({ length: need }, (_, i) => `<i class="pip${i < score ? ` on ${team}` : ''}"></i>`).join('')
  }

  private ability(sel: string, label: string, key: string, remaining: number, max: number, ready: boolean): void {
    const el = this.hud.querySelector(sel) as HTMLElement | null
    if (!el) return
    el.classList.toggle('ready', ready)
    const name = el.querySelector('.name')
    if (name && name.textContent !== label) name.textContent = label
    const mask = el.querySelector('.mask') as HTMLElement | null
    if (mask) mask.style.height = ready ? '0%' : `${Math.min(100, (remaining / Math.max(0.01, max)) * 100)}%`
    const keyEl = el.querySelector('.key')
    if (keyEl) keyEl.textContent = ready ? key : remaining >= 10 && max > 20 ? `${Math.ceil(remaining)}` : remaining.toFixed(remaining < 10 && max < 30 ? 1 : 0)
  }
}
