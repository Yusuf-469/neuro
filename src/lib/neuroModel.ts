// Research model: XGBoost (healthy control vs mood disorder) exported from the Python pipeline.
// Predictions are computed here, in the browser, by walking the exported trees.

export interface ModelTree {
  l: number[]; // left child per node (-1 = leaf)
  r: number[]; // right child per node
  f: number[]; // split feature index
  c: number[]; // split threshold, or leaf value on leaves
  d: boolean[]; // default direction for missing values (true = left)
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
