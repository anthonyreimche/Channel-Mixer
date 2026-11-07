// Channel Mixer, a Safelight extension (GPL-3.0-or-later).
//
// The channel mixer of Ansel's colour calibration: a 3×3 matrix in a chosen
// mixing space, edited as nine coefficients or through three reduced modes,
// then colourfulness, brightness and B&W rows and gamut compression.
// Registers the scene-linear stage (stage.ts) and the Develop panel
// (Panel.tsx), which also edits a mask's mixer in the Masking panel.

import { ChannelMixerPanel } from "./Panel";
import { EXT_ID, PARAM_KEYS, STAGE_ID, qualified, resetPatch } from "./params";
import { api, initRuntime } from "./rt";
import type { SafelightAPI } from "./safelight";
import { mixerStage } from "./stage";
import { initStore } from "./store";

export const PANEL_ID = `${EXT_ID}.panel`;

// Null until activate() runs.
let activeHost: SafelightAPI | null = null;

function reset(): void {
  const dev = api.stores.useDevelopStore.getState();
  dev.setDynParams(resetPatch());
  void dev.commitEdit("Channel Mixer reset");
}

export function activate(host: SafelightAPI): void {
  initRuntime(host);
  initStore();
  activeHost = host;
  // While the mixer does nothing its branch is never taken, so an untouched
  // photo renders bit for bit unchanged.
  host.registerProcessingStage(mixerStage());
  host.registerPanel({
    id: PANEL_ID,
    title: "Channel Mixer",
    component: ChannelMixerPanel,
    defaultDock: { module: "develop", direction: "right", width: 280 },
    onReset: reset,
    mask: { component: ChannelMixerPanel, owns: PARAM_KEYS.map(qualified) },
  });
}

export function deactivate(): void {
  const host = activeHost;
  if (!host) return;
  activeHost = null;
  // A throw here would skip the host's sweep of this extension's
  // registrations, so a failure is logged instead.
  try {
    host.unregisterProcessingStage(STAGE_ID);
  } catch (err) {
    console.warn("[channel-mixer] deactivate failed:", err);
  }
}
