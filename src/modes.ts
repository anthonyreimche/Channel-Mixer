// The mixer's editing modes: three parametrizations of the same 3×3 matrix,
// from Ansel's src/iop/channelmixerrgb_shared.c (© Aurélien Pierre,
// GPL-3.0-or-later). They change how the matrix is edited, never how it is
// applied: the photo's edit only ever holds the matrix rows.
//
// Simple works in the orthonormal chroma basis P (two chroma axes and the
// achromatic axis): a rotation, two signed stretches along tilted axes and a
// chroma-to-achromatic coupling, which covers every matrix with normalized
// rows. Primaries places each column's chromaticity by hue and purity inside
// the basis gamut and sets the white the columns add up to. White-preserving
// rotates and saturates each column around the basis white, and solves the
// column magnitudes so the white maps to itself.

import { BASES, D50_IN_BASIS, IDENTITY, type Basis, type Mat3, type Vec3, inv3, normalizedRow } from "./model";

export type MixerMode = "complete" | "simple" | "primaries" | "white-preserving";
export const MIXER_MODES: readonly MixerMode[] = ["complete", "simple", "primaries", "white-preserving"];

export interface Simple {
  theta: number;
  psi: number;
  stretch1: number;
  stretch2: number;
  couplingAmount: number;
  couplingHue: number;
}

export interface Primaries {
  whiteHue: number;
  whitePurity: number;
  redHue: number;
  redPurity: number;
  greenHue: number;
  greenPurity: number;
  blueHue: number;
  bluePurity: number;
  gain: number;
}

export interface WhitePreserving {
  redRotation: number;
  redSaturation: number;
  greenRotation: number;
  greenSaturation: number;
  blueRotation: number;
  blueSaturation: number;
}

/** DT_IOP_CHANNELMIXER_SHARED_SIMPLE_EPS: the round-trip tolerance, and the
 *  smallest affine sum or radius the modes accept. */
export const MODE_EPS = 5e-5;
const TAN_SCALE = 1.55;
/** The smallest chromaticity triangle white-preserving accepts, as a share of
 *  the basis triangle. */
const MIN_FOOTPRINT = 0.02;
const SQRT1_2 = 0.7071067811865475;
const SQRT1_6 = 0.4082482904638631;
const SQRT2_3 = 0.8164965809277261;
const INV_SQRT_3 = 0.5773502691896258;
/** Columns: the two chroma axes and the achromatic axis. */
const P: Mat3 = [SQRT1_2, SQRT1_6, INV_SQRT_3, -SQRT1_2, SQRT1_6, INV_SQRT_3, 0, -SQRT2_3, INV_SQRT_3];

const transpose = (m: Mat3): Mat3 => [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
function mul(a: Mat3, b: Mat3): Mat3 {
  const out: number[] = [];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) out.push(a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j]);
  }
  return out;
}
const apply = (m: Mat3, v: Vec3): Vec3 => [
  m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
  m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
  m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
];
const sum3 = (v: Vec3) => v[0] + v[1] + v[2];
const column = (m: Mat3, c: number): Vec3 => [m[c], m[3 + c], m[6 + c]];

export function wrapPi(angle: number): number {
  let a = angle;
  while (a <= -Math.PI) a += 2 * Math.PI;
  while (a > Math.PI) a -= 2 * Math.PI;
  return a;
}

export function wrapHalfPi(angle: number): number {
  let a = angle;
  while (a <= -Math.PI / 2) a += Math.PI;
  while (a > Math.PI / 2) a -= Math.PI;
  return a;
}

/** The stretch sliders run linear on [-1, 1] and at double speed beyond it, to ±2. */
export function encodeStretch(stretch: number): number {
  if (stretch >= 1) return Math.min(0.5 * (stretch + 1), 1.5);
  if (stretch >= -1) return stretch;
  return Math.max(0.5 * (stretch - 1), -1.5);
}

export function decodeStretch(slider: number): number {
  if (slider >= 1) return 2 * slider - 1;
  if (slider >= -1) return slider;
  return 2 * slider + 1;
}

export function encodeCoupling(amount: number): number {
  return Math.atan(Math.max(amount, 0)) / TAN_SCALE;
}

export function decodeCoupling(slider: number): number {
  return Math.tan(Math.min(Math.max(slider, 0), 0.999) * TAN_SCALE);
}

// ── Simple ───────────────────────────────────────────────────────────────────

