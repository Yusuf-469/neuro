// Research model: XGBoost (healthy control vs mood disorder) exported from the Python pipeline.
// Predictions are computed here, in the browser, by walking the exported trees.

export interface ModelTree {
  l: number[]; // left child per node (-1 = leaf)
  r: number[]; // right child per node
  f: number[]; // split feature index
  c: number[]; // split threshold, or leaf value on leaves
  d: boolean[]; // default direction for missing values (true = left)
  h: number[]; // training cover (sum of hessians) per node, used to explain predictions
}

export interface Subject {
  id: number;
  truth: 0 | 1;
  z: number[]; // scaled + PCA-projected features
  p: number; // probability from the Python model, used as a cross-check
  bio: Record<BiomarkerKey, number>;
  shap: { pc: number; v: number }[];
}

export type BiomarkerKey = 'FAA' | 'theta_alpha' | 'beta_alpha' | 'delta_asym';

export interface CvRow {
  cv_acc: number;
  cv_acc_sd: number;
  cv_bal: number;
  cv_auc: number;
  heldout_acc: number;
}

export interface NeuroModel {
  meta: {
    task: string;
    dataset: string;
    n_total: number;
    n_train: number;
    n_test: number;
    features_in: number;
    components: number;
    pipeline: string[];
    split: string;
    labels: [string, string];
    versions: Record<string, string>;
  };
  metrics: {
    heldout_acc: number;
    heldout_correct: number;
    heldout_baseline: number;
    cv: Record<string, CvRow>;
  };
  model: { base_margin: number; trees: ModelTree[] };
  pipeline: {
    bin: string;
    features: string[]; // model input order: the raw EEG columns, then the four biomarkers
    raw: string[]; // raw EEG columns (dataset format, e.g. AB.C.alpha.f.F4)
    n_raw_test: number;
  };
  components: string[][];
  global_shap: { pc: number; imp: number; made_of: string[] }[];
  medians: Record<'healthy' | 'mood', Record<BiomarkerKey, number>>;
  subjects: Subject[];
}

export const MODEL_URL = '/research/neuro-model.json';

let cached: Promise<NeuroModel> | null = null;

/** Loads the exported model once; the 3D scene and the model screen share it. */
export function loadNeuroModel(): Promise<NeuroModel> {
  if (!cached) {
    cached = fetch(MODEL_URL).then((res) => {
      if (!res.ok) throw new Error(`Could not load the model (${res.status})`);
      return res.json() as Promise<NeuroModel>;
    });
    cached.catch(() => {
      cached = null;
    });
  }
  return cached;
}

/** Probability of "mood disorder" for one subject, from the exported trees. */
export function predictProba(model: NeuroModel, z: number[]): number {
  let margin = model.model.base_margin;
  for (const t of model.model.trees) {
    let n = 0;
    while (t.l[n] !== -1) {
      const v = z[t.f[n]];
      if (v === undefined || Number.isNaN(v)) {
        n = t.d[n] ? t.l[n] : t.r[n];
      } else {
        // XGBoost compares in float32
        n = Math.fround(v) < Math.fround(t.c[n]) ? t.l[n] : t.r[n];
      }
    }
    margin += t.c[n];
  }
  return 1 / (1 + Math.exp(-margin));
}

export const BIOMARKERS: { key: BiomarkerKey; label: string; hint: string }[] = [
  { key: 'FAA', label: 'Frontal alpha asymmetry', hint: 'ln alpha F4 − ln alpha F3' },
  { key: 'theta_alpha', label: 'Theta / alpha ratio', hint: 'mean theta ÷ mean alpha power' },
  { key: 'beta_alpha', label: 'Beta / alpha ratio', hint: 'mean beta ÷ mean alpha power' },
  { key: 'delta_asym', label: 'Delta asymmetry', hint: 'ln delta F4 − ln delta F3' },
];

// ---- Full pipeline for raw recordings ---------------------------------------------------------
// Raw EEG columns -> four biomarkers -> standardise -> PCA projection -> trees. The transforms are
// the training-set ones, shipped as float32 in neuro-model.bin.

export interface Pipeline {
  F: number; // model features (raw + biomarkers)
  K: number; // PCA components
  R: number; // raw EEG columns
  mean: Float32Array;
  scale: Float32Array;
  trainMean: Float32Array; // fills columns an upload doesn't have
  components: Float32Array; // K x F, row-major
  examples: Float32Array[]; // raw columns of the held-out subjects, same order as model.subjects
  rawIndex: Map<string, number>;
}

let pipeCache: Promise<Pipeline> | null = null;

