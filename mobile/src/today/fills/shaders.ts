import { BOOK, createBookModel, pageOpacity, spineShade } from '@logic/fillBook'
import { createInkModel, INK } from '@logic/fillInk'
import { createIrisModel, IRIS } from '@logic/fillIris'
import type { FillModel, PainterKind } from '@logic/fillKinds'
import { FILL_LOOK, mix, type FillPalette } from '@logic/fillPalette'
import { createSprintModel, SPRINT } from '@logic/fillSprint'
import { createWaveModel, WAVE } from '@logic/fillWave'

/** What a fill's shader is drawn with: floats, and float lists for vectors and arrays. */
export type Uniforms = Record<string, number | number[]>

/**
 * The web's fills (src/screens/Today/fills/) as Skia shaders. Each shader gets its pixel in points from the tile's
 * top left; the web's code works in px from the tile's centre with y up, so each starts by turning one into the
 * other. Skia wants the colour already multiplied by its alpha, and has no `discard`.
 */
const CENTRED = 'float2 vP = float2(xy.x - uSize.x * 0.5, uSize.y * 0.5 - xy.y);'

/** wave.ts's fragment shader. */
const WAVE_SKSL = `
uniform float2 uSize;
uniform float uLevel;
uniform float uTime;
uniform float uAmp;
uniform float uSlosh;
uniform float uRipA;
uniform float uRipT;
uniform float uRipX;
uniform float uBub;
uniform float uFizz;
uniform float uShine;
uniform float uBack;
uniform float3 uLight;
uniform float3 uTop;
uniform float3 uMid;
uniform float3 uDeep;
float hash(float n) { return fract(sin(n * 127.1) * 43758.5453); }
float waves(float x, float ph) { return uAmp * (0.6 * sin(x * 0.035 + uTime * 1.6 + ph) + 0.4 * sin(x * 0.071 - uTime * 2.3 + ph * 1.7)); }
float caustic(float2 p) {
  float2 q = p * float2(0.045, 0.06);
  float c = sin(q.x + sin(q.y + uTime * 0.9) * 1.6 + uTime * 0.7) * sin(q.y - uTime * 0.6 + sin(q.x * 0.8 - uTime * 0.5) * 1.3);
  return pow(1.0 - abs(c), 10.0);
}
float surf(float x, float ph) {
  float d = abs(x - uRipX) - 170.0 * uRipT;
  return uLevel + waves(x, ph) + uSlosh * x / (uSize.x * 0.5) + uRipA * sin(d * 0.09) * exp(-d * d / 1800.0);
}
half4 main(float2 xy) {
  ${CENTRED}
  float x = vP.x;
  float y = vP.y;
  float s = surf(x, 0.0);
  float sb = surf(x, 2.1) + 2.0 + uAmp * 0.5;
  float depth = s - y;
  float front = 1.0 - smoothstep(s - 0.8, s + 0.8, y);
  float back = (1.0 - smoothstep(sb - 0.8, sb + 0.8, y)) * (1.0 - front) * uBack;
  float bub = 0.0;
  for (int i = 0; i < 14; i++) {
    float fi = float(i);
    float per = 2.4 + 2.0 * hash(fi);
    float ph = uTime / per + hash(fi + 3.3);
    float cyc = floor(ph);
    float a = fract(ph);
    float bx = (hash(fi * 1.7 + cyc * 3.1) - 0.5) * uSize.x * 0.92 + sin(a * 11.0 + fi) * 3.0;
    float by = -uSize.y * 0.5 + a * (uLevel + uSize.y * 0.5 + 8.0);
    float r = 1.2 + 2.2 * hash(fi + 9.1);
    float dd = length(float2(x - bx, y - by));
    bub += ((1.0 - smoothstep(0.0, 1.0, abs(dd - r))) * 0.8 + (1.0 - smoothstep(0.0, r, dd)) * 0.15) * step(by + r, surf(bx, 0.0));
  }
  float hl = (exp(-depth * depth / 3.0) + caustic(vP) * uShine * exp(-max(depth, 0.0) / 70.0) + bub * uBub * (0.35 + uFizz)) * front;
  float3 body = mix(uTop, uDeep, smoothstep(0.0, uSize.y, depth));
  float a = front * 0.78 + back * 0.35;
  float3 c = (body * front * 0.78 + mix(uMid, uDeep, 0.3) * back * 0.35) / max(a, 0.001);
  float alpha = clamp(a + hl * 0.4, 0.0, 1.0);
  return half4(mix(c, uLight, clamp(hl, 0.0, 1.0)) * alpha, alpha);
}
`

