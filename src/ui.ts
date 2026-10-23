import {
  AGENTS,
  WEAPONS,
  agentById,
  cosmeticsOf,
  difficultyForSr,
  levelFromXp,
  rankFor,
  xpToNext,
} from './content.ts'
import { MAPS, mapById, BASE_MAP_IDS } from './maps.ts'
import { decodeLobby, encodeLobby, oneGunWeapon, type LobbyOpts } from './lobby.ts'
import { owns, type Save } from './save.ts'
import type { AgentId, Difficulty, FrameState, MatchConfig, MatchResult, WeaponId } from './types.ts'
import { esc, formatTime } from './util.ts'

export type UiHooks = {
  save: () => Save
  patch: (fn: (save: Save) => void) => void
  reset: () => void
  preview: (agent: AgentId, outfit: string) => void
  start: (config: MatchConfig) => void
  resume: () => void
  abandon: () => void
  rematch: () => void
  leave: () => void
}

type Screen = 'menu' | 'play' | 'custom' | 'ranked' | 'agents' | 'settings'

export class Ui {
  private screenEl: HTMLElement
  private hud: HTMLElement
  private floaters: HTMLElement
  private click: HTMLElement
  private screen: Screen = 'menu'
  private paused = false
  private confirmQuit = false
  private post: MatchResult | null = null
  private lastHit = -1
  private scoreLatched = false
  private frames = 0
  private fpsTime = performance.now()
  private fps = 0
  private draft: {
    difficulty: Difficulty
    agent: AgentId
    weapon: WeaponId
    mapId: string
    teamSize: 3 | 4 | 5
    rounds: 2 | 3
    storm: boolean
    lowgrav: boolean
    onegun: boolean
    seed: number
    codeInput: string
    error: string
    tab: 'roster' | 'locker'
    confirmReset: boolean
  }

  private readonly hooks: UiHooks

