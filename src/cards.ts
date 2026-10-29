export type CardShape = 'wide' | 'tall'

const cache = new Map<string, string>()

function rand(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return s / 2147483647
  }
}

function splat(g: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, rng: () => number): void {
  g.fillStyle = color
  g.beginPath()
  g.ellipse(x, y, r, r * 0.86, rng() * 3, 0, Math.PI * 2)
  g.fill()
  for (let i = 0; i < 7; i++) {
    const a = rng() * Math.PI * 2
    const d = r * (1.1 + rng() * 0.7)
    g.beginPath()
    g.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, r * (0.08 + rng() * 0.14), 0, Math.PI * 2)
    g.fill()
  }
}

function starPath(g: CanvasRenderingContext2D, x: number, y: number, r: number, inner: number, n: number): void {
  g.beginPath()
  for (let i = 0; i < n * 2; i++) {
    const rad = i % 2 === 0 ? r : inner
    const a = -Math.PI / 2 + (i * Math.PI) / n
    if (i === 0) g.moveTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad)
    else g.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad)
  }
  g.closePath()
}

function wing(g: CanvasRenderingContext2D, cx: number, cy: number, s: number, dir: number, color: string): void {
  g.fillStyle = color
  g.beginPath()
  g.moveTo(cx, cy)
  g.bezierCurveTo(cx + dir * 0.3 * s, cy - 0.9 * s, cx + dir * 1.1 * s, cy - 1 * s, cx + dir * 1.04 * s, cy - 0.36 * s)
  g.bezierCurveTo(cx + dir * 1 * s, cy - 0.06 * s, cx + dir * 0.5 * s, cy + 0.04 * s, cx, cy)
  g.fill()
  g.beginPath()
  g.moveTo(cx, cy + 0.04 * s)
  g.bezierCurveTo(cx + dir * 0.6 * s, cy + 0.12 * s, cx + dir * 0.86 * s, cy + 0.68 * s, cx + dir * 0.52 * s, cy + 0.78 * s)
  g.bezierCurveTo(cx + dir * 0.24 * s, cy + 0.84 * s, cx + dir * 0.08 * s, cy + 0.42 * s, cx, cy + 0.04 * s)
  g.fill()
}

