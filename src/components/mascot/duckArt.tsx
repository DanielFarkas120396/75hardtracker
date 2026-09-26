import { useId, type Ref } from 'react'

// Colours from the reference image. They stay the same in both themes; on the
// dark canvas the yellow body carries the silhouette.
const OUTLINE = '#5a1a16'
const BODY_FILL = '#f9dd97'
const ORANGE = '#ffb624'
const BLADE_GREY = '#d8d7d5'
const HANDLE_PINK = '#ffa6c5'
const ACCENT = '#ffc605'
const SWEAT_BLUE = '#38b6ff'

const FOOT_LEFT =
  'M96 460 C91 460 99 467 101 471 C103 475 103 480 106 484 C109 488 113 491 117 494 C121 497 126 499 131 501 C136 503 144 505 150 506 C156 507 160 507 165 507 C170 507 174 507 177 505 C180 503 182 500 184 497 C186 494 188 490 186 487 C184 484 179 481 170 478 C161 475 142 473 130 470 C118 467 101 460 96 460 Z'
const FOOT_RIGHT =
  'M279 478 C276 481 278 488 281 491 C284 494 290 496 294 498 C298 500 302 500 307 500 C312 500 316 500 321 499 C326 498 330 498 334 496 C338 494 344 491 348 488 C352 485 354 483 356 480 C358 477 359 472 360 468 C361 464 366 459 361 458 C356 457 340 462 330 464 C320 466 308 470 300 472 C292 474 282 475 279 478 Z'
/** Head and body in one piece, including the edges the wings cover (seen when an arm lifts). */
const BODY =
  'M238 39 C229 38 222 39 215 39 C208 39 203 40 196 41 C189 42 182 44 173 47 C164 50 154 55 145 60 C136 65 129 70 122 75 C115 80 109 86 104 91 C99 96 95 100 90 106 C85 112 80 121 76 127 C72 133 72 134 69 140 C66 146 62 157 59 165 C56 173 54 180 52 190 C50 200 48 212 47 225 C46 238 44 252 43 265 C42 278 41 292 40 305 C39 318 39 330 39 340 C39 350 39 357 40 365 C41 373 41 378 44 387 C47 396 52 410 58 420 C64 430 70 438 77 446 C84 454 90 463 101 469 C112 475 131 478 145 481 C159 484 171 485 183 486 C195 487 205 486 215 486 C225 486 235 486 243 486 C251 486 258 485 265 484 C272 483 280 480 287 479 C294 478 303 476 310 475 C317 474 324 472 330 470 C336 468 343 465 348 463 C353 461 357 462 362 458 C367 454 373 446 377 440 C381 434 384 431 388 424 C392 417 396 405 399 398 C402 391 402 387 403 381 C404 375 404 368 404 360 C404 352 403 345 403 335 C403 325 403 312 403 300 C403 288 404 275 405 262 C406 249 408 237 407 224 C406 211 401 196 397 184 C393 172 391 163 385 151 C379 139 372 123 363 111 C354 99 343 87 334 79 C325 71 318 68 311 63 C304 58 298 55 291 52 C284 49 277 46 268 44 C259 42 247 40 238 39 Z'
const RIGHT_WING_FILL =
  'M405 215 C407 215 404 220 407 224 C410 228 416 236 420 242 C424 248 428 253 433 262 C438 271 445 285 449 295 C453 305 456 316 457 324 C458 332 458 340 457 345 C456 350 455 354 453 357 C451 360 448 363 445 364 C442 365 440 366 437 365 C434 364 431 363 428 361 C425 359 420 354 417 352 C414 350 410 350 408 348 C406 346 405 344 404 341 C403 338 404 338 402 331 C400 324 396 312 394 300 C392 288 393 274 393 262 C393 250 394 234 396 226 C398 218 403 215 405 215 Z'
const RIGHT_WING_STROKE =
  'M405 215 C405 216 404 220 407 224 C410 228 416 236 420 242 C424 248 428 253 433 262 C438 271 445 285 449 295 C453 305 456 316 457 324 C458 332 458 340 457 345 C456 350 455 354 453 357 C451 360 448 363 445 364 C442 365 440 366 437 365 C434 364 431 363 428 361 C425 359 420 354 417 352 C414 350 410 350 408 348 C406 346 405 344 404 341 C403 338 402 333 402 331'
