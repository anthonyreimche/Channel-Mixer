// The param-bag contract: Ansel's mixer params under the stage's qualified
// keys. They are the GPU uniforms as they are (rows, normalize flags), and the
// shader does commit_params()'s arithmetic, so a preset that carries only some
// of them still renders as the rest's defaults would. Values of the wrong type
// read as the defaults.

import { DEFAULT_PARAMS, type Params, type Vec3 } from "./model";

export const EXT_ID = "channel-mixer";
export const STAGE_ID = `${EXT_ID}.mix`;

export type ParamKey = keyof Params;

export const VEC3_KEYS = ["red", "green", "blue", "colourfulness", "brightness", "grey"] as const;
export const BOOL_KEYS = [
  "normalizeRed",
  "normalizeGreen",
  "normalizeBlue",
  "normalizeColourfulness",
  "normalizeBrightness",
  "normalizeGrey",
  "clip",
] as const;
export const NUMBER_KEYS = ["basis", "gamut"] as const;

export const PARAM_KEYS: readonly ParamKey[] = [...VEC3_KEYS, ...BOOL_KEYS, ...NUMBER_KEYS];

export const qualified = (key: ParamKey): string => `${STAGE_ID}.${key}`;

type BagValue = number | boolean | number[];

export function bagPatch(p: Params): Record<string, BagValue> {
  const out: Record<string, BagValue> = {};
  for (const key of VEC3_KEYS) out[qualified(key)] = [...p[key]];
  for (const key of BOOL_KEYS) out[qualified(key)] = p[key];
  for (const key of NUMBER_KEYS) out[qualified(key)] = p[key];
  return out;
}

function readVec3(v: unknown): Vec3 | null {
  return Array.isArray(v) && v.length === 3 && v.every((x) => typeof x === "number" && Number.isFinite(x))
    ? [v[0], v[1], v[2]]
    : null;
}

/** `bag` is the host's untyped per-photo bag (any extension writes to it). */
export function readParams(bag: Readonly<Record<string, unknown>>): Params {
  const out: { -readonly [K in ParamKey]: Params[K] } = { ...DEFAULT_PARAMS };
  for (const key of VEC3_KEYS) out[key] = readVec3(bag[qualified(key)]) ?? DEFAULT_PARAMS[key];
  for (const key of BOOL_KEYS) {
    const v = bag[qualified(key)];
    if (typeof v === "boolean") out[key] = v;
  }
  for (const key of NUMBER_KEYS) {
    const v = bag[qualified(key)];
    if (typeof v === "number" && Number.isFinite(v)) out[key] = v;
  }
  return out;
}

export const resetPatch = (): Record<string, BagValue> => bagPatch(DEFAULT_PARAMS);