/** ink.ts's fragment shader. */
const INK_SKSL = `
uniform float2 uSize;
uniform float uTime;
uniform float uR;
uniform float uSwirl;
uniform float uSoft;
uniform float uScale;
uniform float2 uO;
uniform float3 uTop;
uniform float3 uVein;
float hash(float2 p) { return fract(sin(dot(p, float2(127.1, 311.7))) * 43758.5453); }
float noise(float2 p) {
  float2 i = floor(p);
  float2 f = fract(p);
  float2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + float2(1.0, 0.0)), u.x), mix(hash(i + float2(0.0, 1.0)), hash(i + float2(1.0, 1.0)), u.x), u.y);
}
float fbm(float2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = p * 2.03 + float2(1.7, 9.2);
    a *= 0.5;
  }
  return v;
}
half4 main(float2 xy) {
  ${CENTRED}
  float2 q = vP / uScale;
  float2 w = float2(fbm(q + float2(0.0, uTime * 0.08)), fbm(q + float2(5.2, 1.3) - uTime * 0.06));
  float2 w2 = float2(fbm(q + 3.0 * w + float2(1.7, 9.2) + uTime * 0.05), fbm(q + 3.0 * w + float2(8.3, 2.8)));
  float e = uR - (length(vP - uO) + (w2.x - 0.5) * uSwirl * 120.0);
  float a = smoothstep(-uSoft, uSoft, e);
  if (a <= 0.0) return half4(0.0);
  float k = e / (uSoft * 3.0 + 4.0);
  float rim = exp(-k * k);
  float vein = fbm(q * 2.0 + w2 * 2.0);
  float3 c = mix(uTop, uVein, clamp(vein * 1.1 + rim * 0.6, 0.0, 1.0));
  float alpha = a * (0.78 + 0.22 * rim);
  return half4(c * alpha, alpha);
}
`

/** sprint.ts's fragment shader. */
const SPRINT_SKSL = `
uniform float2 uSize;
uniform float uFront;
uniform float uVel;
uniform float uRows;
uniform float uLen;
uniform float uSoft;
uniform float uTime;
uniform float uFlow;
uniform float3 uMid;
uniform float3 uLight;
float h1(float n) { return fract(sin(n * 127.1) * 43758.5453); }
half4 main(float2 xy) {
  ${CENTRED}
  float x = vP.x + uSize.x * 0.5;
  float rowH = uSize.y / uRows;
  float row = floor((vP.y + uSize.y * 0.5) / rowH);
  float ry = fract((vP.y + uSize.y * 0.5) / rowH);
  float thick = 1.0 - smoothstep(0.08, 0.3, abs(ry - 0.5));
  float thin = 1.0 - smoothstep(0.03, 0.14, abs(ry - 0.5));
  float rs = 0.6 + 0.8 * h1(row);
  float off = h1(row + 7.3);
  float lead = uLen * uVel * (0.25 + 0.95 * h1(row + 3.1));
  float f = uFront + (h1(row + 1.7) - 0.5) * uSoft;
  float behind = 1.0 - smoothstep(f - uSoft, f, x);
  float streak = lead > 0.5 ? thick * smoothstep(f, f + lead, x) * step(x, f + lead) * step(f - 2.0, x) : 0.0;
  float flow = thin * pow(fract(x / 120.0 - uTime * uFlow * rs + off), 6.0) * 0.6 * behind;
  float fill = behind * 0.62;
  float a = clamp(fill + streak + flow, 0.0, 1.0);
  float3 c = (uMid * fill + uLight * (streak + flow)) / max(fill + streak + flow, 0.001);
  return half4(c * a, a);
}
`

