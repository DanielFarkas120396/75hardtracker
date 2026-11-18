/** @jest-environment node */
import type { PainterKind } from '@logic/fillKinds'
import { fillOpacity, fillPalette, rgb, type FillPalette } from '@logic/fillPalette'
import { SURFACE, WORLD_COLORS } from '@logic/worldColors'
import type { CanvasKit, Shader } from 'canvaskit-wasm'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { FILLS, type NativePainter, type Uniforms } from '../shaders'

// Jest has no GPU, so the shaders are compiled and drawn here with CanvasKit: the same Skia as on the phone, in
// WebAssembly. Set FILL_SHOTS to a folder to also save each drawing as a PNG (the pictures shown to the owner).

const W = 173
const H = 120
const DARK = fillPalette(WORLD_COLORS.forest.dark, 'dark')
const SHOTS = process.env.FILL_SHOTS

let CK: CanvasKit

beforeAll(async () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const init = require('canvaskit-wasm/bin/full/canvaskit') as (options?: object) => Promise<CanvasKit>
  CK = await init()
  if (SHOTS) mkdirSync(SHOTS, { recursive: true })
})

/** A fill's shader, with its uniforms in the order the shader declares them. */
function shaderOf(kind: PainterKind, uniforms: Uniforms, photo?: Shader): Shader {
  const effect = CK.RuntimeEffect.Make(FILLS[kind].sksl, (error) => {
    throw new Error(`${kind}: ${error}`)
  })
  if (!effect) throw new Error(`${kind} did not compile`)
  const floats: number[] = []
  for (let i = 0; i < effect.getUniformCount(); i++) {
    const value = uniforms[effect.getUniformName(i)]
    if (value === undefined) throw new Error(`${kind}: no value for ${effect.getUniformName(i)}`)
    floats.push(...[value].flat())
  }
  expect(floats).toHaveLength(effect.getUniformFloatCount())
  return kind === 'iris' ? effect.makeShaderWithChildren(floats, [photo ?? CK.Shader.MakeColor([0.5, 0.5, 0.5, 1], CK.ColorSpace.SRGB)]) : effect.makeShader(floats)
}

interface Drawing {
  /** The pixel at a point of the tile: red, green, blue (not multiplied by alpha) and alpha, 0 to 255. */
  at(x: number, y: number): [number, number, number, number]
}

/** Draws a fill alone, on nothing, at one pixel per point. */
function draw(kind: PainterKind, uniforms: Uniforms, width = W, height = H, photo?: Shader): Drawing {
  const surface = CK.MakeSurface(width, height)!
  const paint = new CK.Paint()
  paint.setShader(shaderOf(kind, uniforms, photo))
  surface.getCanvas().drawPaint(paint)
  const pixels = surface.makeImageSnapshot().readPixels(0, 0, {
    width,
    height,
    colorType: CK.ColorType.RGBA_8888,
    alphaType: CK.AlphaType.Unpremul,
    colorSpace: CK.ColorSpace.SRGB,
  }) as Uint8Array
  return {
    at(x, y) {
      const i = (Math.round(y) * width + Math.round(x)) * 4
      return [pixels[i], pixels[i + 1], pixels[i + 2], pixels[i + 3]]
    },
  }
}

/** Saves the fill as the phone shows it: on the tile's surface, at the fill's opacity, three pixels per point. */
function shoot(name: string, kind: PainterKind, uniforms: Uniforms, palette: FillPalette, width = W, height = H, photo?: Shader) {
  if (!SHOTS) return
  const scale = 3
  const surface = CK.MakeSurface(width * scale, height * scale)!
  const canvas = surface.getCanvas()
  canvas.scale(scale, scale)
  canvas.clear(CK.Color4f(...rgb(SURFACE[palette.mode]), 1))
  const layer = new CK.Paint()
  layer.setAlphaf(fillOpacity(kind, palette))
  canvas.saveLayer(layer)
  const paint = new CK.Paint()
  paint.setShader(shaderOf(kind, uniforms, photo))
  canvas.drawPaint(paint)
  canvas.restore()
  writeFileSync(join(SHOTS, `${name}.png`), surface.makeImageSnapshot().encodeToBytes()!)
}

/** Steps a painter at 60 frames a second. */
function play(painter: NativePainter, seconds: number) {
  for (let i = 0; i < Math.round(seconds * 60); i++) painter.step(1 / 60, true)
}