export function simpleFromMatrix(M: Mat3): Simple {
  const B = mul(mul(transpose(P), M), P);
  const [a, b, , c, d] = B;
  const theta = wrapPi(Math.atan2(c - b, a + d));
  const ct = Math.cos(theta);
  const st = Math.sin(theta);
  const s00 = ct * a + st * c;
  const s01 = ct * b + st * d;
  const s11 = -st * b + ct * d;
  const diff = s00 - s11;
  const psi = wrapHalfPi(0.5 * Math.atan2(2 * s01, diff));
  const radius = Math.hypot(0.5 * diff, s01);
  const trace = s00 + s11;
  const couplingAmount = Math.hypot(B[6], B[7]);
  return {
    theta,
    psi,
    stretch1: 0.5 * trace + radius,
    stretch2: 0.5 * trace - radius,
    couplingAmount,
    couplingHue: couplingAmount > 0 ? wrapPi(Math.atan2(B[7], B[6])) : 0,
  };
}

export function simpleToMatrix(s: Simple): Mat3 {
  const ct = Math.cos(s.theta);
  const st = Math.sin(s.theta);
  const cp = Math.cos(s.psi);
  const sp = Math.sin(s.psi);
  const s00 = s.stretch1 * cp * cp + s.stretch2 * sp * sp;
  const s01 = (s.stretch1 - s.stretch2) * cp * sp;
  const s11 = s.stretch1 * sp * sp + s.stretch2 * cp * cp;
  const B: Mat3 = [
    ct * s00 - st * s01, ct * s01 - st * s11, 0,
    st * s00 + ct * s01, st * s01 + ct * s11, 0,
    s.couplingAmount * Math.cos(s.couplingHue), s.couplingAmount * Math.sin(s.couplingHue), 1,
  ];
  return mul(mul(P, B), transpose(P));
}

// ── The affine chromaticity plane ────────────────────────────────────────────

/** The white each basis's primaries modes turn around: D50 in that basis. */
export function basisWhite(basis: Basis): Vec3 {
  return D50_IN_BASIS[basis];
}

function affineNormalize(v: Vec3): Vec3 | null {
  const s = sum3(v);
  return Math.abs(s) < MODE_EPS ? null : [v[0] / s, v[1] / s, v[2] / s];
}

type Vec2 = readonly [number, number];

const project = (d: Vec3): Vec2 => [SQRT1_2 * (d[0] - d[1]), SQRT1_6 * (d[0] + d[1]) - SQRT2_3 * d[2]];
const unproject = (uv: Vec2): Vec3 => [SQRT1_2 * uv[0] + SQRT1_6 * uv[1], -SQRT1_2 * uv[0] + SQRT1_6 * uv[1], -SQRT2_3 * uv[1]];
const rotate = (v: Vec2, angle: number): Vec2 => [
  Math.cos(angle) * v[0] - Math.sin(angle) * v[1],
  Math.sin(angle) * v[0] + Math.cos(angle) * v[1],
];
const sub3 = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add3 = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

function rayToSegment(dir: Vec2, first: Vec2, second: Vec2): number {
  const ex = second[0] - first[0];
  const ey = second[1] - first[1];
  const den = dir[0] * ey - dir[1] * ex;
  if (Math.abs(den) < MODE_EPS) return Infinity;
  const t = (first[0] * ey - first[1] * ex) / den;
  const u = (first[0] * dir[1] - first[1] * dir[0]) / den;
  return t >= 0 && u >= 0 && u <= 1 ? t : Infinity;
}

function distanceToEdge(dir: Vec2, refs: readonly Vec2[]): number {
  let best = Infinity;
  for (let i = 0; i < 3; i++) best = Math.min(best, rayToSegment(dir, refs[i], refs[(i + 1) % 3]));
  return best;
}

interface Simplex {
  white: Vec3;
  refs: readonly Vec2[];
}

function simplex(basis: Basis): Simplex | null {
  const white = affineNormalize(basisWhite(basis));
  if (!white) return null;
  const refs = [0, 1, 2].map((i) => project(sub3(column(IDENTITY, i), white)));
  return { white, refs };
}

function pointFromPolar(s: Simplex, index: number, hue: number, purity: number): Vec3 | null {
  const ref = s.refs[index];
  const r = Math.hypot(ref[0], ref[1]);
  if (r < MODE_EPS) return null;
  const dir = rotate([ref[0] / r, ref[1] / r], hue);
  const edge = distanceToEdge(dir, s.refs);
  if (edge === Infinity) return null;
  return add3(s.white, unproject([purity * edge * dir[0], purity * edge * dir[1]]));
}

function polarFromPoint(s: Simplex, index: number, point: Vec3): { hue: number; purity: number } | null {
  const ref = s.refs[index];
  const uv = project(sub3(point, s.white));
  const r = Math.hypot(uv[0], uv[1]);
  if (r < MODE_EPS) return { hue: 0, purity: 0 };
  const dir: Vec2 = [uv[0] / r, uv[1] / r];
  const edge = distanceToEdge(dir, s.refs);
  if (edge === Infinity || edge < MODE_EPS) return null;
  return { hue: wrapPi(Math.atan2(dir[1], dir[0]) - Math.atan2(ref[1], ref[0])), purity: r / edge };
}