const LEFT_WING_FILL =
  'M51 195 C46 197 42 205 38 210 C34 215 33 219 30 224 C27 229 23 236 21 242 C19 248 18 251 16 258 C14 265 13 277 12 283 C11 289 11 289 12 295 C13 301 14 312 16 319 C18 326 22 334 26 340 C30 346 34 353 39 356 C44 359 49 358 53 359 C57 360 60 361 64 361 C68 361 73 360 76 359 C79 358 81 354 83 352 C85 350 86 350 88 346 C90 342 93 334 96 325 C99 316 103 307 104 295 C105 283 103 267 100 255 C97 243 91 231 86 222 C81 213 74 204 68 200 C62 196 56 193 51 195 Z'
const LEFT_WING_STROKE =
  'M51 195 C49 198 42 205 38 210 C34 215 33 219 30 224 C27 229 23 236 21 242 C19 248 18 251 16 258 C14 265 13 277 12 283 C11 289 11 289 12 295 C13 301 14 312 16 319 C18 326 22 334 26 340 C30 346 34 353 39 356 C44 359 49 358 53 359 C57 360 60 361 64 361 C68 361 73 360 76 359 C79 358 81 354 83 352 C85 350 87 347 88 346'
const BLADE =
  'M112 313 L224 310 C232 310 237 314 237 321 C236 330 229 339 221 346 C206 360 188 372 164 375 C146 376 128 366 112 353 Z'
const HANDLE = 'M95 314 L112 313 L111 350 L88 350 Z'
const SWEAT = 'M330 92 C322 108 318 117 330 124 C342 117 338 108 330 92 Z'

/** The art's viewBox: its width over height is 490 / 500. */
export const DUCK_VIEWBOX = '-10 20 490 500'

interface DuckArtProps {
  ref?: Ref<SVGSVGElement>
  size: number
  /** Accessible name; omit to hide the art from assistive tech. */
  label?: string
}

/**
 * The knife-holding duck as layered SVG, traced from the user's reference
 * image. Each animated layer has a `data-part` that Mascot.tsx drives; the
 * pivots in rig.ts match this geometry.
 */
export function DuckArt({ ref, size, label }: DuckArtProps) {
  const clipId = `duck-blade-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const a11y = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true }

  return (
    <svg ref={ref} viewBox={DUCK_VIEWBOX} width={size} height={(size * 500) / 490} overflow="visible" {...a11y}>
      <defs>
        <clipPath id={clipId}>
          <path d={BLADE} />
        </clipPath>
      </defs>
      <g data-part="whole">
        <g stroke={OUTLINE} strokeWidth={12} strokeLinejoin="round" strokeLinecap="round">
          <path fill={ORANGE} d={FOOT_LEFT} />
          <path fill={ORANGE} d={FOOT_RIGHT} />
          <g data-part="body">
            <path fill={BODY_FILL} d={BODY} />
            <g data-part="right-wing">
              <path fill={BODY_FILL} stroke="none" d={RIGHT_WING_FILL} />
              <path fill="none" d={RIGHT_WING_STROKE} />
              <line x1={398} y1={306} x2={400} y2={319} stroke={ACCENT} strokeWidth={10} />
            </g>
            <g data-part="eyes" stroke="none" fill={OUTLINE}>
              <ellipse data-part="eye-left" cx={155.5} cy={177.4} rx={12.8} ry={12.8} />
              <ellipse data-part="eye-right" cx={314.8} cy={170.6} rx={12.8} ry={12.8} />
            </g>
            <g data-part="happy" fill="none" strokeWidth={10} opacity={0}>
              <path d="M139 184 Q155.5 164 172 184" />
              <path d="M298 177 Q314.8 157 331 177" />
            </g>
            <g data-part="brows" strokeWidth={11} opacity={0}>
              <path data-part="brow-left" d="M128 146 L180 163" />
              <path data-part="brow-right" d="M342 139 L291 157" />
            </g>
            <path data-part="sweat" d={SWEAT} fill={SWEAT_BLUE} strokeWidth={8} opacity={0} />
            <ellipse cx={239} cy={213} rx={64} ry={26} fill={ORANGE} strokeWidth={13} />
            <g data-part="left-wing">
              <path fill={BODY_FILL} stroke="none" d={LEFT_WING_FILL} />
              <path fill="none" d={LEFT_WING_STROKE} />
              <line x1={114} y1={271} x2={98} y2={303} stroke={ACCENT} strokeWidth={9} />
              <g data-part="knife">
                <path fill={BLADE_GREY} strokeWidth={13} d={BLADE} />
                <g clipPath={`url(#${clipId})`} stroke="none">
                  <path
                    data-part="glint"
                    d="M0 290 L22 290 L-8 390 L-30 390 Z"
                    fill="#ffffff"
                    opacity={0.9}
                    transform="translate(20 0)"
                  />
                </g>
                <path fill={HANDLE_PINK} strokeWidth={13} d={HANDLE} />
              </g>
            </g>
          </g>
        </g>
      </g>
    </svg>
  )
}