// The iris's scene, as iris.ts builds it in three.js: eight plates stacked 0.6 apart from z = 2, the whole stack
// tilted 0.04 rad about the x axis, a standard material (metalness 0.35, roughness 0.38) under an ambient light of
// 0.5 and a sun of 0.9 from the upper left, seen from 900 px away. Each plate has a 1.6 px edge line at 55%.
const TILT = 0.04
const CAMERA = 900

/**
 * iris.ts's scene in one shader. Per pixel: the photo in the world's two tones; over it the plate that is nearest
 * the camera among those covering the pixel, lit by three.js's own formula for its standard material (worked in
 * linear light, as three.js does); the plate's edge line; the flash on top.
 */
const IRIS_SKSL = `
uniform shader uPhoto;
uniform float2 uSize;
uniform float uR;
uniform float uTwist;
uniform float uPhotoOn;
uniform float uHasPhoto;
uniform float uFlash;
uniform float uColour;
uniform float3 uShadow;
uniform float3 uLight;
uniform float3 uMid;
uniform float3 uBlade;
uniform float3 uEdge;
const float PI = 3.14159265;
float3 toLinear(float3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, float3(2.4)), step(float3(0.04045), c)); }
float3 toScreen(float3 c) { return mix(c * 12.92, 1.055 * pow(c, float3(1.0 / 2.4)) - 0.055, step(float3(0.0031308), c)); }
float3 plate(float2 p) {
  float3 N = float3(0.0, -sin(${TILT}), cos(${TILT}));
  float3 L = normalize(float3(-200.0, 250.0, 600.0));
  float3 V = normalize(float3(-p.x, -p.y, ${CAMERA}.0));
  float3 H = normalize(L + V);
  float3 base = toLinear(uBlade);
  float3 diffuse = base * (1.0 - 0.35);
  float3 f0 = mix(float3(0.04), base, 0.35);
  float alpha = 0.38 * 0.38;
  float a2 = alpha * alpha;
  float dotNL = clamp(dot(N, L), 0.0, 1.0);
  float dotNV = clamp(dot(N, V), 0.0, 1.0);
  float dotNH = clamp(dot(N, H), 0.0, 1.0);
  float dotVH = clamp(dot(V, H), 0.0, 1.0);
  float fresnel = exp2((-5.55473 * dotVH - 6.98316) * dotVH);
  float3 F = f0 * (1.0 - fresnel) + fresnel;
  float gv = dotNL * sqrt(a2 + (1.0 - a2) * dotNV * dotNV);
  float gl = dotNV * sqrt(a2 + (1.0 - a2) * dotNL * dotNL);
  float vis = 0.5 / max(gv + gl, 0.000001);
  float denom = dotNH * dotNH * (a2 - 1.0) + 1.0;
  float D = a2 / (PI * denom * denom);
  return toScreen(diffuse * (0.5 + 0.9 * dotNL) + dotNL * 0.9 * PI * F * (vis * D));
}
half4 main(float2 xy) {
  ${CENTRED}
  float4 res = float4(0.0);
  if (uPhotoOn > 0.5) {
    float3 c = uMid;
    if (uHasPhoto > 0.5) c = uPhoto.eval(xy).rgb;
    float l = dot(c, float3(0.299, 0.587, 0.114));
    res = float4(mix(mix(uShadow, uLight, l), c, uColour), 1.0);
  }
  float top = -100000.0;
  float edge = 0.0;
  for (int i = 0; i < ${IRIS.blades}; i++) {
    float phi = float(i) / ${IRIS.blades}.0 * 2.0 * PI + uTwist;
    float2 d = float2(cos(phi), sin(phi));
    float along = dot(vP, d) - uR;
    if (along >= 0.0) {
      float z = 2.0 + 0.6 * float(i) + sin(${TILT}) * (vP.y - uR * d.y);
      if (z > top) {
        top = z;
        edge = along < 1.6 ? 0.55 : 0.0;
      }
    }
  }
  // A plate that dips behind the photo's plane is hidden by it, as the depth test hides it on the web.
  if (top > -10000.0 && !(uPhotoOn > 0.5 && top < 0.0)) res = float4(mix(plate(vP), uEdge, edge), 1.0);
  res = mix(res, float4(0.965, 1.0, 0.957, 1.0), uFlash);
  return half4(res);
}
`

