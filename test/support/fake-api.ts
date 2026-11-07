// A stand-in Safelight API for unit tests, over real React and zustand. It has
// only what this extension uses: reading any other member throws, naming it,
// so a test shows what to add here when the extension starts using more.
//
// The photo's edit is a param bag in a zustand store, so a panel re-renders
// when it changes. Reads fall back to the defaults of the registered stages'
// uniforms, as Safelight's do. Core's Slider is a stub that keeps the props it
// was last drawn with, so a test can drive a drag and its release. The UI kit
// pieces the panel uses are plain DOM (a <select>, a checkbox, buttons), so
// Testing Library can drive them. `getParams` reads the bag as it is now, as
// the host's does, which a drag faster than React's renders relies on.

import * as React from "react";
import { create } from "zustand";
import type {
  PanelContribution,
  ParamScope,
  ProcessingStageContribution,
  SafelightAPI,
  SectionProps,
  SegmentedControlProps,
  SelectProps,
  SliderProps,
  StackProps,
  ToggleProps,
} from "../../src/safelight";
import { EXT_ID as EXTENSION_ID } from "../../src/params";

/** The members of SafelightAPI this fake implements, typed against the real thing. */
type FakeMembers = Pick<
  SafelightAPI,
  "version" | "extensionId" | "react" | "registerPanel" | "registerProcessingStage" | "unregisterProcessingStage"
> & {
  components: Pick<SafelightAPI["components"], "Slider">;
  develop: Pick<SafelightAPI["develop"], "useParamScope">;
  ui: Pick<SafelightAPI["ui"], "Select" | "SegmentedControl" | "Section" | "Stack" | "Toggle" | "tokens">;
  stores: Pick<SafelightAPI["stores"], "create">;
};

export interface Rig {
  api: SafelightAPI;
  panels: PanelContribution[];
  stages: ProcessingStageContribution[];
  /** The photo's param bag, by qualified key, without defaults. */
  params(): Readonly<Record<string, unknown>>;
  /** The labels of the undo steps the extension made, in order. */
  commits: string[];
  /** The latest props of each slider drawn in `root`, in document order. */
  sliders(root: ParentNode): SliderProps[];
  /** The stage ids unregistered, in order. */
  unregistered: string[];
  /** Replaces the photo's bag from outside the panel, as an undo would. */
  replace(params: Record<string, unknown>): void;
}

export function fakeApi(initial: Record<string, unknown> = {}): Rig {
  const panels: PanelContribution[] = [];
  const stages: ProcessingStageContribution[] = [];
  const commits: string[] = [];
  const defaults = new Map<string, unknown>();
  const photo = create<{ params: Record<string, unknown> }>()(() => ({ params: { ...initial } }));
  const sliderProps = new Map<number, SliderProps>();
  const unregistered: string[] = [];
  let nextSlider = 0;

  function useParamScope(): ParamScope {
    const params = photo((s) => s.params);
    return {
      maskId: null,
      getParam: (key) => (key in params ? params[key] : defaults.get(key)),
      getParams: () => photo.getState().params,
      setParams: (patch) =>
        photo.setState((s) => {
          const next = { ...s.params, ...patch };
          for (const [key, value] of Object.entries(patch)) if (value === undefined) delete next[key];
          return { params: next };
        }),
      commit: (label) => void commits.push(label),
    };
  }

  function Slider(props: SliderProps) {
    const id = React.useRef(nextSlider++).current;
    sliderProps.set(id, props);
    return React.createElement("div", { "data-slider": id }, `${props.label} ${props.value}`);
  }

  const members: FakeMembers = {
    version: 1,
    extensionId: EXTENSION_ID,
    react: React,
    registerPanel: (c) => void panels.push(c),
    registerProcessingStage: (c) => {
      stages.push(c);
      for (const u of c.uniforms) defaults.set(`${c.id}.${u.key}`, u.default);
    },
    unregisterProcessingStage: (id) => void unregistered.push(id),
    components: { Slider },
    develop: { useParamScope },
    ui: ui as unknown as FakeMembers["ui"],
    stores: { create },
  };

  return {
    api: strict(members, "api") as unknown as SafelightAPI,
    panels,
    stages,
    params: () => photo.getState().params,
    commits,
    unregistered,
    replace: (params) => photo.setState({ params: { ...params } }),
    sliders: (root) =>
      [...root.querySelectorAll("[data-slider]")].map((el) => {
        const props = sliderProps.get(Number(el.getAttribute("data-slider")));
        if (!props) throw new Error("a slider without props");
        return props;
      }),
  };
}

const e = React.createElement;

const ui = {
  Select: (props: SelectProps) =>
    e(
      "select",
      { "aria-label": props.ariaLabel, value: props.value, onChange: (ev: React.ChangeEvent<HTMLSelectElement>) => props.onChange(ev.target.value) },
      props.placeholder !== undefined ? e("option", { value: "" }, props.placeholder) : null,
      ...(props.options ?? []).map((o) => e("option", { key: o.value, value: o.value }, o.label)),
    ),
  SegmentedControl: (props: SegmentedControlProps) =>
    e(
      "div",
      { role: "tablist" },
      ...props.options.map((o) =>
        e("button", { key: o.value, role: "tab", "aria-selected": o.value === props.value, onClick: () => props.onChange(o.value) }, o.label),
      ),
    ),
  Section: (props: SectionProps) => e("section", { "aria-label": String(props.title) }, e("h3", null, props.title), props.children),
  Stack: (props: StackProps) => e("div", null, props.children),
  Toggle: (props: ToggleProps) =>
    e(
      "label",
      null,
      props.label,
      e("input", {
        type: "checkbox",
        "aria-label": props.ariaLabel ?? (typeof props.label === "string" ? props.label : undefined),
        checked: props.checked,
        onChange: (ev: React.ChangeEvent<HTMLInputElement>) => props.onChange(ev.target.checked),
      }),
    ),
  tokens: { textSecondary: "var(--color-text-secondary)" },
};

/** Wraps a plain object so reading a member it lacks throws, naming the member. */
function strict<T extends object>(target: T, path: string): T {
  return new Proxy(target, {
    get(obj, key, receiver) {
      if (typeof key === "symbol" || key === "then" || key === "toJSON") return Reflect.get(obj, key, receiver);
      if (!(key in obj)) throw new Error(`The fake API has no ${path}.${key}. Add it to test/support/fake-api.ts.`);
      const value: unknown = Reflect.get(obj, key, receiver);
      const isPlainObject = typeof value === "object" && value !== null && Object.getPrototypeOf(value) === Object.prototype;
      return isPlainObject && key !== "react" ? strict(value, `${path}.${key}`) : value;
    },
  });
}
