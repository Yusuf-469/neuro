// Plain-language layer over the research model: groups the 1,144 EEG measurements into things a
// person can picture (which brainwave, which part of the head), shares each prediction out to
// those groups, reads uploaded recordings, and lets the brainwaves be turned up or down.

import type { BiomarkerKey, NeuroModel, Pipeline } from './neuroModel';

export type Band = 'delta' | 'theta' | 'alpha' | 'beta' | 'highbeta' | 'gamma';
type Region = 'front' | 'top' | 'sides' | 'upper back' | 'back';

export const BANDS: { key: Band; name: string; plain: string; hint: string; color: string }[] = [
  { key: 'delta', name: 'Delta', plain: 'deep, slow waves', hint: 'Strongest in deep sleep', color: '#BF5AF2' },
  { key: 'theta', name: 'Theta', plain: 'drowsy, dreamy waves', hint: 'Daydreaming and drowsiness', color: '#5AC8FA' },
  { key: 'alpha', name: 'Alpha', plain: 'calm, resting waves', hint: 'Relaxed and awake, eyes closed', color: '#30D158' },
  { key: 'beta', name: 'Beta', plain: 'active-thinking waves', hint: 'Focus and problem solving', color: '#FF9500' },
  { key: 'highbeta', name: 'High beta', plain: 'tense, alert waves', hint: 'Stress, worry and high alertness', color: '#FFD60A' },
  { key: 'gamma', name: 'Gamma', plain: 'very fast waves', hint: 'Fast information processing', color: '#FF375F' },
];
const BAND = Object.fromEntries(BANDS.map((b) => [b.key, b])) as Record<Band, (typeof BANDS)[number]>;

const REGION_OF: Record<string, Region> = {
  FP1: 'front', FP2: 'front', F7: 'front', F3: 'front', Fz: 'front', F4: 'front', F8: 'front',
  C3: 'top', Cz: 'top', C4: 'top',
  T3: 'sides', T4: 'sides', T5: 'sides', T6: 'sides',
  P3: 'upper back', Pz: 'upper back', P4: 'upper back',
  O1: 'back', O2: 'back',
};
const REGIONS: Region[] = ['front', 'top', 'sides', 'upper back', 'back'];
const REGION_PHRASE: Record<Region, string> = {
  front: 'the front of the head',
  top: 'the top of the head',
  sides: 'the sides of the head',
  'upper back': 'the upper back of the head',
  back: 'the back of the head',
};

export const BIO_TEXT: Record<BiomarkerKey, string> = {
  FAA: 'Balance of calm waves between the right and left front of the head',
  theta_alpha: 'Drowsy waves compared with calm waves, across the head',
  beta_alpha: 'Active-thinking waves compared with calm waves, across the head',
  delta_asym: 'Balance of slow waves between the right and left front of the head',
};

export interface Group {
  key: string;
  label: string;
  band?: Band;
  members: number[]; // feature indices
}

/** Which group every model feature belongs to. Built once per model. */
export function buildGroups(model: NeuroModel): { groups: Group[]; groupOf: Int32Array } {
  const byKey = new Map<string, Group>();
  const groupOf = new Int32Array(model.pipeline.features.length);
  model.pipeline.features.forEach((name, i) => {
    let key: string, label: string, band: Band | undefined;
    const ab = name.match(/^AB\.[A-F]\.(\w+)\.[a-z]\.(\w+)$/);
    const coh = name.match(/^COH\.[A-F]\.(\w+)\.[a-z]\.(\w+)\.[a-z]\.(\w+)$/);
    if (ab) {
      band = ab[1] as Band;
      const r = REGION_OF[ab[2]];
      key = `power|${band}|${r}`;
      label = `Strength of ${BAND[band].plain} (${BAND[band].name.toLowerCase()}) over ${REGION_PHRASE[r]}`;
    } else if (coh) {
      band = coh[1] as Band;
      const [r1, r2] = [REGION_OF[coh[2]], REGION_OF[coh[3]]].sort((a, b) => REGIONS.indexOf(a) - REGIONS.indexOf(b));
      key = `sync|${band}|${r1}|${r2}`;
      const where = r1 === r2 ? `within ${REGION_PHRASE[r1]}` : `between the ${r1} and the ${r2} of the head`;
      label = `How in sync ${BAND[band].plain} (${BAND[band].name.toLowerCase()}) are ${where}`;
    } else {
      key = `bio|${name}`;
      label = BIO_TEXT[name as BiomarkerKey] ?? name;
    }
    let g = byKey.get(key);
    if (!g) {
      g = { key, label, band, members: [] };
      byKey.set(key, g);
    }
    g.members.push(i);
  });
  const groups = [...byKey.values()];
  groups.forEach((g, gi) => g.members.forEach((i) => (groupOf[i] = gi)));
  return { groups, groupOf };
}

export interface Reason {
  group: Group;
  push: number; // log-odds; > 0 toward mood disorder, < 0 toward healthy
  level: number; // average standardised value of the group's measurements (0 = typical)
}

