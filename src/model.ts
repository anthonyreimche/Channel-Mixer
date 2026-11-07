// The CPU reference of the Channel Mixer stage: the channel-mixing half of
// Ansel's colour calibration (src/iop/channelmixerrgb.c, © Aurélien Pierre and
// the darktable developers, GPL-3.0-or-later): commit_params(), loop_switch(),
// gamut_mapping() and luma_chroma() at saturation version 3, with the
// illuminant fixed to the pipeline's D50, since White Balance is core's.
// The LMS matrices are pixel/chromatic_adaptation.h's. Every constant is
// exported so the GLSL in stage.ts is formatted from these numbers.
//
// Ansel mixes in its working RGB, linear Rec.2020, or in XYZ D50 or an LMS
// space reached from it. The stage receives Safelight's linear Rec.709 and
// converts to and from Rec.2020 itself, inside its branch, so an idle stage
// costs no conversion and changes no bit.

export type Vec3 = readonly [number, number, number];
/** Row-major 3×3. */
export type Mat3 = readonly number[];

export function apply3(m: Mat3, v: Vec3): Vec3 {
  return [
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
    m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
    m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
  ];
}

export function mul3(a: Mat3, b: Mat3): Mat3 {
  const out: number[] = [];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) out.push(a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j]);
  }
  return out;
}

export function inv3(m: Mat3): Mat3 {
  const [a, b, c, d, e, f, g, h, i] = m;
  const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
  return [
    (e * i - f * h) / det, (c * h - b * i) / det, (b * f - c * e) / det,
    (f * g - d * i) / det, (a * i - c * g) / det, (c * d - a * f) / det,
    (d * h - e * g) / det, (b * g - a * h) / det, (a * e - b * d) / det,
  ];
}

export const IDENTITY: Mat3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];

// ── Colour spaces ────────────────────────────────────────────────────────────

const BRADFORD_CAT: Mat3 = [0.8951, 0.2664, -0.1614, -0.7502, 1.7135, 0.0367, 0.0389, -0.0685, 1.0296];
/** lcms's cmsD50_XYZ. */
const LCMS_D50: Vec3 = [0.9642, 1.0, 0.8249];
/** Ansel's D65 xy. */
const D65_XY: readonly [number, number] = [0.312700492, 0.329000939];

/** The RGB → XYZ D50 matrix lcms writes into a profile built from xy
 *  primaries and a white, the way Ansel builds its linear Rec.709 and Rec.2020
 *  profiles: the primaries scaled to the white, then Bradford-adapted to D50. */
function lcmsRgbToXyzD50(primaries: readonly (readonly [number, number])[]): Mat3 {
  const [[xr, yr], [xg, yg], [xb, yb]] = primaries;
  const prim: Mat3 = [xr / yr, xg / yg, xb / yb, 1, 1, 1, (1 - xr - yr) / yr, (1 - xg - yg) / yg, (1 - xb - yb) / yb];
  const W: Vec3 = [D65_XY[0] / D65_XY[1], 1, (1 - D65_XY[0] - D65_XY[1]) / D65_XY[1]];
  const S = apply3(inv3(prim), W);
  const rgbToXyz: Mat3 = prim.map((v, i) => v * S[i % 3]);
  const src = apply3(BRADFORD_CAT, W);
  const dst = apply3(BRADFORD_CAT, LCMS_D50);
  const scaled: Mat3 = BRADFORD_CAT.map((v, i) => (dst[Math.floor(i / 3)] / src[Math.floor(i / 3)]) * v);
  return mul3(mul3(inv3(BRADFORD_CAT), scaled), rgbToXyz);
}

export const REC709_TO_XYZ_D50 = lcmsRgbToXyzD50([[0.64, 0.33], [0.3, 0.6], [0.15, 0.06]]);
export const REC2020_TO_XYZ_D50 = lcmsRgbToXyzD50([[0.708, 0.292], [0.17, 0.797], [0.131, 0.046]]);
export const XYZ_D50_TO_REC2020 = inv3(REC2020_TO_XYZ_D50);
/** Safelight's linear Rec.709 to Ansel's working Rec.2020, through XYZ D50 as
 *  Ansel's input profile hands it over. */
export const REC709_TO_REC2020 = mul3(XYZ_D50_TO_REC2020, REC709_TO_XYZ_D50);
export const REC2020_TO_REC709 = inv3(REC709_TO_REC2020);

