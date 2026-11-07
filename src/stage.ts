// The GPU side: model.ts's mixPixel as one inline fragment in the
// scene-linear phase, early (priority 20), where Ansel's colour calibration
// sits in its pipe: before the tone and colour tools. There is no prepass.
//
// The stage takes Safelight's linear Rec.709 `lin` as it is and converts to
// Ansel's working Rec.2020 inside its branch. The branch runs only when the
// mixer does something (the same test as isIdle), so an untouched photo
// renders bit for bit as without the extension. commit_params()'s arithmetic
// (row normalization, the outputs' offsets, the compression exponent) runs on
// uniforms, which the driver hoists. Every constant is formatted from the
// model's numbers, so the shader and the CPU reference cannot drift.

import {
  ADAPTATION,
  BASES,
  BRADFORD_TO_XYZ,
  CAT16_TO_XYZ,
  D50_UV,
  DEFAULT_PARAMS,
  INVERSE_SQRT_3,
  NORM_MIN,
  REC2020_TO_REC709,
  REC2020_TO_XYZ_D50,
  REC709_TO_REC2020,
  XYZ_D50_TO_REC2020,
  XYZ_TO_BRADFORD,
  XYZ_TO_CAT16,
  type Mat3,
  type Vec3,
} from "./model";
import { STAGE_ID } from "./params";
import type { ProcessingStageContribution, UniformDeclaration } from "./safelight";

/** A GLSL float literal at full single precision, always with a decimal point
 *  (GLSL ES never promotes an integer literal to float). */
export function glslLiteral(v: number): string {
  const s = v.toPrecision(10);
  return s.includes("e") || s.includes(".") ? s : `${s}.0`;
}

/** A row-major 3×3 as a GLSL mat3 constructor (column-major arguments). */
function glslMat3(rowMajor: Mat3): string {
  const cols = [0, 3, 6, 1, 4, 7, 2, 5, 8].map((i) => glslLiteral(rowMajor[i]));
  return `mat3(${cols.join(", ")})`;
}

const glslVec3 = (v: Vec3) => `vec3(${v.map(glslLiteral).join(", ")})`;