/**
 * Shares each component's contribution out to the measurements it is made of, in proportion to
 * how much each measurement moved that component for this person, then sums by group.
 */
export function reasons(pipe: Pipeline, groups: Group[], groupOf: Int32Array, s: Float64Array, phi: number[]): Reason[] {
  const push = new Float64Array(groups.length);
  const part = new Float64Array(pipe.F);
  for (let k = 0; k < pipe.K; k++) {
    if (!phi[k]) continue;
    const row = k * pipe.F;
    let tot = 0;
    for (let i = 0; i < pipe.F; i++) tot += (part[i] = Math.abs(pipe.components[row + i] * s[i]));
    if (!tot) continue;
    for (let i = 0; i < pipe.F; i++) push[groupOf[i]] += (phi[k] * part[i]) / tot;
  }
  return groups.map((group, gi) => ({
    group,
    push: push[gi],
    level: group.members.reduce((a, i) => a + s[i], 0) / group.members.length,
  }));
}

export function levelText(level: number): string {
  if (level > 1) return 'much higher than typical';
  if (level > 0.35) return 'higher than typical';
  if (level < -1) return 'much lower than typical';
  if (level < -0.35) return 'lower than typical';
  return 'about typical';
}

/** Headline and strength for a probability of "mood disorder". */
export function verdict(p: number): { leansMood: boolean; strength: string } {
  const d = Math.abs(p - 0.5);
  return { leansMood: p >= 0.5, strength: d < 0.1 ? 'Slightly' : d < 0.25 ? 'Moderately' : 'Strongly' };
}

// ---- What-if: turn a brainwave band up or down ------------------------------------------------

export interface Adjustments {
  power: Record<Band, number>; // multiplies band power
  sync: Record<Band, number>; // multiplies coherence (0-100, so it is capped at 100)
}

const ONES: Record<Band, number> = { delta: 1, theta: 1, alpha: 1, beta: 1, highbeta: 1, gamma: 1 };
export const NO_CHANGE: Adjustments = { power: ONES, sync: ONES };

export const isUnchanged = (a: Adjustments) =>
  BANDS.every((b) => a.power[b.key] === 1 && a.sync[b.key] === 1);

/** Raw columns with each band's strength and sync scaled. */
export function applyAdjustments(model: NeuroModel, raw: ArrayLike<number>, adj: Adjustments): Float64Array {
  const out = Float64Array.from(raw as ArrayLike<number>);
  model.pipeline.raw.forEach((c, i) => {
    const m = c.match(/^(AB|COH)\.[A-F]\.(\w+)\./);
    if (!m) return;
    const band = m[2] as Band;
    if (m[1] === 'AB') out[i] *= adj.power[band] ?? 1;
    else out[i] = Math.min(100, out[i] * (adj.sync[band] ?? 1));
  });
  return out;
}

// ---- Uploaded recordings ----------------------------------------------------------------------

export interface Recording {
  name: string;
  raw: Float64Array;
  truth?: 0 | 1;
  matched: number; // how many of the model's columns the file had
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '', quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((v) => v.trim());
}

const MAX_ROWS = 500;

/**
 * Reads a CSV in the dataset's format (one recording per row, columns named like AB.C.alpha.f.F4).
 * Columns the file lacks are filled with the training average; at least half must be present.
 */
export function parseRecordings(pipe: Pipeline, text: string): Recording[] {
  const lines = (text.charCodeAt(0) === 0xfeff ? text.slice(1) : text).split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) throw new Error('The file needs a header row and at least one recording.');
  const header = splitCsvLine(lines[0]);
  const colOf = header.map((h) => pipe.rawIndex.get(h) ?? -1);
  const matched = colOf.filter((c) => c >= 0).length;
  if (matched < pipe.R / 2) {
    throw new Error(
      `Only ${matched} of the ${pipe.R} EEG columns the model needs were found. ` +
        'Use the dataset\'s column names (for example AB.C.alpha.f.F4); download the sample file to see the format.',
    );
  }
  const lower = header.map((h) => h.toLowerCase());
  const nameCol = lower.findIndex((h) => ['subject', 'no.', 'id', 'name'].includes(h));
  const truthCol = lower.findIndex((h) => ['diagnosis', 'main.disorder', 'label'].includes(h));

  const rows = lines.slice(1, MAX_ROWS + 1);
  return rows.map((line, r) => {
    const cells = splitCsvLine(line);
    const raw = Float64Array.from(pipe.trainMean.subarray(0, pipe.R));
    let found = 0;
    colOf.forEach((c, j) => {
      if (c < 0) return;
      const v = Number(cells[j]);
      if (cells[j] !== '' && Number.isFinite(v)) { raw[c] = v; found++; }
    });
    const t = truthCol >= 0 ? (cells[truthCol] || '').toLowerCase() : '';
    const truth = t.startsWith('healthy') ? 0 : t.startsWith('mood') ? 1 : undefined;
    const name = nameCol >= 0 && cells[nameCol] ? `Recording ${cells[nameCol]}` : `Row ${r + 1}`;
    return { name, raw, truth, matched: found };
  });
}