/** mat3SSEinv's singularity test. */
function invertible(m: Mat3): Mat3 | null {
  const det = m[0] * (m[8] * m[4] - m[7] * m[5]) - m[3] * (m[8] * m[1] - m[7] * m[2]) + m[6] * (m[5] * m[1] - m[4] * m[2]);
  return Math.abs(det) < 1e-7 ? null : inv3(m);
}

/** The matrix whose columns are `columns` (each a normalized chromaticity)
 *  scaled to `scales`. */
function fromColumns(columns: readonly Vec3[], scales: Vec3): Mat3 {
  return [0, 1, 2].flatMap((row) => [0, 1, 2].map((col) => scales[col] * columns[col][row]));
}

const chromaticityMatrix = (columns: readonly Vec3[]): Mat3 => fromColumns(columns, [1, 1, 1]);

// ── Primaries ────────────────────────────────────────────────────────────────

export function primariesToMatrix(basis: Basis, p: Primaries): Mat3 | null {
  const whiteRef = basisWhite(basis);
  const whiteSum = sum3(whiteRef);
  if (Math.abs(whiteSum) < MODE_EPS) return null;
  const s = simplex(basis);
  if (!s) return null;
  const white = pointFromPolar(s, 0, p.whiteHue, p.whitePurity);
  const cols = [
    pointFromPolar(s, 0, p.redHue, p.redPurity),
    pointFromPolar(s, 1, p.greenHue, p.greenPurity),
    pointFromPolar(s, 2, p.blueHue, p.bluePurity),
  ];
  if (!white || cols.some((c) => !c)) return null;
  const columns = cols as Vec3[];
  const inverse = invertible(chromaticityMatrix(columns));
  if (!inverse) return null;
  const gain = p.gain * whiteSum;
  return fromColumns(columns, apply(inverse, [gain * white[0], gain * white[1], gain * white[2]]));
}

export function primariesFromMatrix(basis: Basis, M: Mat3): Primaries | null {
  if (!invertible(M)) return null;
  const whiteSum = sum3(basisWhite(basis));
  if (Math.abs(whiteSum) < MODE_EPS) return null;
  const s = simplex(basis);
  if (!s) return null;
  const customWhite: Vec3 = [M[0] + M[1] + M[2], M[3] + M[4] + M[5], M[6] + M[7] + M[8]];
  const whiteNorm = affineNormalize(customWhite);
  if (!whiteNorm) return null;
  const w = polarFromPoint(s, 0, whiteNorm);
  if (!w) return null;
  const polar = [0, 1, 2].map((i) => {
    const c = affineNormalize(column(M, i));
    return c ? polarFromPoint(s, i, c) : null;
  });
  if (polar.some((v) => !v)) return null;
  const [r, g, b] = polar as { hue: number; purity: number }[];
  return {
    whiteHue: w.hue,
    whitePurity: w.purity,
    redHue: r.hue,
    redPurity: r.purity,
    greenHue: g.hue,
    greenPurity: g.purity,
    blueHue: b.hue,
    bluePurity: b.purity,
    gain: sum3(customWhite) / whiteSum,
  };
}

// ── White-preserving ─────────────────────────────────────────────────────────

const triangleArea = (v: readonly Vec2[]) =>
  (v[1][0] - v[0][0]) * (v[2][1] - v[0][1]) - (v[1][1] - v[0][1]) * (v[2][0] - v[0][0]);

const rotations = (w: WhitePreserving) => [w.redRotation, w.greenRotation, w.blueRotation];
const saturations = (w: WhitePreserving) => [w.redSaturation, w.greenSaturation, w.blueSaturation];

export function whitePreservingToMatrix(basis: Basis, w: WhitePreserving): Mat3 | null {
  const whiteRef = basisWhite(basis);
  const s = simplex(basis);
  if (!s) return null;
  const columns: Vec3[] = [];
  const footprint: Vec2[] = [];
  for (let i = 0; i < 3; i++) {
    const ref = s.refs[i];
    if (Math.hypot(ref[0], ref[1]) < MODE_EPS) return null;
    const scale = 1 + saturations(w)[i];
    const r = rotate(ref, rotations(w)[i]);
    const point = add3(s.white, unproject([scale * r[0], scale * r[1]]));
    columns.push(point);
    footprint.push(project(sub3(point, s.white)));
  }
  if (Math.abs(triangleArea(footprint)) < MIN_FOOTPRINT * Math.abs(triangleArea(s.refs))) return null;
  const inverse = invertible(chromaticityMatrix(columns));
  if (!inverse) return null;
  const weights = apply(inverse, whiteRef);
  if (whiteRef.some((v) => Math.abs(v) < MODE_EPS)) return null;
  return fromColumns(columns, [weights[0] / whiteRef[0], weights[1] / whiteRef[1], weights[2] / whiteRef[2]]);
}