/** chromatic_adaptation.h. The Bradford pair is rounded to four digits there
 *  and is not an exact inverse; Ansel uses it as it is, and so does the port. */
export const XYZ_TO_BRADFORD: Mat3 = [0.8951, 0.2664, -0.1614, -0.7502, 1.7135, 0.0367, 0.0389, -0.0685, 1.0296];
export const BRADFORD_TO_XYZ: Mat3 = [0.987, -0.1471, 0.16, 0.4323, 0.5184, 0.0493, -0.0085, 0.04, 0.9685];
export const XYZ_TO_CAT16: Mat3 = [
  0.401288, 0.650173, -0.051461,
  -0.250268, 1.204414, 0.045854,
  -0.002079, 0.048952, 0.953127,
];
export const CAT16_TO_XYZ: Mat3 = [
  1.862068, -1.011255, 0.149187,
  0.38752, 0.621447, -0.008974,
  -0.015841, -0.034123, 1.049964,
];

// ── Bases ────────────────────────────────────────────────────────────────────

/** The space the mixer works in (Ansel's "adaptation", less the non-linear
 *  Bradford, which only differs from the linear one under another illuminant).
 *  Stored as an int. */
export const BASES = { rgb: 0, xyz: 1, bradford: 2, cat16: 3 } as const;
export type Basis = (typeof BASES)[keyof typeof BASES];

export function asBasis(v: number): Basis {
  return v === BASES.xyz || v === BASES.bradford || v === BASES.cat16 ? v : BASES.rgb;
}

/** convert_D50_to_LMS(): the D50 white in each basis. */
export const D50_IN_BASIS: Record<Basis, Vec3> = {
  [BASES.rgb]: [1, 1, 1],
  [BASES.xyz]: [0.9642119944211994, 1.0, 0.8251882845188288],
  [BASES.bradford]: [0.996078, 1.020646, 0.818155],
  [BASES.cat16]: [0.994535, 1.000997, 0.833036],
};

/** The pipeline illuminant (illuminants.h, DT_ILLUMINANT_PIPE) in XYZ. */
const PIPE_ILLUMINANT: Vec3 = (() => {
  const x = 0.34567;
  const y = 0.3585;
  return [x / y, 1, (1 - x - y) / y];
})();

/** The per-channel factor of the D50 adaptation in each basis: the constant
 *  D50 over the pipeline illuminant computed from its xy, which differ in the
 *  fourth digit. CAT16 (full), linear Bradford and XYZ all scale by it. */
export const ADAPTATION: Record<Basis, Vec3> = (() => {
  const ratio = (white: Vec3, illum: Vec3): Vec3 => [white[0] / illum[0], white[1] / illum[1], white[2] / illum[2]];
  return {
    [BASES.rgb]: [1, 1, 1],
    [BASES.xyz]: ratio(D50_IN_BASIS[BASES.xyz], PIPE_ILLUMINANT),
    [BASES.bradford]: ratio(D50_IN_BASIS[BASES.bradford], apply3(XYZ_TO_BRADFORD, PIPE_ILLUMINANT)),
    [BASES.cat16]: ratio(D50_IN_BASIS[BASES.cat16], apply3(XYZ_TO_CAT16, PIPE_ILLUMINANT)),
  };
})();

const TO_LMS: Record<Basis, Mat3> = {
  [BASES.rgb]: IDENTITY,
  [BASES.xyz]: IDENTITY,
  [BASES.bradford]: XYZ_TO_BRADFORD,
  [BASES.cat16]: XYZ_TO_CAT16,
};
const FROM_LMS: Record<Basis, Mat3> = {
  [BASES.rgb]: IDENTITY,
  [BASES.xyz]: IDENTITY,
  [BASES.bradford]: BRADFORD_TO_XYZ,
  [BASES.cat16]: CAT16_TO_XYZ,
};

// ── Params ───────────────────────────────────────────────────────────────────

export interface Params {
  /** Output rows: the input R, G, B weights of each output channel. */
  red: Vec3;
  green: Vec3;
  blue: Vec3;
  normalizeRed: boolean;
  normalizeGreen: boolean;
  normalizeBlue: boolean;
  /** Ansel's "saturation" row, shown as colourfulness. */
  colourfulness: Vec3;
  normalizeColourfulness: boolean;
  /** Ansel's "lightness" row, shown as brightness. */
  brightness: Vec3;
  normalizeBrightness: boolean;
  /** The B&W row: any non-zero weight turns the output monochrome. */
  grey: Vec3;
  normalizeGrey: boolean;
  basis: number;
  /** Gamut compression, 0 (off) to 12. */
  gamut: number;
  /** Clip negative RGB from the gamut. */
  clip: boolean;
}

