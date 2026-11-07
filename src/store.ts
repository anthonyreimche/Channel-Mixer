// Session state of the panel, not part of the edit: the open tab, the editing
// mode, and the values the mode's sliders hold. A reduced mode reads its
// values from the matrix, but a slider drag keeps them as the user set them:
// rebuilding them from the matrix on every change would reorder the stretches
// (the larger is always read back first) and lose a rotation's sign. They are
// kept with the matrix and basis they make, and read afresh once the edit's
// matrix is something else (undo, a preset, another photo).

import type { Basis, Mat3 } from "./model";
import type { MixerMode, Primaries, Simple, WhitePreserving } from "./modes";
import { api } from "./rt";
import type { AppStore } from "./safelight";

export type Tab = "mixer" | "outputs" | "space";

export type ModeValues =
  | { mode: "simple"; values: Simple }
  | { mode: "primaries"; values: Primaries }
  | { mode: "white-preserving"; values: WhitePreserving };

export interface Held {
  values: ModeValues;
  matrix: Mat3;
  basis: Basis;
}

export interface MixerUiState {
  tab: Tab;
  mode: MixerMode;
  /** Why the last mode switch or mode edit was refused. */
  notice: string | null;
  held: Held | null;
  setTab(tab: Tab): void;
  setMode(mode: MixerMode, held: Held | null): void;
  setNotice(notice: string | null): void;
  hold(held: Held): void;
}

let current: AppStore<MixerUiState> | null = null;

export function initStore(): void {
  current = api.stores.create<MixerUiState>((set) => ({
    tab: "mixer",
    mode: "complete",
    notice: null,
    held: null,
    setTab: (tab) => set({ tab }),
    setMode: (mode, held) => set({ mode, held, notice: null }),
    setNotice: (notice) => set({ notice }),
    hold: (held) => set({ held, notice: null }),
  }));
}

export function store(): AppStore<MixerUiState> {
  if (!current) throw new Error("[channel-mixer] store() called before activate()");
  return current;
}