// Names stay clear of the uniform keys (red, grey, clip, basis, …), which the
// host rewrites at identifier boundaries.
const HELPERS = `
const float CM_NORM_MIN = ${glslLiteral(NORM_MIN)};
const float CM_INV_SQRT_3 = ${glslLiteral(INVERSE_SQRT_3)};
const vec2 CM_D50_UV = vec2(${glslLiteral(D50_UV[0])}, ${glslLiteral(D50_UV[1])});
const mat3 CM_TO_2020 = ${glslMat3(REC709_TO_REC2020)};
const mat3 CM_TO_709 = ${glslMat3(REC2020_TO_REC709)};
const mat3 CM_2020_TO_XYZ = ${glslMat3(REC2020_TO_XYZ_D50)};
const mat3 CM_XYZ_TO_2020 = ${glslMat3(XYZ_D50_TO_REC2020)};
const mat3 CM_XYZ_TO_BRADFORD = ${glslMat3(XYZ_TO_BRADFORD)};
const mat3 CM_BRADFORD_TO_XYZ = ${glslMat3(BRADFORD_TO_XYZ)};
const mat3 CM_XYZ_TO_CAT16 = ${glslMat3(XYZ_TO_CAT16)};
const mat3 CM_CAT16_TO_XYZ = ${glslMat3(CAT16_TO_XYZ)};

vec3 cmRow(vec3 row, bool normalized) {
  float s = row.x + row.y + row.z;
  return (normalized && s != 0.0) ? row / s : row;
}
float cmNorm(vec3 v) {
  return max(sqrt(dot(v, v)), CM_NORM_MIN);
}
vec3 cmToLms(vec3 xyz, int space) {
  if (space == ${BASES.bradford}) return CM_XYZ_TO_BRADFORD * xyz;
  if (space == ${BASES.cat16}) return CM_XYZ_TO_CAT16 * xyz;
  return xyz;
}
vec3 cmFromLms(vec3 lms, int space) {
  if (space == ${BASES.bradford}) return CM_BRADFORD_TO_XYZ * lms;
  if (space == ${BASES.cat16}) return CM_CAT16_TO_XYZ * lms;
  return lms;
}
vec3 cmAdaptation(int space) {
  if (space == ${BASES.xyz}) return ${glslVec3(ADAPTATION[BASES.xyz])};
  if (space == ${BASES.bradford}) return ${glslVec3(ADAPTATION[BASES.bradford])};
  if (space == ${BASES.cat16}) return ${glslVec3(ADAPTATION[BASES.cat16])};
  return vec3(1.0);
}
vec3 cmGamut(vec3 xyz, float compression, bool clipped) {
  float total = xyz.x + xyz.y + xyz.z;
  float Y = xyz.y;
  if (!(total > 0.0 && Y > 0.0)) return vec3(0.0);
  float x = xyz.x / total;
  float y = xyz.y / total;
  float uvDen = -2.0 * x + 12.0 * y + 3.0;
  vec2 uv = vec2(4.0 * x, 9.0 * y) / uvDen;
  vec2 d = CM_D50_UV - uv;
  float delta = Y * dot(d, d);
  float correction = compression == 0.0 ? 0.0 : pow(delta, compression);
  vec2 t = correction * d + uv;
  uv.x = uv.x > CM_D50_UV.x ? max(t.x, CM_D50_UV.x) : min(t.x, CM_D50_UV.x);
  uv.y = uv.y > CM_D50_UV.y ? max(t.y, CM_D50_UV.y) : min(t.y, CM_D50_UV.y);
  float xyDen = 6.0 * uv.x - 16.0 * uv.y + 12.0;
  x = 9.0 * uv.x / xyDen;
  y = 4.0 * uv.y / xyDen;
  if (clipped) {
    x = max(x, 0.0);
    y = max(y, 0.0);
  }
  y = max(y, CM_NORM_MIN);
  float s = x + y;
  if (s >= 1.0) {
    x /= s;
    y /= s;
  }
  return vec3(Y * x / y, Y, Y * (1.0 - x - y) / y);
}
vec3 cmLumaChroma(vec3 v, vec3 sat, vec3 light) {
  float n = cmNorm(v);
  float avg = max((v.x + v.y + v.z) / 3.0, CM_NORM_MIN);
  float lift = dot(v, light);
  n *= CM_INV_SQRT_3;
  vec3 ratios = v / n;
  float coeff = dot(ratios, sat) / 3.0;
  vec3 o = max((1.0 - ratios) * coeff + ratios, min(ratios, vec3(0.0)));
  n /= cmNorm(o) * CM_INV_SQRT_3;
  n *= max(1.0 + lift / avg, 0.0);
  return o * n;
}
`;