/** Ansel's defaults, except gamut compression and clipping, which are off:
 *  Ansel applies them once the module is switched on, and a Safelight stage
 *  has no switch, so the first slider nudge would also compress the gamut.
 *  Ansel's own "basic channel mixer" preset has them off too. */
export const DEFAULT_PARAMS: Params = {
  red: [1, 0, 0],
  green: [0, 1, 0],
  blue: [0, 0, 1],
  normalizeRed: true,
  normalizeGreen: true,
  normalizeBlue: true,
  colourfulness: [0, 0, 0],
  normalizeColourfulness: false,
  brightness: [0, 0, 0],
  normalizeBrightness: false,
  grey: [0, 0, 0],
  normalizeGrey: true,
  basis: BASES.rgb,
  gamut: 0,
  clip: false,
};

const sum3 = (v: Vec3) => v[0] + v[1] + v[2];

/** A row divided by its sum when normalized. A row summing to zero has no
 *  normalization; Ansel would divide by zero there. */
export function normalizedRow(row: Vec3, normalize: boolean): Vec3 {
  const s = sum3(row);
  return normalize && s !== 0 ? [row[0] / s, row[1] / s, row[2] / s] : row;
}

/** The mixer matrix commit_params() hands the pixel loop. */
export function effectiveMatrix(p: Params): Mat3 {
  return [
    ...normalizedRow(p.red, p.normalizeRed),
    ...normalizedRow(p.green, p.normalizeGreen),
    ...normalizedRow(p.blue, p.normalizeBlue),
  ];
}

export interface Derived {
  mix: Mat3;
  saturation: Vec3;
  lightness: Vec3;
  grey: Vec3;
  applyGrey: boolean;
  compression: number;
}

/** commit_params(): the coefficients the pixel loop reads. */
export function derive(p: Params): Derived {
  const normSat = p.normalizeColourfulness ? sum3(p.colourfulness) / 3 : 0;
  const normLight = p.normalizeBrightness ? sum3(p.brightness) / 3 : 0;
  const greySum = sum3(p.grey);
  const normGrey = !p.normalizeGrey || greySum === 0 ? 1 : greySum;
  return {
    mix: effectiveMatrix(p),
    saturation: p.colourfulness.map((v) => -v + normSat) as unknown as Vec3,
    lightness: p.brightness.map((v) => v - normLight) as unknown as Vec3,
    grey: p.grey.map((v) => v / normGrey) as unknown as Vec3,
    applyGrey: p.grey.some((v) => v !== 0),
    compression: p.gamut === 0 ? 0 : 1 / p.gamut,
  };
}

/** The stage's gate: every setting that leaves Ansel's loop a no-op. */
export function isIdle(p: Params): boolean {
  const d = derive(p);
  return (
    d.mix.every((v, i) => v === IDENTITY[i]) &&
    d.saturation.every((v) => v === 0) &&
    d.lightness.every((v) => v === 0) &&
    !d.applyGrey &&
    d.compression === 0 &&
    !p.clip
  );
}

// ── Pixel path ───────────────────────────────────────────────────────────────

/** NORM_MIN (math.h): 2^-16. */
export const NORM_MIN = 1.52587890625e-5;
export const INVERSE_SQRT_3 = 0.5773502691896258;
/** D50 in CIE 1976 u'v', as gamut_mapping() hard-codes it. */
export const D50_UV: readonly [number, number] = [0.20915914598542354, 0.488075320769787];

const max0 = (v: Vec3): Vec3 => [Math.max(v[0], 0), Math.max(v[1], 0), Math.max(v[2], 0)];
const mulVec = (a: Vec3, b: Vec3): Vec3 => [a[0] * b[0], a[1] * b[1], a[2] * b[2]];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const euclideanNorm = (v: Vec3) => Math.max(Math.sqrt(dot(v, v)), NORM_MIN);

/** gamut_mapping(): pull the chromaticity toward D50 by Y·Δuv² ^ compression,
 *  never past it, and rebuild XYZ from xyY. A pixel without positive Y or
 *  channel sum comes out black. */
