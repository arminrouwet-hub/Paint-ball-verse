export class AudioBus {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  volume = 0.7
  private lastShot = 0

  unlock(): void {
    if (!this.ctx) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      this.ctx = new Ctx()
      this.master = this.ctx.createGain()
      this.master.gain.value = this.volume
      this.master.connect(this.ctx.destination)
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
  }

  setVolume(v: number): void {
    this.volume = v
    if (this.master) this.master.gain.value = v
  }

  private now(): number {
    return this.ctx?.currentTime ?? 0
  }

  private envGain(start: number, peak: number, attack: number, dur: number): GainNode | null {
    if (!this.ctx || !this.master || this.volume <= 0.001) return null
    const g = this.ctx.createGain()
    g.connect(this.master)
    g.gain.setValueAtTime(0.0001, start)
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), start + attack)
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur)
    return g
  }

  private tone(freq: number, dur: number, type: OscillatorType, peak: number, slide = 0): void {
    if (!this.ctx) return
    const t = this.now()
    const g = this.envGain(t, peak, 0.008, dur)
    if (!g) return
    const o = this.ctx.createOscillator()
    o.type = type
    o.frequency.setValueAtTime(freq, t)
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur)
    o.connect(g)
    o.start(t)
    o.stop(t + dur + 0.02)
  }

  private noise(dur: number, peak: number, freq: number): void {
    if (!this.ctx) return
    const t = this.now()
    const g = this.envGain(t, peak, 0.004, dur)
    if (!g) return
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur))
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
    const src = this.ctx.createBufferSource()
    src.buffer = buf
    const filter = this.ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = freq
    src.connect(filter)
    filter.connect(g)
    src.start(t)
    src.stop(t + dur + 0.02)
  }

  shoot(kind: 'rapid' | 'sniper' | 'splash' | 'ability'): void {
    const t = performance.now()
    if (kind === 'rapid' && t - this.lastShot < 45) return
    this.lastShot = t
    if (kind === 'sniper') {
      this.noise(0.18, 0.35, 900)
      this.tone(180, 0.16, 'triangle', 0.18, -80)
    } else if (kind === 'splash') {
      this.noise(0.12, 0.32, 1400)
      this.tone(240, 0.08, 'square', 0.08, -40)
    } else if (kind === 'ability') {
      this.tone(520, 0.12, 'sawtooth', 0.08, 180)
      this.noise(0.1, 0.16, 1600)
    } else {
      this.noise(0.045, 0.18, 2200)
      this.tone(640 + Math.random() * 80, 0.04, 'square', 0.05)
    }
  }

  splat(): void {
    this.noise(0.09, 0.16, 700)
  }

  hit(head: boolean): void {
    this.tone(head ? 980 : 760, 0.07, 'square', 0.08)
    if (head) this.tone(1420, 0.09, 'triangle', 0.05)
  }

  dash(): void {
    this.tone(220, 0.18, 'sawtooth', 0.1, 260)
    this.noise(0.12, 0.12, 900)
  }

  reload(): void {
    this.tone(180, 0.06, 'square', 0.06)
    window.setTimeout(() => this.tone(240, 0.05, 'square', 0.05), 140)
  }

  explode(): void {
    this.noise(0.28, 0.4, 420)
    this.tone(120, 0.22, 'sine', 0.16, -60)
  }

  ult(): void {
    this.tone(320, 0.2, 'sawtooth', 0.08, 200)
    this.tone(480, 0.24, 'triangle', 0.06, 240)
  }

  ui(): void {
    this.tone(660, 0.05, 'square', 0.04)
  }

  win(): void {
    const notes = [523, 659, 784, 1046]
    notes.forEach((n, i) => {
      window.setTimeout(() => this.tone(n, 0.14, 'triangle', 0.08), i * 90)
    })
  }

  lose(): void {
    const notes = [392, 349, 311, 262]
    notes.forEach((n, i) => {
      window.setTimeout(() => this.tone(n, 0.16, 'triangle', 0.07), i * 110)
    })
  }

  down(): void {
    this.tone(200, 0.2, 'sine', 0.1, -80)
  }
}
