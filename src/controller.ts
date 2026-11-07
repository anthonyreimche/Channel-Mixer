// What the panel's mode controls do to the edit, as Ansel's channelmixerrgb.c
// mode callbacks do it: entering a mode that can't represent the matrix is
// refused; entering Primaries or White-preserving writes the effective matrix
// into the rows and turns their normalization off, since those modes describe
// the matrix as applied; a reduced-mode slider rebuilds the matrix from all of
// the mode's values. Simple keeps the rows normalized: its matrices already
// sum to 1 per row.

import { asBasis, effectiveMatrix, type Mat3, type Params, type Vec3 } from "./model";
import {
  primariesToMatrix,
  readMode,
  simpleToMatrix,
  whitePreservingToMatrix,
  type MixerMode,
  type MixerRows,
} from "./modes";
import type { Held, ModeValues } from "./store";

/** Two matrices the same to well within the modes' own round-trip tolerance. */
const MATCH_EPS = 1e-6;
const sameMatrix = (a: Mat3, b: Mat3) => a.every((v, i) => Math.abs(v - b[i]) <= MATCH_EPS);

export const NOTICES: Record<Exclude<MixerMode, "complete">, string> = {
  simple: "Simple needs all three output rows normalized, with sums other than zero.",
  primaries: "Primaries needs a mixer that can be inverted, with columns that don't sum to zero.",
  "white-preserving": "White-preserving needs a mixer that leaves the white of the mixing space where it is.",
};

export const DEGENERATE_NOTICE = "That setting collapses the primaries; the mixer keeps its last values.";

const rowsOf = (p: Params): MixerRows => ({
  red: p.red,
  green: p.green,
  blue: p.blue,
  normalize: [p.normalizeRed, p.normalizeGreen, p.normalizeBlue],
});

const rowPatch = (m: Mat3): Pick<Params, "red" | "green" | "blue"> => ({
  red: [m[0], m[1], m[2]] as Vec3,
  green: [m[3], m[4], m[5]] as Vec3,
  blue: [m[6], m[7], m[8]] as Vec3,
});

const NORMALIZE_OFF = { normalizeRed: false, normalizeGreen: false, normalizeBlue: false } as const;

function holdFrom(p: Params, mode: Exclude<MixerMode, "complete">): { held: Held | null; ok: boolean } {
  const basis = asBasis(p.basis);
  const read = readMode(mode, rowsOf(p), basis);
  if (read.mode === "complete" || !read.ok) return { held: null, ok: false };
  const values = { mode: read.mode, values: read.values } as ModeValues;
  return { held: { values, matrix: read.matrix, basis }, ok: true };
}

/** The values the mode's sliders show for this edit: the held ones while they
 *  still make the edit's matrix in its basis, else read from the matrix.
 *  Null when the mode can't show the matrix (say, after an undo). */
export function shownValues(p: Params, mode: MixerMode, held: Held | null): Held | null {
  if (mode === "complete") return null;
  const basis = asBasis(p.basis);
  if (held && held.values.mode === mode && held.basis === basis && sameMatrix(held.matrix, effectiveMatrix(p))) {
    return held;
  }
  return holdFrom(p, mode).held;
}

export type SwitchResult =
  | { ok: true; held: Held | null; patch: Partial<Params> | null }
  | { ok: false; notice: string };

export function switchMode(p: Params, mode: MixerMode): SwitchResult {
  if (mode === "complete") return { ok: true, held: null, patch: null };
  const { held, ok } = holdFrom(p, mode);
  if (!ok || !held) return { ok: false, notice: NOTICES[mode] };
  if (mode === "simple") return { ok: true, held, patch: null };
  const changed =
    p.normalizeRed || p.normalizeGreen || p.normalizeBlue || !sameRows(p, held.matrix);
  return { ok: true, held, patch: changed ? { ...NORMALIZE_OFF, ...rowPatch(held.matrix) } : null };
}

const sameRows = (p: Params, m: Mat3) => [...p.red, ...p.green, ...p.blue].every((v, i) => v === m[i]);

export type EditResult = { ok: true; held: Held; patch: Partial<Params> } | { ok: false; notice: string };

/** One mode slider moved to `value`, the mode's other values as held. */
export function editMode(p: Params, held: Held, field: string, value: number): EditResult {
  const basis = asBasis(p.basis);
  const v = held.values;
  let matrix: Mat3 | null;
  let values: ModeValues;
  if (v.mode === "simple") {
    values = { mode: "simple", values: { ...v.values, [field]: value } };
    matrix = simpleToMatrix(values.values);
  } else if (v.mode === "primaries") {
    values = { mode: "primaries", values: { ...v.values, [field]: value } };
    matrix = primariesToMatrix(basis, values.values);
  } else {
    values = { mode: "white-preserving", values: { ...v.values, [field]: value } };
    matrix = whitePreservingToMatrix(basis, values.values);
  }
  if (!matrix) return { ok: false, notice: DEGENERATE_NOTICE };
  const patch = v.mode === "simple" ? rowPatch(matrix) : { ...NORMALIZE_OFF, ...rowPatch(matrix) };
  // The held matrix is what the edit will apply: Simple's rows stay
  // normalized, which leaves them unchanged to within a rounding.
  const applied = effectiveMatrix({ ...p, ...patch });
  return { ok: true, held: { values, matrix: applied, basis }, patch };
}