  constructor(root: HTMLElement, hooks: UiHooks) {
    this.hooks = hooks
    const save = hooks.save()
    this.draft = {
      difficulty: 'rookie',
      agent: save.equipped.agent,
      weapon: save.equipped.weapon,
      mapId: 'warehouse',
      teamSize: 5,
      rounds: 3,
      storm: true,
      lowgrav: false,
      onegun: false,
      seed: Math.floor(Math.random() * 1e9),
      codeInput: '',
      error: '',
      tab: 'roster',
      confirmReset: false,
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
    this.render()
  }

  setScreen(screen: Screen): void {
    this.screen = screen
    this.post = null
    this.paused = false
    this.confirmQuit = false
    this.hud.classList.add('hidden')
    this.click.classList.add('hidden')
    this.render()
    const save = this.hooks.save()
    this.hooks.preview(this.draft.agent, save.equipped.outfit)
  }

  showMatch(): void {
    this.scoreLatched = false
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
          <div><b>${result.stats.revives}</b><span>REVIVES</span></div>
          <div><b>+${result.xp}</b><span>XP</span></div>
        </div>
        <div class="level-pill">Level ${level.level}
          <div class="bar"><i style="width:${Math.round((level.into / level.next) * 100)}%"></i></div>
        </div>
        <p class="note">Was level ${before.level}. Next unlock in ${Math.max(0, level.next - level.into)} XP.</p>
        ${result.ranked ? `<p class="note">${esc(rank.name)} · ${result.srDelta >= 0 ? '+' : ''}${result.srDelta} SR · now ${result.srBefore + result.srDelta}</p>` : ''}
        ${result.unlocks.length ? `<div class="unlocks">${result.unlocks.map((u) => `<span>${esc(u.name)}</span>`).join('')}</div>` : ''}
        <div class="nav" style="flex-direction:row;margin-top:12px">
          <button class="btn orange" type="button" data-act="post:rematch">RUN IT BACK</button>
          <button class="btn ghost" type="button" data-act="post:menu">MENU</button>
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
    if (frame.dead && !this.post && !this.paused) this.click.classList.add('hidden')
    const spec = this.hud.querySelector('#spec')!
    spec.classList.toggle('hidden', !frame.spectate)
    spec.textContent = frame.spectate ? `WATCHING ${frame.spectate} · CLICK TO SWAP` : ''
    this.text('#clock', formatTime(frame.phase === 'countdown' ? 0 : frame.timeLeft))
    const storm = this.hud.querySelector('#storm')!
    storm.classList.toggle('hidden', !frame.stormOn)
    storm.classList.toggle('safe', !frame.inStorm && !frame.stormClosing)
    storm.textContent = frame.inStorm ? 'IN THE MIST' : frame.stormClosing ? `MIST ${formatTime(frame.stormLeft)}` : `MIST ${formatTime(frame.stormLeft)}`
    this.pips('blue-pips', frame.blue, frame.need, 'blue')
    this.pips('orange-pips', frame.orange, frame.need, 'orange')
    this.text('#blue-score', String(frame.blueAlive))
    this.text('#orange-score', String(frame.orangeAlive))
    const hp = this.hud.querySelector('#hp-fill') as HTMLElement
    hp.style.width = `${Math.max(0, frame.hp)}%`
    this.text('#hp-num', frame.downed ? 'DOWN' : frame.dead ? 'OUT' : String(frame.hp))
    const buffs = this.hud.querySelector('#buffs')!
    const bits: string[] = []
    if (frame.vest) bits.push('VEST')
    if (frame.haste > 0) bits.push(`GEL ${frame.haste.toFixed(0)}`)
    if (frame.resist) bits.push('FORTIFY')
    if (frame.fireRate) bits.push('HOT')
    if (frame.protect) bits.push('FRESH')
    buffs.innerHTML = bits.map((b) => `<span>${b}</span>`).join('')
    this.text('#ammo', String(frame.ammo))
    this.text('#weapon-name', frame.weapon.toUpperCase())
    const reload = this.hud.querySelector('#reload') as HTMLElement
    reload.parentElement?.classList.toggle('hidden', frame.reload < 0)
    reload.style.width = `${Math.max(0, frame.reload) * 100}%`
    this.ability('#sig', frame.sigLabel, 'Q', frame.sigCd, frame.sigMax, frame.sigCd <= 0)
    this.ability('#ult', frame.ultLabel, 'X', frame.ult >= 100 ? 0 : 100 - frame.ult, 100, frame.ult >= 100)
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
        `<tr class="${r.you ? 'you' : ''}"><td class="team-${r.team}">${esc(r.name)}${r.state === 'downed' ? ' · down' : r.state === 'dead' ? ' · out' : ''}</td><td>${esc(r.agent)}</td><td>${esc(r.weapon)}</td><td>${r.tags}</td><td>${r.deaths}</td><td>${r.assists}</td><td>${r.damage}</td></tr>`
      board.innerHTML = `<table><thead><tr><th>PLAYER</th><th>AGENT</th><th>MARKER</th><th>TAGS</th><th>OUT</th><th>AST</th><th>DMG</th></tr></thead><tbody>${[...blue, ...orange].map(row).join('')}</tbody></table>`
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
      node.style.left = `${f.x}px`
      node.style.top = `${f.y}px`
      node.textContent = f.text
    })
  }

  private render(): void {
    const save = this.hooks.save()
    if (this.screen === 'menu') this.screenEl.innerHTML = this.menu(save)
    else if (this.screen === 'play') this.screenEl.innerHTML = this.play(save)
    else if (this.screen === 'custom') this.screenEl.innerHTML = this.custom(save)
    else if (this.screen === 'ranked') this.screenEl.innerHTML = this.ranked(save)
    else if (this.screen === 'agents') this.screenEl.innerHTML = this.agents(save)
    else this.screenEl.innerHTML = this.settings(save)
  }

  private menu(save: Save): string {
    const level = levelFromXp(save.xp)
    const rank = rankFor(save.sr)
    return `<div class="menu-wrap">
      <div>
        <p class="kicker">First-person arcade</p>
        <h1><span>PAINTBALL</span><span>VERSE</span></h1>
        <p class="deck">Five agents. Three markers. A closing mist. Wipe the other squad to take the round — best of five paints the match.</p>
      </div>
      <nav class="nav">
        <button class="btn blue" type="button" data-act="nav:play">QUICK MATCH<small>Drop in against bots</small></button>
        <button class="btn orange" type="button" data-act="nav:custom">CUSTOM LOBBY<small>House rules and a share code</small></button>
        <button class="btn pink" type="button" data-act="nav:ranked">RANKED LADDER<small>${esc(rank.name)} · ${save.wins}W ${save.losses}L</small></button>
        <button class="btn" type="button" data-act="nav:agents">AGENTS<small>Kits, wraps, sprays, paint</small></button>
        <button class="btn ghost" type="button" data-act="nav:settings">SETTINGS</button>
      </nav>
      <div class="status">
        <div class="level-pill"><b>Level ${level.level}</b><div class="bar"><i style="width:${Math.round((level.into / level.next) * 100)}%"></i></div></div>
        <div class="rank-pill" style="border-color:${rank.color}"><b style="color:${rank.color}">${esc(rank.name)}</b><span>${save.sr} SR</span></div>
      </div>
    </div>`
  }

  private play(save: Save): string {
    return `<div class="sheet">
      ${this.back()}
      <h2>QUICK MATCH</h2>
      <p class="sub">You plus four bots against five. First to 3 round wins. The mist closes every 30 seconds.</p>
      <div class="grid-2">
        <div>
          <div class="section-label">Agent</div>
          <div class="agent-grid">${AGENTS.map((a) => this.agentButton(a.id, a.id === this.draft.agent)).join('')}</div>
          <div class="section-label">Marker</div>
          <div class="weapon-row">${WEAPONS.map((w) => this.choice(`weapon:${w.id}`, w.id === this.draft.weapon, w.name, w.blurb)).join('')}</div>
        </div>
        <div class="cta">
          <div class="section-label">Bots</div>
          ${this.choice('diff:rookie', this.draft.difficulty === 'rookie', 'Rookie', 'They rush and spray wide.')}
          ${this.choice('diff:veteran', this.draft.difficulty === 'veteran', 'Veteran', 'They use cover and back off when tagged.')}
          ${this.choice('diff:champion', this.draft.difficulty === 'champion', 'Champion', 'They flank, focus, and trade kit.')}
          <div class="section-label">Map</div>
          <div class="map-grid">${MAPS.map((m) => this.mapButton(m.id, save)).join('')}</div>
          <button class="btn orange" type="button" data-act="start:quick" ${this.mapLocked(save) ? 'disabled' : ''}>DROP IN</button>
          <p class="note">WASD move, mouse aim, click to fire, right click to focus, R reload, Q signature, X ultimate, Tab board, T spray, middle mouse ping, Esc pause.</p>
        </div>
      </div>
    </div>`
  }

  private custom(save: Save): string {
    const lobby = this.lobbyFromDraft()
    const code = encodeLobby(lobby)
    const forced = mapById(this.draft.mapId)
    return `<div class="sheet">
      ${this.back()}
      <h2>CUSTOM LOBBY</h2>
      <p class="sub">The code carries the map, bots, and rules. A friend who enters it plays that same custom match on their machine. Bots fill every other slot — there is no live network session.</p>
      <div class="grid-2">
        <div>
          <div class="section-label">Map</div>
          <div class="map-grid">${MAPS.map((m) => this.mapButton(m.id, save)).join('')}</div>
          <div class="section-label">Bots</div>
          <div class="choices">
            ${this.choice('diff:rookie', this.draft.difficulty === 'rookie', 'Rookie', 'Loose aim')}
            ${this.choice('diff:veteran', this.draft.difficulty === 'veteran', 'Veteran', 'Uses cover')}
            ${this.choice('diff:champion', this.draft.difficulty === 'champion', 'Champion', 'Flanks')}
          </div>
          <div class="section-label">Roster</div>
          <div class="choices">
            ${this.choice('size:3', this.draft.teamSize === 3, '3v3', 'Short roster')}
            ${this.choice('size:4', this.draft.teamSize === 4, '4v4', 'Missing one kit')}
            ${this.choice('size:5', this.draft.teamSize === 5, '5v5', 'Full agent set')}
          </div>
          <div class="choices">
            ${this.choice('rounds:2', this.draft.rounds === 2, 'First to 2', 'Best of 3')}
            ${this.choice('rounds:3', this.draft.rounds === 3, 'First to 3', 'Best of 5')}
          </div>
          <div class="checks">
            ${this.choice('toggle:storm', this.draft.storm, 'Storm', this.draft.storm ? 'Mist on' : 'Mist off')}
            ${this.choice('toggle:lowgrav', this.draft.lowgrav || forced.mutator === 'lowgrav', 'Low gravity', 'Floaty jumps')}
            ${this.choice('toggle:onegun', this.draft.onegun || forced.mutator === 'onegun', 'One gun', 'Shared marker')}
          </div>
          <div class="section-label">Your kit</div>
          <div class="choices">${AGENTS.map((a) => this.choice(`agent:${a.id}`, a.id === this.draft.agent, a.name, a.role)).join('')}</div>
          <div class="choices">${WEAPONS.map((w) => this.choice(`weapon:${w.id}`, w.id === this.draft.weapon, w.name, `${w.mag} in the hopper`)).join('')}</div>
        </div>
        <div class="cta">
          <div class="section-label">Lobby code</div>
          <input class="code" readonly value="${esc(code)}" />
          <button class="btn slim" type="button" data-act="code:copy">COPY CODE</button>
          <button class="btn slim ghost" type="button" data-act="code:reroll">REROLL SEED</button>
          <label class="field">Join a code<input id="code-input" data-field="code" type="text" value="${esc(this.draft.codeInput)}" placeholder="PV-..." /></label>
          <button class="btn slim" type="button" data-act="code:apply">APPLY CODE</button>
          ${this.draft.error ? `<p class="error">${esc(this.draft.error)}</p>` : ''}
          <button class="btn orange" type="button" data-act="start:custom" ${this.mapLocked(save) ? 'disabled' : ''}>START LOBBY</button>
          ${forced.mutator !== 'none' ? `<p class="note">${esc(forced.name)} always uses its bonus rule.</p>` : ''}
        </div>
      </div>
    </div>`
  }

  private ranked(save: Save): string {
    const rank = rankFor(save.sr)
    const diff = difficultyForSr(save.sr)
    const next = rank.next ? `${rank.span - rank.into} SR to ${rank.next}` : 'Top of the ladder'
    const history = save.history.length
      ? save.history
          .map(
            (h) =>
              `<div><span>${h.won ? 'Win' : 'Loss'} · ${esc(h.map)}</span><span>${h.ranked ? `${h.srDelta >= 0 ? '+' : ''}${h.srDelta} SR` : `+${h.xp} XP`} · ${h.tags} tags</span></div>`,
          )
          .join('')
      : '<p class="note">No matches yet. Your first ranked drop starts at Bronze.</p>'
    return `<div class="sheet">
      ${this.back()}
      <h2>RANKED</h2>
      <p class="sub">5v5, best of five, storm on, random standard map. Bot tier follows your rank.</p>
      <div class="rank-pill" style="border-color:${rank.color}"><b style="color:${rank.color}">${esc(rank.name)}</b><span>${save.sr} SR · ${next}</span>
        <div class="bar"><i style="width:${Math.min(100, Math.round((rank.into / rank.span) * 100))}%;background:${rank.color}"></i></div>
      </div>
      <p class="note" style="margin-top:10px">${save.wins} wins · ${save.losses} losses · this lobby plays at <b>${diff}</b>.</p>
      <button class="btn pink" type="button" data-act="start:ranked" style="margin-top:12px">QUEUE RANKED</button>
      <div class="section-label">Recent</div>
      <div class="history">${history}</div>
    </div>`
  }

  private agents(save: Save): string {
    const agent = agentById(this.draft.agent)
    const tab = this.draft.tab
    return `<div class="sheet">
      ${this.back()}
      <h2>AGENTS</h2>
      <div class="choices">
        ${this.choice('tab:roster', tab === 'roster', 'Roster', 'Kits and ultimates')}
        ${this.choice('tab:locker', tab === 'locker', 'Locker', 'Paint, wraps, sprays')}
      </div>
      ${
        tab === 'roster'
          ? `<div class="agent-grid">${AGENTS.map((a) => this.agentButton(a.id, a.id === this.draft.agent)).join('')}</div>
             <div class="note" style="margin-top:12px"><b>${esc(agent.name)}</b> — ${esc(agent.blurb)}<br>Passive: ${esc(agent.passive)}<br>Q ${esc(agent.signature)}: ${esc(agent.signatureBlurb)}<br>X ${esc(agent.ultimate)}: ${esc(agent.ultimateBlurb)}</div>`
          : this.locker(save)
      }
    </div>`
  }

  private locker(save: Save): string {
    const block = (kind: 'paint' | 'wrap' | 'spray' | 'outfit', title: string) => {
      const equipped = save.equipped[kind]
      return `<div class="section-label">${title}</div><div class="locker">${cosmeticsOf(kind)
        .map((item) => {
          const locked = !owns(save.xp, item.id)
          const on = equipped === item.id
          return `<button type="button" class="swatch${on ? ' on' : ''}${locked ? ' locked' : ''}" data-act="equip:${kind}:${item.id}"><b>${esc(item.name)}</b><small>${locked ? `Level ${item.level}` : esc(item.blurb)}</small></button>`
        })
        .join('')}</div>`
    }
    const level = levelFromXp(save.xp)
    return `${block('outfit', 'Outfits')}${block('wrap', 'Wraps')}${block('paint', 'Paint')}${block('spray', 'Sprays')}
      <p class="note">Level ${level.level}. ${xpToNext(level.level) - level.into} XP to the next unlock. Zero-G Yard opens at 3, Hopper Pit at 5.</p>`
  }

  private settings(save: Save): string {
    return `<div class="sheet">
      ${this.back()}
      <h2>SETTINGS</h2>
      <label class="field">Painter name<input data-field="name" type="text" maxlength="16" value="${esc(save.name)}" /></label>
      <label class="field">Mouse sensitivity <span id="sens-out">${save.sensitivity.toFixed(2)}</span>
        <input data-field="sens" type="range" min="0.4" max="2.2" step="0.05" value="${save.sensitivity}" />
      </label>
      <label class="field">Volume <span id="vol-out">${Math.round(save.volume * 100)}</span>
        <input data-field="vol" type="range" min="0" max="1" step="0.01" value="${save.volume}" />
      </label>
      <div class="checks">
        ${this.choice('toggle-set:invert', save.invertY, 'Invert Y', save.invertY ? 'On' : 'Off')}
        ${this.choice('toggle-set:bob', save.bob, 'Head bob', save.bob ? 'On' : 'Off')}
        ${this.choice('toggle-set:fps', save.showFps, 'FPS counter', save.showFps ? 'On' : 'Off')}
      </div>
      ${
        this.draft.confirmReset
          ? `<div class="nav" style="flex-direction:row"><button class="btn pink" type="button" data-act="reset:yes">CONFIRM RESET</button><button class="btn ghost" type="button" data-act="reset:no">CANCEL</button></div>`
          : `<button class="btn ghost" type="button" data-act="reset:ask">RESET PROGRESS</button>`
      }
    </div>`
  }

  private back(): string {
    return `<button class="btn slim ghost back" type="button" data-act="nav:menu">BACK</button>`
  }

  private choice(act: string, on: boolean, title: string, sub: string): string {
    return `<button type="button" class="choice${on ? ' on' : ''}" data-act="${act}"><b>${esc(title)}</b><small>${esc(sub)}</small></button>`
  }

  private agentButton(id: AgentId, on: boolean): string {
    const agent = agentById(id)
    return `<button type="button" class="agent-card${on ? ' on' : ''}" data-act="agent:${id}"><span class="role">${esc(agent.role)}</span><b>${esc(agent.name)}</b><small>Q ${esc(agent.signature)} · X ${esc(agent.ultimate)}</small></button>`
  }

  private mapButton(id: string, save: Save): string {
    const map = mapById(id)
    const locked = levelFromXp(save.xp).level < map.unlockLevel
    const on = this.draft.mapId === id
    const tag = locked ? `Level ${map.unlockLevel}` : map.mutator === 'lowgrav' ? 'Low gravity' : map.mutator === 'onegun' ? 'One gun' : map.tagline
    return `<button type="button" class="map-card${on ? ' on' : ''}${locked ? ' locked' : ''}" data-act="map:${id}"><b>${esc(map.name)}</b><small>${esc(tag)}</small></button>`
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

  private onScreenClick(event: Event): void {
    const target = (event.target as HTMLElement).closest<HTMLElement>('[data-act]')
    if (!target) return
    const act = target.dataset.act ?? ''
    const save = this.hooks.save()
    if (act.startsWith('nav:')) {
      this.setScreen(act.slice(4) as Screen)
      return
    }
    if (act.startsWith('diff:')) this.draft.difficulty = act.slice(5) as Difficulty
    else if (act.startsWith('agent:')) {
      this.draft.agent = act.slice(6) as AgentId
      this.hooks.preview(this.draft.agent, save.equipped.outfit)
    } else if (act.startsWith('weapon:')) this.draft.weapon = act.slice(7) as WeaponId
    else if (act.startsWith('map:')) {
      const id = act.slice(4)
      if (levelFromXp(save.xp).level >= mapById(id).unlockLevel) this.draft.mapId = id
    } else if (act.startsWith('size:')) this.draft.teamSize = Number(act.slice(5)) as 3 | 4 | 5
    else if (act.startsWith('rounds:')) this.draft.rounds = Number(act.slice(7)) as 2 | 3
    else if (act === 'toggle:storm') this.draft.storm = !this.draft.storm
    else if (act === 'toggle:lowgrav') this.draft.lowgrav = !this.draft.lowgrav
    else if (act === 'toggle:onegun') this.draft.onegun = !this.draft.onegun
    else if (act === 'tab:roster' || act === 'tab:locker') this.draft.tab = act.endsWith('locker') ? 'locker' : 'roster'
    else if (act.startsWith('equip:')) {
      const [, kind, id] = act.split(':')
      if (!kind || !id || !owns(save.xp, id)) return
      this.hooks.patch((next) => {
        if (kind === 'outfit' || kind === 'wrap' || kind === 'paint' || kind === 'spray') next.equipped[kind] = id
      })
      if (kind === 'outfit') this.hooks.preview(this.draft.agent, id)
    } else if (act === 'code:copy') {
      const code = encodeLobby(this.lobbyFromDraft())
      void navigator.clipboard?.writeText(code)
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
      }
    } else if (act === 'reset:ask') this.draft.confirmReset = true
    else if (act === 'reset:no') this.draft.confirmReset = false
    else if (act === 'reset:yes') {
      this.draft.confirmReset = false
      this.hooks.reset()
    } else if (act === 'start:quick' || act === 'start:custom' || act === 'start:ranked') {
      this.launch(act.slice(6), save)
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

  private launch(kind: string, save: Save): void {
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
      weaponId: onegun ? oneGunWeapon(seed) : this.draft.weapon,
      agentId: this.draft.agent,
      outfitId: save.equipped.outfit,
      wrapId: save.equipped.wrap,
      paintId: save.equipped.paint,
      sprayId: save.equipped.spray,
      ranked: kind === 'ranked',
      seed,
      playerName: save.name || 'Painter',
    }
    this.hooks.patch((next) => {
      next.equipped.agent = this.draft.agent
      next.equipped.weapon = this.draft.weapon
    })
    this.hooks.start(config)
  }

  private hudHtml(): string {
    return `
      <div id="fps" class="fps hidden"></div>
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
          <div class="ability" id="sig"><span class="key">Q</span><span class="name">DASH</span><i class="mask"></i></div>
          <div class="ability ult" id="ult"><span class="key">X</span><span class="name">ULT</span><i class="mask"></i></div>
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
    if (name) name.textContent = label
    const mask = el.querySelector('.mask') as HTMLElement | null
    if (mask) mask.style.height = ready ? '0%' : `${Math.min(100, (remaining / Math.max(0.01, max)) * 100)}%`
    const keyEl = el.querySelector('.key')
    if (keyEl) keyEl.textContent = ready ? key : remaining >= 10 && max > 20 ? `${Math.ceil(remaining)}` : remaining.toFixed(remaining < 10 && max < 30 ? 1 : 0)
    void key
  }
}