export function loadPipeline(model: NeuroModel): Promise<Pipeline> {
  if (!pipeCache) {
    pipeCache = fetch(`/research/${model.pipeline.bin}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Could not load the model pipeline (${res.status})`);
        return res.arrayBuffer();
      })
      .then((buf) => {
        const F = model.pipeline.features.length;
        const K = model.meta.components;
        const R = model.pipeline.raw.length;
        const N = model.pipeline.n_raw_test;
        const all = new Float32Array(buf);
        if (all.length !== 3 * F + K * F + N * R) throw new Error('Model pipeline file does not match the model');
        let o = 0;
        const take = (n: number) => all.subarray(o, (o += n));
        const mean = take(F), scale = take(F), trainMean = take(F), components = take(K * F);
        const examples = Array.from({ length: N }, () => take(R));
        return { F, K, R, mean, scale, trainMean, components, examples, rawIndex: new Map(model.pipeline.raw.map((c, i) => [c, i])) };
      });
    pipeCache.catch(() => {
      pipeCache = null;
    });
  }
  return pipeCache;
}

const BIO_KEYS: BiomarkerKey[] = ['FAA', 'theta_alpha', 'beta_alpha', 'delta_asym'];

/** The four biomarkers, computed from raw band powers exactly as in the Python pipeline. */
export function computeBiomarkers(pipe: Pipeline, raw: ArrayLike<number>): Record<BiomarkerKey, number> {
  const at = (c: string) => raw[pipe.rawIndex.get(c)!];
  const ln = (v: number) => Math.log(Math.max(v, 1e-6));
  const band = (b: string) => {
    let sum = 0, n = 0;
    pipe.rawIndex.forEach((i, c) => {
      if (c.startsWith('AB.') && c.includes(`.${b}.`)) { sum += raw[i]; n++; }
    });
    return sum / n;
  };
  return {
    FAA: ln(at('AB.C.alpha.f.F4')) - ln(at('AB.C.alpha.d.F3')),
    theta_alpha: band('theta') / band('alpha'),
    beta_alpha: band('beta') / band('alpha'),
    delta_asym: ln(at('AB.A.delta.f.F4')) - ln(at('AB.A.delta.d.F3')),
  };
}

export interface Transformed {
  bio: Record<BiomarkerKey, number>;
  s: Float64Array; // standardised features (0 = training average)
  z: number[]; // PCA components, the model's input
}

export function transform(pipe: Pipeline, raw: ArrayLike<number>): Transformed {
  const bio = computeBiomarkers(pipe, raw);
  const s = new Float64Array(pipe.F);
  for (let i = 0; i < pipe.R; i++) s[i] = (raw[i] - pipe.mean[i]) / pipe.scale[i];
  BIO_KEYS.forEach((k, j) => {
    const i = pipe.R + j;
    s[i] = (bio[k] - pipe.mean[i]) / pipe.scale[i];
  });
  const z = new Array<number>(pipe.K).fill(0);
  for (let k = 0; k < pipe.K; k++) {
    const row = k * pipe.F;
    let acc = 0;
    for (let i = 0; i < pipe.F; i++) acc += pipe.components[row + i] * s[i];
    z[k] = acc;
  }
  return { bio, s, z };
}

// ---- Explaining one prediction ----------------------------------------------------------------
// Path attribution (Saabas): walking each tree, the change in the node's expected value at every
// split is credited to that split's component. Contributions add up exactly to the model's score.

const meansCache = new WeakMap<ModelTree, number[]>();

function nodeMeans(t: ModelTree): number[] {
  let m = meansCache.get(t);
  if (m) return m;
  const out = new Array<number>(t.l.length).fill(0);
  const rec = (n: number): number => {
    if (t.l[n] === -1) return (out[n] = t.c[n]);
    const a = t.l[n], b = t.r[n];
    const ma = rec(a), mb = rec(b);
    return (out[n] = (t.h[a] * ma + t.h[b] * mb) / (t.h[a] + t.h[b]));
  };
  rec(0);
  m = out;
  meansCache.set(t, m);
  return m;
}

/** Per-component contributions to the log-odds of "mood disorder", plus the baseline. */
export function contributions(model: NeuroModel, z: number[]): { phi: number[]; bias: number } {
  const phi = new Array<number>(z.length).fill(0);
  let bias = model.model.base_margin;
  for (const t of model.model.trees) {
    const m = nodeMeans(t);
    bias += m[0];
    let n = 0;
    while (t.l[n] !== -1) {
      const c = Math.fround(z[t.f[n]]) < Math.fround(t.c[n]) ? t.l[n] : t.r[n];
      phi[t.f[n]] += m[c] - m[n];
      n = c;
    }
  }
  return { phi, bias };
}