export function whitePreservingFromMatrix(basis: Basis, M: Mat3): WhitePreserving | null {
  const s = simplex(basis);
  if (!s) return null;
  const read: { rotation: number; saturation: number }[] = [];
  for (let i = 0; i < 3; i++) {
    const c = affineNormalize(column(M, i));
    if (!c) return null;
    const ref = s.refs[i];
    const refRadius = Math.hypot(ref[0], ref[1]);
    if (refRadius < MODE_EPS) return null;
    const uv = project(sub3(c, s.white));
    const r = Math.hypot(uv[0], uv[1]);
    read.push(
      r < MODE_EPS
        ? { rotation: 0, saturation: -1 }
        : { rotation: wrapPi(Math.atan2(uv[1], uv[0]) - Math.atan2(ref[1], ref[0])), saturation: r / refRadius - 1 },
    );
  }
  return {
    redRotation: read[0].rotation,
    redSaturation: read[0].saturation,
    greenRotation: read[1].rotation,
    greenSaturation: read[1].saturation,
    blueRotation: read[2].rotation,
    blueSaturation: read[2].saturation,
  };
}

// ── Reading a mode from the edit ─────────────────────────────────────────────

export interface MixerRows {
  red: readonly number[];
  green: readonly number[];
  blue: readonly number[];
  normalize: readonly boolean[];
}

const roundtripError = (a: Mat3, b: Mat3) => Math.max(...a.map((v, i) => Math.abs(v - b[i])));
const relativeError = (a: Mat3, b: Mat3) => roundtripError(a, b) / Math.max(1, ...a.map(Math.abs));

export type ModeReading =
  | { mode: "complete"; ok: true; matrix: Mat3 }
  | { mode: "simple"; ok: boolean; matrix: Mat3; values: Simple }
  | { mode: "primaries"; ok: boolean; matrix: Mat3; values: Primaries }
  | { mode: "white-preserving"; ok: boolean; matrix: Mat3; values: WhitePreserving };

/** The mixer as the given mode shows it, from the edit's rows and their
 *  normalize flags. `ok` is false when the mode can't represent the matrix,
 *  as Ansel's mode switch refuses it: Simple needs every row normalized, and
 *  each mode must rebuild the matrix it read to within MODE_EPS (relative for
 *  white-preserving, whose column scales can grow large). */
export function readMode(mode: MixerMode, rows: MixerRows, basis: Basis): ModeReading {
  const row = (r: readonly number[]): Vec3 => [r[0], r[1], r[2]];
  const raw = [row(rows.red), row(rows.green), row(rows.blue)];
  const hasZeroSum = raw.some((r, i) => rows.normalize[i] && sum3(r) === 0);
  const matrix: Mat3 = raw.flatMap((r, i) => normalizedRow(r, rows.normalize[i]));
  if (mode === "complete") return { mode, ok: true, matrix };
  if (mode === "simple") {
    const values = simpleFromMatrix(matrix);
    const ok = rows.normalize.every(Boolean) && !hasZeroSum && roundtripError(matrix, simpleToMatrix(values)) <= MODE_EPS;
    return { mode, ok, matrix, values };
  }
  if (mode === "primaries") {
    const values = primariesFromMatrix(basis, matrix);
    const back = values && primariesToMatrix(basis, values);
    const ok = !hasZeroSum && !!back && roundtripError(matrix, back) <= MODE_EPS;
    return { mode, ok, matrix, values: values ?? IDENTITY_PRIMARIES };
  }
  const values = whitePreservingFromMatrix(basis, matrix);
  const back = values && whitePreservingToMatrix(basis, values);
  const ok = !hasZeroSum && !!back && relativeError(matrix, back) <= MODE_EPS;
  return { mode, ok, matrix, values: values ?? IDENTITY_WHITE_PRESERVING };
}

export const IDENTITY_SIMPLE: Simple = { theta: 0, psi: 0, stretch1: 1, stretch2: 1, couplingAmount: 0, couplingHue: 0 };
export const IDENTITY_PRIMARIES: Primaries = {
  whiteHue: 0,
  whitePurity: 0,
  redHue: 0,
  redPurity: 1,
  greenHue: 0,
  greenPurity: 1,
  blueHue: 0,
  bluePurity: 1,
  gain: 1,
};
export const IDENTITY_WHITE_PRESERVING: WhitePreserving = {
  redRotation: 0,
  redSaturation: 0,
  greenRotation: 0,
  greenSaturation: 0,
  blueRotation: 0,
  blueSaturation: 0,
};

export { BASES };