const PAGES_AT_ONCE = 9
const SEGMENTS = 32
// book.ts's scene: seen from 900 px away, lit from the upper left; a page's two faces at 62% plus half the light.
const L = [-200, 250, 600].map((n) => n / Math.hypot(-200, 250, 600))
const f = (n: number) => (Number.isInteger(n) ? `${n}.0` : String(n))

/**
 * book.ts's scene in one shader. Per pixel: the fill with its feathered edge; the open book's gutter shade; then
 * each turning page, oldest first. A page is traced along its curl (pageAngle in @logic/fillBook, column by column
 * as the web bends its mesh), seen through the web's camera; where the curl folds over itself the surface nearest
 * the camera is the one drawn, and a page behind an older page's surface is hidden, as the web's depth test does.
 */
const BOOK_SKSL = `
uniform float2 uSize;
uniform float uFill;
uniform float uFillX;
uniform float uSpine;
uniform float uCount;
uniform float uT[${PAGES_AT_ONCE}];
uniform float uOpacity[${PAGES_AT_ONCE}];
uniform float3 uMid;
uniform float3 uEdge;
const float PI = 3.14159265;
const float D = ${CAMERA}.0;
float smooth01(float x) { float t = clamp(x, 0.0, 1.0); return t * t * (3.0 - 2.0 * t); }
float inOut(float x) { float t = clamp(x, 0.0, 1.0); return t < 0.5 ? 4.0 * t * t * t : 1.0 - pow(2.0 - 2.0 * t, 3.0) / 2.0; }
float inOutSlope(float x) {
  if (x <= 0.0 || x >= 1.0) return 0.0;
  return x < 0.5 ? 12.0 * x * x : 3.0 * (2.0 - 2.0 * x) * (2.0 - 2.0 * x);
}
float restAngle(float u) { return ${f(BOOK.beta)} * (1.0 - smooth01(u / ${f(BOOK.gutter)})); }
float gutterShade(float u, float depth) {
  float g = 1.0 - smoothstep(0.0, 0.34, u);
  return (g * g * 0.42 + (1.0 - smoothstep(0.0, 0.03, u)) * 0.25) * depth;
}
float gutterLight(float u, float depth) { return smoothstep(0.1, 0.22, u) * (1.0 - smoothstep(0.22, 0.42, u)) * 0.07 * depth; }
// How far along a resting half (0 at the spine, 1 at its outer edge) the point X px from the spine is.
float restU(float X, float pw) {
  float x = 0.0;
  float u = -1.0;
  float du = ${f(BOOK.gutter)} / 24.0;
  for (int i = 0; i < 24; i++) {
    float dx = pw * du * cos(restAngle((float(i) + 0.5) * du));
    if (u < 0.0 && X <= x + dx) u = (float(i) + (X - x) / dx) * du;
    x += dx;
  }
  if (u < 0.0) u = ${f(BOOK.gutter)} + (X - x) / pw;
  return u;
}
half4 main(float2 xy) {
  ${CENTRED}
  float pw = uSize.x * 0.5;
  float H = uSize.y;
  float fill = uFill <= 0.0 ? 0.0 : (1.0 - clamp((xy.x - uFill) / ${f(BOOK.feather)}, 0.0, 1.0)) * ${f(FILL_LOOK.book.body)};
  float4 res = float4(uMid * fill, fill);
  float ru = restU(abs(vP.x), pw);
  if (ru <= 1.0) {
    float shade = gutterShade(ru, uSpine);
    float light = gutterLight(ru, uSpine);
    res = res * (1.0 - shade - light) + float4(light, light, light, shade + light);
  }
  float zbuf = -100000.0;
  float v = clamp(vP.y / H + 0.5, 0.0, 1.0);
  float seg = pw / ${SEGMENTS}.0;
  for (int k = 0; k < ${PAGES_AT_ONCE}; k++) {
    if (float(k) < uCount) {
      float t = uT[k];
      float x = 0.0;
      float z = 0.5;
      float xv = 0.0;
      float zv = 0.0;
      float best = -100000.0;
      float bu = 0.0;
      float bx = 0.0;
      float bca = 1.0;
      float bsa = 0.0;
      float bxv = 0.0;
      float bzv = 0.0;
      for (int i = 0; i < ${SEGMENTS}; i++) {
        float u = (float(i) + 0.5) / ${SEGMENTS}.0;
        float lead = 0.3 * u * (1.0 - v) + 0.12 * u;
        float lag = 0.16 * (1.0 - smooth01(u / 0.3));
        float span = 1.0 - ${f(BOOK.start)} - lag;
        float arg = (t - ${f(BOOK.start)} - lag + lead) / span;
        float r = restAngle(u);
        float a = r + (PI - 2.0 * r) * inOut(arg);
        float av = (PI - 2.0 * r) * inOutSlope(arg) * (-0.3 * u) / span;
        float ca = cos(a);
        float sa = sin(a);
        float x1 = x + seg * ca;
        float z1 = z + seg * sa;
        float s0 = x * D / (D - z);
        float s1 = x1 * D / (D - z1);
        if (vP.x >= min(s0, s1) && vP.x <= max(s0, s1) && s0 != s1) {
          float along = (vP.x - s0) / (s1 - s0);
          float zh = mix(z, z1, along);
          float vh = vP.y * (D - zh) / D / H + 0.5;
          if (vh >= 0.0 && vh <= 1.0 && zh > best) {
            best = zh;
            bu = (float(i) + along) / ${SEGMENTS}.0;
            bx = mix(x, x1, along);
            bca = ca;
            bsa = sa;
            bxv = xv - along * sa * av * seg;
            bzv = zv + along * ca * av * seg;
          }
        }
        xv -= sa * av * seg;
        zv += ca * av * seg;
        x = x1;
        z = z1;
      }
      if (best > -10000.0) {
        if (best >= zbuf - 0.25) {
          float3 n = normalize(float3(-bsa, (bsa * bxv - bca * bzv) / H, bca));
          bool front = dot(n, float3(-bx, -vP.y * (D - best) / D, D - best)) > 0.0;
          if (!front) n = -n;
          float lit = max(dot(n, float3(${L.map(f).join(', ')})), 0.0);
          float3 c = (front ? uMid : uEdge) * (0.62 + 0.5 * lit);
          c = c * (1.0 - gutterShade(bu, ${f(BOOK.beta / 0.6)})) + float3(gutterLight(bu, ${f(BOOK.beta / 0.6)}));
          float b = 1.0 - ${f(BOOK.base)} * (1.0 - smoothstep(0.0, ${f(BOOK.reach)}, bu));
          float over = mix(${f(1 - BOOK.blend)}, 1.0, smoothstep(uFillX - ${f(BOOK.feather)}, uFillX + ${f(BOOK.feather)}, bx));
          float alpha = uOpacity[k] * b * over;
          res = res * (1.0 - alpha) + float4(c * alpha, alpha);
        }
        zbuf = max(zbuf, best);
      }
    }
  }
  return half4(res);
}
`

