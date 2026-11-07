// The mixer's built-in presets, as Ansel's channelmixerrgb.c init_presets()
// defines them: each sets every mixer value, like a module preset. The B&W
// film weights are Ansel's, integrated from the makers' spectral
// sensitivities against the CIE 1931 observer under D50, in XYZ.

import { BASES, DEFAULT_PARAMS, type Params, type Vec3 } from "./model";

export interface MixerPreset {
  id: string;
  label: string;
  params: Params;
}

const bw = (grey: Vec3): Params => ({ ...DEFAULT_PARAMS, grey, basis: BASES.xyz, clip: true });
const basic: Params = { ...DEFAULT_PARAMS, normalizeGrey: false };
const swap = (red: Vec3, green: Vec3, blue: Vec3): Params => ({ ...basic, red, green, blue });

export const PRESETS: readonly MixerPreset[] = [
  { id: "bw-luminance", label: "B&W: luminance-based", params: bw([0, 1, 0]) },
  { id: "bw-hp5", label: "B&W: ILFORD HP5+", params: bw([0.25304098, 0.25958747, 0.48737156]) },
  { id: "bw-delta100", label: "B&W: ILFORD DELTA 100", params: bw([0.24552374, 0.25366007, 0.50081619]) },
  { id: "bw-delta400", label: "B&W: ILFORD DELTA 400 – 3200", params: bw([0.24376712, 0.23613559, 0.52009729]) },
  { id: "bw-fp4", label: "B&W: ILFORD FP4+", params: bw([0.24149085, 0.22149272, 0.53701643]) },
  { id: "bw-acros", label: "B&W: Fuji Acros 100", params: bw([0.333, 0.313, 0.353]) },
  { id: "basic", label: "Basic channel mixer", params: basic },
  { id: "swap-gb", label: "Swap green and blue", params: swap([1, 0, 0], [0, 0, 1], [0, 1, 0]) },
  { id: "swap-gr", label: "Swap green and red", params: swap([0, 1, 0], [1, 0, 0], [0, 0, 1]) },
  { id: "swap-rb", label: "Swap red and blue", params: swap([0, 0, 1], [0, 1, 0], [1, 0, 0]) },
];