function draw(g: CanvasRenderingContext2D, id: string, w: number, h: number): void {
  const m = Math.min(w, h)
  const rng = rand(id.length * 977 + w)
  if (id === 'sunset') {
    const sky = g.createLinearGradient(0, 0, 0, h)
    sky.addColorStop(0, '#3a1d6e')
    sky.addColorStop(0.5, '#ff5e7a')
    sky.addColorStop(1, '#ffb03d')
    g.fillStyle = sky
    g.fillRect(0, 0, w, h)
    g.fillStyle = '#ffe9a0'
    g.beginPath()
    g.arc(w * 0.62, h * 0.62, m * 0.28, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = '#1c1030'
    for (let i = 0; i < 9; i++) {
      const bw = w * (0.08 + rng() * 0.1)
      const bh = h * (0.12 + rng() * 0.22)
      g.beginPath()
      g.roundRect(i * (w / 8) - bw * 0.3, h - bh, bw, bh, 6)
      g.fill()
    }
    g.fillRect(0, h * 0.93, w, h * 0.07)
  } else if (id === 'shade') {
    const bg = g.createRadialGradient(w / 2, h * 0.45, 0, w / 2, h * 0.45, Math.max(w, h) * 0.7)
    bg.addColorStop(0, '#3b2a6a')
    bg.addColorStop(1, '#07050d')
    g.fillStyle = bg
    g.fillRect(0, 0, w, h)
    g.fillStyle = '#120d1f'
    g.beginPath()
    g.ellipse(w / 2, h * 0.5, m * 0.42, m * 0.48, 0, 0, Math.PI * 2)
    g.fill()
    g.shadowColor = '#8fd3ff'
    g.shadowBlur = m * 0.08
    g.fillStyle = '#bfe8ff'
    const eye = (x: number, y: number, len: number) => {
      g.beginPath()
      g.roundRect(x - len / 2, y - m * 0.02, len, m * 0.04, m * 0.02)
      g.fill()
    }
    eye(w / 2 - m * 0.14, h * 0.46, m * 0.16)
    eye(w / 2 + m * 0.14, h * 0.46, m * 0.16)
    eye(w / 2, h * 0.56, m * 0.12)
    g.shadowBlur = 0
  } else if (id === 'crowncard') {
    const bg = g.createLinearGradient(0, 0, w, h)
    bg.addColorStop(0, '#7a4a00')
    bg.addColorStop(0.5, '#ffd056')
    bg.addColorStop(1, '#a86a00')
    g.fillStyle = bg
    g.fillRect(0, 0, w, h)
    g.globalAlpha = 0.25
    for (let i = 0; i < 14; i++) {
      g.fillStyle = '#fff6d0'
      g.fillRect(i * (w / 7) - w * 0.2, 0, w * 0.04, h * 2)
    }
    g.globalAlpha = 1
    const cx = w / 2
    const cy = h * 0.52
    const s = m * 0.5
    g.fillStyle = '#fff1b8'
    g.strokeStyle = '#5a3500'
    g.lineWidth = m * 0.03
    g.beginPath()
    g.moveTo(cx - s * 0.6, cy + s * 0.3)
    g.lineTo(cx - s * 0.7, cy - s * 0.35)
    g.lineTo(cx - s * 0.3, cy - s * 0.05)
    g.lineTo(cx, cy - s * 0.5)
    g.lineTo(cx + s * 0.3, cy - s * 0.05)
    g.lineTo(cx + s * 0.7, cy - s * 0.35)
    g.lineTo(cx + s * 0.6, cy + s * 0.3)
    g.closePath()
    g.fill()
    g.stroke()
  } else if (id === 'evoricard') {
    const sky = g.createLinearGradient(0, 0, 0, h)
    sky.addColorStop(0, '#1b1450')
    sky.addColorStop(0.5, '#5a42a8')
    sky.addColorStop(0.85, '#d496e0')
    sky.addColorStop(1, '#ffd0ea')
    g.fillStyle = sky
    g.fillRect(0, 0, w, h)
    g.globalCompositeOperation = 'lighter'
    const bands: [string, number][] = [['rgba(120,255,214,0.35)', 0.22], ['rgba(255,160,230,0.3)', 0.36], ['rgba(150,170,255,0.3)', 0.48]]
    for (const [color, y] of bands) {
      g.strokeStyle = color
      g.lineWidth = m * 0.16
      g.lineCap = 'round'
      g.beginPath()
      for (let x = -20; x <= w + 20; x += 10) {
        const yy = h * y + Math.sin(x / (w * 0.18)) * h * 0.06
        if (x === -20) g.moveTo(x, yy)
        else g.lineTo(x, yy)
      }
      g.stroke()
    }
    g.globalCompositeOperation = 'source-over'
    g.fillStyle = '#ffffff'
    for (let i = 0; i < 70; i++) {
      g.globalAlpha = 0.3 + rng() * 0.7
      g.fillRect(rng() * w, rng() * h * 0.7, 1.6, 1.6)
    }
    g.globalAlpha = 1
    const cx = w / 2
    const cy = h * 0.6
    const s = m * 0.42
    g.globalAlpha = 0.9
    wing(g, cx, cy, s, -1, '#d9b8ff')
    wing(g, cx, cy, s, 1, '#ffb8e6')
    g.globalAlpha = 0.6
    wing(g, cx, cy, s * 0.55, -1, '#ffffff')
    wing(g, cx, cy, s * 0.55, 1, '#ffffff')
    g.globalAlpha = 1
    g.fillStyle = '#5b3f8f'
    g.beginPath()
    g.ellipse(cx, cy + s * 0.12, s * 0.06, s * 0.42, 0, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = '#fff5a8'
    starPath(g, w * 0.82, h * 0.2, m * 0.06, m * 0.025, 4)
    g.fill()
    starPath(g, w * 0.16, h * 0.82, m * 0.045, m * 0.02, 4)
    g.fill()
  } else {
    const bg = g.createLinearGradient(0, 0, w, h)
    bg.addColorStop(0, '#1d3fb8')
    bg.addColorStop(0.5, '#3c7dff')
    bg.addColorStop(0.5, '#ff7424')
    bg.addColorStop(1, '#c2410c')
    g.fillStyle = bg
    g.fillRect(0, 0, w, h)
    splat(g, w * 0.3, h * 0.45, m * 0.22, '#ff7424', rng)
    splat(g, w * 0.72, h * 0.58, m * 0.24, '#3c7dff', rng)
    splat(g, w * 0.5, h * 0.2, m * 0.1, '#ffe14a', rng)
    splat(g, w * 0.15, h * 0.85, m * 0.08, '#ff4d8d', rng)
  }
}

export function cardArt(id: string, shape: CardShape): string {
  const key = `${id}:${shape}`
  const hit = cache.get(key)
  if (hit) return hit
  const c = document.createElement('canvas')
  c.width = shape === 'wide' ? 640 : 240
  c.height = shape === 'wide' ? 160 : 480
  const g = c.getContext('2d')!
  draw(g, id, c.width, c.height)
  const url = c.toDataURL('image/png')
  cache.set(key, url)
  return url
}