export function gamutMapping(input: Vec3, compression: number, clip: boolean): Vec3 {
  const sum = input[0] + input[1] + input[2];
  const Y = input[1];
  if (!(sum > 0 && Y > 0)) return [0, 0, 0];
  let x = input[0] / sum;
  let y = input[1] / sum;
  const uvDen = -2 * x + 12 * y + 3;
  let u = (4 * x) / uvDen;
  let v = (9 * y) / uvDen;
  const du = D50_UV[0] - u;
  const dv = D50_UV[1] - v;
  const delta = Y * (du * du + dv * dv);
  const correction = compression === 0 ? 0 : Math.pow(delta, compression);
  const tu = correction * du + u;
  const tv = correction * dv + v;
  u = u > D50_UV[0] ? Math.max(tu, D50_UV[0]) : Math.min(tu, D50_UV[0]);
  v = v > D50_UV[1] ? Math.max(tv, D50_UV[1]) : Math.min(tv, D50_UV[1]);
  const xyDen = 6 * u - 16 * v + 12;
  x = (9 * u) / xyDen;
  y = (4 * v) / xyDen;
  if (clip) {
    x = Math.max(x, 0);
    y = Math.max(y, 0);
  }
  y = Math.max(y, NORM_MIN);
  const scale = x + y;
  if (scale >= 1) {
    x /= scale;
    y /= scale;
  }
  return [(Y * x) / y, Y, (Y * (1 - x - y)) / y];
}

/** luma_chroma() at version 3: colourfulness moves the channel ratios toward
 *  or away from grey, brightness scales the pixel by 1 + (pixel · row) / mean. */
export function lumaChroma(input: Vec3, saturation: Vec3, lightness: Vec3): Vec3 {
  let norm = euclideanNorm(input);
  const avg = Math.max((input[0] + input[1] + input[2]) / 3, NORM_MIN);
  const mix = dot(input, lightness);
  norm *= INVERSE_SQRT_3;
  const ratios: Vec3 = [input[0] / norm, input[1] / norm, input[2] / norm];
  const coeff = dot(ratios, saturation) / 3;
  const out = ratios.map((r) => Math.max((1 - r) * coeff + r, r < 0 ? r : 0)) as unknown as Vec3;
  norm /= euclideanNorm(out) * INVERSE_SQRT_3;
  norm *= Math.max(1 + mix / avg, 0);
  return [out[0] * norm, out[1] * norm, out[2] * norm];
}

/** loop_switch() on one pixel of Ansel's working RGB (linear Rec.2020). */
export function mixWorking(rgb: Vec3, p: Params): Vec3 {
  const d = derive(p);
  const basis = asBasis(p.basis);
  const start = p.clip ? max0(rgb) : rgb;
  let xyz: Vec3;
  if (basis === BASES.rgb) {
    xyz = apply3(REC2020_TO_XYZ_D50, apply3(d.mix, start));
  } else {
    const lms = mulVec(apply3(TO_LMS[basis], apply3(REC2020_TO_XYZ_D50, start)), ADAPTATION[basis]);
    xyz = apply3(FROM_LMS[basis], apply3(d.mix, lms));
  }
  const mapped = gamutMapping(xyz, d.compression, p.clip);
  let lms = basis === BASES.rgb ? apply3(XYZ_D50_TO_REC2020, mapped) : apply3(TO_LMS[basis], mapped);
  if (p.clip) lms = max0(lms);
  let adjusted = lumaChroma(lms, d.saturation, d.lightness);
  if (p.clip) adjusted = max0(adjusted);
  if (d.applyGrey) {
    const g = Math.max(dot(adjusted, d.grey), 0);
    return [g, g, g];
  }
  let back = basis === BASES.rgb ? apply3(REC2020_TO_XYZ_D50, adjusted) : apply3(FROM_LMS[basis], adjusted);
  if (p.clip) back = max0(back);
  const out = apply3(XYZ_D50_TO_REC2020, back);
  return p.clip ? max0(out) : out;
}

/** The stage on one Safelight pixel (linear Rec.709). */
export function mixPixel(rgb: Vec3, p: Params): Vec3 {
  if (isIdle(p)) return rgb;
  return apply3(REC2020_TO_REC709, mixWorking(apply3(REC709_TO_REC2020, rgb), p));
}