/** A fill's model with the uniforms its shader draws a frame with. */
export interface NativePainter extends Omit<FillModel<unknown>, 'frame'> {
  /** Whether the day's photo is decoded (the iris waits for it). */
  setHasImage?(has: boolean): void
  /** Draws the next frame's numbers for a tile of this size. Called once per frame drawn. */
  uniforms(width: number, height: number, palette: FillPalette): Uniforms
}

function painter<F>(model: FillModel<F>, toUniforms: (frame: F, width: number, height: number, palette: FillPalette) => Uniforms): NativePainter {
  return { ...model, uniforms: (width, height, palette) => toUniforms(model.frame(width, height), width, height, palette) }
}

const rgb = (c: readonly [number, number, number]) => [c[0], c[1], c[2]]

/** Each fill's shader and its painter: what `Skia.RuntimeEffect.Make` compiles, and what the engine steps. */
export const FILLS: Record<PainterKind, { sksl: string; create: () => NativePainter }> = {
  wave: {
    sksl: WAVE_SKSL,
    create: () =>
      painter(createWaveModel(), (frame, width, height, p) => ({
        uSize: [width, height],
        uLevel: frame.level,
        uTime: frame.time,
        uAmp: WAVE.amp,
        uSlosh: frame.slosh,
        uRipA: frame.ripA,
        uRipT: frame.ripT,
        uRipX: frame.ripX,
        uBub: WAVE.bubbles,
        uFizz: frame.fizz,
        uShine: WAVE.shimmer,
        uBack: frame.back,
        uLight: rgb(p.light),
        uTop: rgb(p.top),
        uMid: rgb(p.mid),
        uDeep: rgb(p.deep),
      })),
  },
  ink: {
    sksl: INK_SKSL,
    create: () =>
      painter(createInkModel(), (frame, width, height, p) => ({
        uSize: [width, height],
        uTime: frame.time,
        uR: frame.radius,
        uSwirl: INK.swirl,
        uSoft: INK.soft,
        uScale: INK.grain,
        uO: [frame.origin[0], frame.origin[1]],
        uTop: rgb(p.top),
        // The veins sit halfway between the deep and mid tones (deep alone read too dark on the dark tile).
        uVein: rgb(mix(p.deep, p.mid, 0.5)),
      })),
  },
  sprint: {
    sksl: SPRINT_SKSL,
    create: () =>
      painter(createSprintModel(), (frame, width, height, p) => ({
        uSize: [width, height],
        uFront: frame.front,
        uVel: frame.vel,
        uRows: SPRINT.lanes,
        uLen: SPRINT.streak,
        uSoft: SPRINT.ragged,
        uTime: frame.time,
        uFlow: SPRINT.flow,
        uMid: rgb(p.mid),
        uLight: rgb(p.light),
      })),
  },
  iris: {
    sksl: IRIS_SKSL,
    create: () => {
      const model = createIrisModel()
      let hasImage = false
      const iris = painter(model, (frame, width, height, p) => ({
        uSize: [width, height],
        uR: frame.r,
        uTwist: frame.twist,
        uPhotoOn: frame.photo,
        uHasPhoto: hasImage ? 1 : 0,
        uFlash: frame.flash,
        uColour: IRIS.colour,
        uShadow: rgb(mix(p.deep, [0, 0, 0], 0.6)),
        uLight: rgb(p.light),
        uMid: rgb(p.mid),
        uBlade: rgb(mix(p.deep, [0, 0, 0], 0.25)),
        uEdge: rgb(p.ink),
      }))
      return {
        ...iris,
        setHasImage(has) {
          hasImage = has
          model.setHasImage(has)
        },
      }
    },
  },
  book: {
    sksl: BOOK_SKSL,
    create: () =>
      painter(createBookModel(), (frame, width, _height, p) => {
        const pages = frame.pages.slice(0, PAGES_AT_ONCE)
        const padded = (value: (t: number) => number) => Array.from({ length: PAGES_AT_ONCE }, (_, k) => (k < pages.length ? value(pages[k].t) : 0))
        return {
          uSize: [width, _height],
          uFill: frame.fillPx >= width ? width + BOOK.feather : frame.fillPx,
          uFillX: frame.fillPx - width / 2,
          uSpine: spineShade(frame.turned, p.mode),
          uCount: pages.length,
          uT: padded((t) => t),
          uOpacity: padded(pageOpacity),
          uMid: rgb(p.mid),
          uEdge: rgb(p.edge),
        }
      }),
  },
}