const at = (kind: PainterKind, level: number) => {
  const painter = FILLS[kind].create()
  painter.setLevel(level, true)
  return painter
}

describe('the fills, drawn', () => {
  it.each(Object.keys(FILLS) as PainterKind[])('%s compiles, and is empty on an untouched tile', (kind) => {
    const drawing = draw(kind, at(kind, 0).uniforms(W, H, DARK))
    for (const [x, y] of [[10, 10], [W / 2, H / 2], [W - 10, H - 10], [20, H - 8]]) expect(drawing.at(x, y)[3]).toBe(0)
  })

  it('water covers the bottom of the tile up to its level, and all of it when full', () => {
    const half = at('wave', 0.5)
    const drawing = draw('wave', half.uniforms(W, H, DARK))
    expect(drawing.at(W / 2, H - 10)[3]).toBeGreaterThan(150)
    expect(drawing.at(W / 2, 12)[3]).toBe(0)
    shoot('wave-half', 'wave', half.uniforms(W, H, DARK), DARK)
    const full = draw('wave', at('wave', 1).uniforms(W, H, DARK))
    expect(full.at(W / 2, 3)[3]).toBeGreaterThan(150)

    const pour = at('wave', 0.3)
    pour.setLevel(0.5, false)
    play(pour, 0.5)
    shoot('wave-pouring', 'wave', pour.uniforms(W, H, DARK), DARK)
    shoot('wave-wide-light', 'wave', half.uniforms(358, H, fillPalette(WORLD_COLORS.hell.light, 'light')), fillPalette(WORLD_COLORS.hell.light, 'light'), 358)
  })

  it('the sprint covers the tile from the left up to its front, in the world colour', () => {
    const half = at('sprint', 0.5)
    const drawing = draw('sprint', half.uniforms(W, H, DARK))
    const [r, g, b, a] = drawing.at(20, H / 2 + 2)
    expect(a).toBeGreaterThan(140)
    // The body is the world's mid tone (forest's #7fb08a), give or take the thin lines flowing through it.
    expect(Math.abs(r - 0x7f) + Math.abs(g - 0xb0) + Math.abs(b - 0x8a)).toBeLessThan(60)
    expect(drawing.at(W - 20, H / 2)[3]).toBe(0)
    expect(draw('sprint', at('sprint', 1).uniforms(W, H, DARK)).at(W - 2, H / 2)[3]).toBeGreaterThan(140)

    const running = at('sprint', 0)
    running.setLevel(0.5, false)
    play(running, 0.15)
    shoot('sprint-running', 'sprint', running.uniforms(W, H, DARK), DARK)
    shoot('sprint-half', 'sprint', half.uniforms(W, H, DARK), DARK)
  })

  it('the ink spreads from the switches, and covers the whole tile when both are ticked', () => {
    const half = at('ink', 0.5)
    const drawing = draw('ink', half.uniforms(W, H, DARK))
    // Its origin is the switches, 56 px from the right edge at mid height.
    expect(drawing.at(W - 56, H / 2)[3]).toBeGreaterThan(150)
    expect(drawing.at(4, 4)[3]).toBe(0)
    const full = draw('ink', at('ink', 1).uniforms(W, H, DARK))
    for (const [x, y] of [[2, 2], [W - 3, 3], [3, H - 3], [W / 2, H / 2]]) expect(full.at(x, y)[3]).toBeGreaterThan(150)
    shoot('ink-half', 'ink', half.uniforms(W, H, DARK), DARK)
    shoot('ink-full', 'ink', at('ink', 1).uniforms(W, H, DARK), DARK)
  })

  it('the iris is open on the photo at rest, all blades when shut, and whitened by its flash', () => {
    const red = CK.Shader.MakeColor([1, 0, 0, 1], CK.ColorSpace.SRGB)
    const open = at('iris', 1)
    open.setHasImage?.(true)
    const rest = draw('iris', open.uniforms(W, H, DARK), W, H, red)
    // The photo in the world's two tones, 30% of its own colour left: opaque, and redder than it is green.
    const [r, g, , a] = rest.at(W / 2, H / 2)
    expect(a).toBe(255)
    expect(r).toBeGreaterThan(g)

    const iris = at('iris', 0)
    iris.setLevel(1, false)
    play(iris, 0.12)
    const shut = draw('iris', iris.uniforms(W, H, DARK), W, H, red)
    const flashed = shut.at(W / 2, H / 2)
    expect(flashed[3]).toBe(255)
    // No photo yet: it stays shut, and the flash has died away after half a second.
    play(iris, 0.5)
    const dark = draw('iris', iris.uniforms(W, H, DARK), W, H, red)
    for (const [x, y] of [[5, 5], [W / 2, H / 2], [W - 5, H - 5], [W / 2 + 30, 20]]) {
      const pixel = dark.at(x, y)
      expect(pixel[3]).toBe(255)
      // A blade: darker than the world's deep tone would be as a photo, and no red in it.
      expect(pixel[0]).toBeLessThan(90)
    }
    expect(flashed[1]).toBeGreaterThan(dark.at(W / 2, H / 2)[1] + 60)

    const shots = at('iris', 0)
    shots.setHasImage?.(true)
    shots.setLevel(1, false)
    const photo = SHOTS ? stripes() : red
    for (const [name, seconds] of [['1-closing', 0.08], ['2-flash', 0.05], ['3-opening', 0.2], ['4-opening', 0.2], ['5-opening', 0.25], ['6-open', 1]] as const) {
      play(shots, seconds)
      shoot(`iris-${name}`, 'iris', shots.uniforms(W, H, DARK), DARK, W, H, photo)
    }
  })

  it('the book fills a tenth per page from the left, and shades its spine once a page is read', () => {
    const three = at('book', 0.3)
    const drawing = draw('book', three.uniforms(W, H, DARK))
    // The fill: the world's mid tone at 30%.
    expect(drawing.at(10, 20)[3]).toBeGreaterThan(60)
    expect(drawing.at(10, 20)[3]).toBeLessThan(110)
    expect(drawing.at(W - 10, 20)[3]).toBe(0)
    // The spine's crease, down the middle: darker than the fill beside it.
    expect(drawing.at(W / 2, 20)[3]).toBeGreaterThan(120)
    expect(draw('book', at('book', 1).uniforms(W, H, DARK)).at(W - 3, 20)[3]).toBeGreaterThan(60)
    shoot('book-three-pages', 'book', three.uniforms(W, H, DARK), DARK)
  })

  it('a turning page stands over the spine in mid-turn, then shows its back on the left', () => {
    const book = at('book', 0)
    book.setLevel(0.1, false)
    play(book, 0.02)
    const before = draw('book', book.uniforms(W, H, DARK)).at(W * 0.75, H / 2)[3]
    play(book, 0.42)
    const lifting = book.uniforms(W, H, DARK)
    shoot('book-page-1-lifting', 'book', lifting, DARK)
    expect(lifting.uCount).toBe(1)
    // Lifted off the right half: something is drawn there that wasn't at the start.
    expect(draw('book', lifting).at(W * 0.75, H / 2)[3]).toBeGreaterThan(before)
    play(book, 0.5)
    shoot('book-page-2-over', 'book', book.uniforms(W, H, DARK), DARK)
    play(book, 0.6)
    const landing = book.uniforms(W, H, DARK)
    // Past the spine: the page is over the left half, where the edge colour of its back shows.
    expect(draw('book', landing).at(W * 0.3, H / 2)[3]).toBeGreaterThan(draw('book', lifting).at(W * 0.3, H / 2)[3])
    shoot('book-page-3-landing', 'book', landing, DARK)
    play(book, 1)
    expect(book.uniforms(W, H, DARK).uCount).toBe(0)

    const riffle = at('book', 0)
    riffle.setLevel(1, false)
    play(riffle, 1.6)
    expect(riffle.uniforms(W, H, DARK).uCount).toBeGreaterThan(4)
    shoot('book-riffle', 'book', riffle.uniforms(W, H, DARK), DARK)
    play(riffle, 0.8)
    shoot('book-riffle-wide', 'book', riffle.uniforms(358, H, DARK), DARK, 358)
  })
})

/** A stand-in photo for the pictures: bands of light and dark, so the two tones show. */
function stripes(): Shader {
  return CK.Shader.MakeLinearGradient([0, 0], [W, H], [CK.Color(245, 230, 210), CK.Color(60, 40, 30), CK.Color(210, 150, 110), CK.Color(30, 30, 40)], null, CK.TileMode.Clamp)
}