const INLINE = `
{
  mat3 cmMix = transpose(mat3(cmRow(red, normalizeRed), cmRow(green, normalizeGreen), cmRow(blue, normalizeBlue)));
  vec3 cmSat = -colourfulness + (normalizeColourfulness ? (colourfulness.x + colourfulness.y + colourfulness.z) / 3.0 : 0.0);
  vec3 cmLight = brightness - (normalizeBrightness ? (brightness.x + brightness.y + brightness.z) / 3.0 : 0.0);
  float cmGreySum = grey.x + grey.y + grey.z;
  vec3 cmGrey = grey / ((!normalizeGrey || cmGreySum == 0.0) ? 1.0 : cmGreySum);
  bool cmMono = any(notEqual(grey, vec3(0.0)));
  float cmCompression = gamut == 0.0 ? 0.0 : 1.0 / gamut;
  bool cmIdle = cmMix == mat3(1.0) && cmSat == vec3(0.0) && cmLight == vec3(0.0) && !cmMono && cmCompression == 0.0 && !clip;
  if (!cmIdle) {
    int cmSpace = basis;
    vec3 w = CM_TO_2020 * lin;
    if (clip) w = max(w, 0.0);
    vec3 cmXyz;
    if (cmSpace == ${BASES.rgb}) {
      cmXyz = CM_2020_TO_XYZ * (cmMix * w);
    } else {
      vec3 cmLms = cmToLms(CM_2020_TO_XYZ * w, cmSpace) * cmAdaptation(cmSpace);
      cmXyz = cmFromLms(cmMix * cmLms, cmSpace);
    }
    vec3 cmMapped = cmGamut(cmXyz, cmCompression, clip);
    vec3 cmV = cmSpace == ${BASES.rgb} ? CM_XYZ_TO_2020 * cmMapped : cmToLms(cmMapped, cmSpace);
    if (clip) cmV = max(cmV, 0.0);
    cmV = cmLumaChroma(cmV, cmSat, cmLight);
    if (clip) cmV = max(cmV, 0.0);
    if (cmMono) {
      w = vec3(max(dot(cmV, cmGrey), 0.0));
    } else {
      vec3 cmBack = cmSpace == ${BASES.rgb} ? CM_2020_TO_XYZ * cmV : cmFromLms(cmV, cmSpace);
      if (clip) cmBack = max(cmBack, 0.0);
      w = CM_XYZ_TO_2020 * cmBack;
      if (clip) w = max(w, 0.0);
    }
    lin = CM_TO_709 * w;
  }
}
`;

type Vec3Key = "red" | "green" | "blue" | "colourfulness" | "brightness" | "grey";
type BoolKey =
  | "normalizeRed"
  | "normalizeGreen"
  | "normalizeBlue"
  | "normalizeColourfulness"
  | "normalizeBrightness"
  | "normalizeGrey"
  | "clip";

const vec3Uniform = (key: Vec3Key, label: string, min: number, max: number): UniformDeclaration => ({
  key,
  glslType: "vec3",
  default: [...DEFAULT_PARAMS[key]],
  range: { min, max, step: 0.001 },
  label,
});

const boolUniform = (key: BoolKey, label: string): UniformDeclaration => ({
  key,
  glslType: "bool",
  default: DEFAULT_PARAMS[key],
  label,
});

const UNIFORMS: UniformDeclaration[] = [
  vec3Uniform("red", "output red", -2, 2),
  vec3Uniform("green", "output green", -2, 2),
  vec3Uniform("blue", "output blue", -2, 2),
  boolUniform("normalizeRed", "normalize red"),
  boolUniform("normalizeGreen", "normalize green"),
  boolUniform("normalizeBlue", "normalize blue"),
  vec3Uniform("colourfulness", "colourfulness", -1, 1),
  boolUniform("normalizeColourfulness", "normalize colourfulness"),
  vec3Uniform("brightness", "brightness", -1, 1),
  boolUniform("normalizeBrightness", "normalize brightness"),
  vec3Uniform("grey", "B&W", -2, 2),
  boolUniform("normalizeGrey", "normalize B&W"),
  { key: "basis", glslType: "int", default: DEFAULT_PARAMS.basis, range: { min: 0, max: 3, step: 1 }, label: "mixing space" },
  {
    key: "gamut",
    glslType: "float",
    default: DEFAULT_PARAMS.gamut,
    range: { min: 0, max: 12, step: 0.01 },
    label: "gamut compression",
  },
  boolUniform("clip", "clip negative RGB"),
];

export function mixerStage(): ProcessingStageContribution {
  return {
    id: STAGE_ID,
    name: "Channel Mixer",
    phase: "scene-linear",
    priority: 20,
    glsl: INLINE,
    helpers: HELPERS,
    uniforms: UNIFORMS,
    presetScope: "global",
    // A mask's copy runs at the defaults until one of its values moves, so the
    // gate keeps an untouched mask bit-exact too.
    mask: { maskable: true },
  };
}
