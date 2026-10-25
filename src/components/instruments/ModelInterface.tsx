import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Cpu, FlaskConical, Info } from 'lucide-react';
import { IconButton } from '../ui/Button';
import { BIOMARKERS, loadNeuroModel, predictProba, type NeuroModel } from '../../lib/neuroModel';

interface ModelInterfaceProps {
  onBack: () => void;
}

type Filter = 'all' | 'wrong' | 'healthy' | 'mood';

const HEALTHY = '#00D4FF';
const MOOD = '#FF006E';
const ACCENT = '#FFD60A';

const pct = (v: number, d = 1) => `${(v * 100).toFixed(d)}%`;

export function ModelInterface({ onBack }: ModelInterfaceProps) {
  const [model, setModel] = useState<NeuroModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    loadNeuroModel().then(setModel).catch((e: Error) => setError(e.message));
  }, []);

  // Every prediction is computed here by the exported trees
  const rows = useMemo(() => {
    if (!model) return [];
    return model.subjects.map((s, i) => {
      const p = predictProba(model, s.z);
      const pred = p >= 0.5 ? 1 : 0;
      return { i, s, p, pred, correct: pred === s.truth };
    });
  }, [model]);

  const summary = useMemo(() => {
    const cm = { tn: 0, fp: 0, fn: 0, tp: 0 };
    rows.forEach((r) => {
      if (r.s.truth === 0) r.pred === 0 ? cm.tn++ : cm.fp++;
      else r.pred === 1 ? cm.tp++ : cm.fn++;
    });
    const correct = cm.tn + cm.tp;
    const maxDiff = rows.reduce((m, r) => Math.max(m, Math.abs(r.p - r.s.p)), 0);
    return { cm, correct, acc: rows.length ? correct / rows.length : 0, maxDiff };
  }, [rows]);

  const visible = rows.filter((r) =>
    filter === 'all' ? true : filter === 'wrong' ? !r.correct : filter === 'healthy' ? r.s.truth === 0 : r.s.truth === 1,
  );
  const cur = rows[selected];

  return (
    <div className="fixed inset-0 bg-void z-50 flex flex-col overflow-hidden animate-fade-in-up">
      <div className="absolute inset-0 grid-bg opacity-40" />
      <div
        className="absolute w-[600px] h-[600px] rounded-full opacity-15 blur-[120px] pointer-events-none"
        style={{ background: `radial-gradient(circle, ${ACCENT}55 0%, transparent 70%)`, left: '10%', top: '5%' }}
      />

      <header className="relative z-20 flex items-center justify-between gap-4 p-5 border-b border-white/5">
        <IconButton onClick={onBack} variant="ghost" ariaLabel="Go back" className="group">
          <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
        </IconButton>
        <div className="text-center">
          <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2 justify-center">
            <FlaskConical className="w-5 h-5" style={{ color: ACCENT }} /> Research Model
          </h1>
          <p className="text-xs uppercase tracking-widest text-text-secondary">Healthy control vs mood disorder · XGBoost</p>
        </div>
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-pill glass-panel border border-white/10 text-xs text-text-secondary">
          <Cpu className="w-3.5 h-3.5" style={{ color: ACCENT }} /> Runs in your browser
        </div>
      </header>

      <main className="relative z-10 flex-1 overflow-y-auto">
        {error && <p className="p-8 text-center text-pink">{error}</p>}
        {!model && !error && <p className="p-8 text-center text-text-secondary">Loading model…</p>}

        {model && cur && (
          <div className="max-w-6xl mx-auto p-5 md:p-8 grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
            {/* Left: evaluation */}
            <div className="flex flex-col gap-6">
              <section className="glass-panel rounded-card-lg border border-white/10 p-6">
                <p className="text-xs uppercase tracking-widest text-text-secondary mb-3">Held-out test set · report split</p>
                <div className="flex items-baseline gap-3">
                  <span className="text-5xl font-semibold" style={{ color: ACCENT }}>{pct(summary.acc, 2)}</span>
                  <span className="text-text-secondary text-sm">{summary.correct} of {rows.length} correct</span>
                </div>
                <p className="text-sm text-text-secondary mt-2">
                  Majority-class baseline on these subjects: <span className="text-text-primary">{pct(model.metrics.heldout_baseline, 2)}</span>
                </p>
                <div className="grid grid-cols-[auto_1fr_1fr] gap-1.5 mt-5 text-xs text-center">
                  <span />
                  <span className="text-text-secondary">pred. healthy</span>
                  <span className="text-text-secondary">pred. mood</span>
                  <span className="text-text-secondary text-left pr-2 self-center">healthy</span>
                  <Cell n={summary.cm.tn} good />
                  <Cell n={summary.cm.fp} />
                  <span className="text-text-secondary text-left pr-2 self-center">mood</span>
                  <Cell n={summary.cm.fn} />
                  <Cell n={summary.cm.tp} good />
                </div>
                <p className="text-[11px] text-text-tertiary mt-4">
                  Matches the Python model on every subject (largest probability difference {summary.maxDiff.toExponential(1)}).
                </p>
              </section>

              <section className="glass-panel rounded-card-lg border border-white/10 p-6">
                <p className="text-xs uppercase tracking-widest text-text-secondary mb-4">Repeated cross-validation · 10 × 5-fold</p>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-text-tertiary text-xs">
                      <th className="text-left font-normal pb-2">Model</th>
                      <th className="text-right font-normal pb-2">Acc.</th>
                      <th className="text-right font-normal pb-2">Bal.</th>
                      <th className="text-right font-normal pb-2">AUC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {['XGBoost', 'SVM (RBF)', 'Voting ensemble', 'Logistic regression', 'Majority baseline'].map((k) => {
                      const r = model.metrics.cv[k];
                      if (!r) return null;
                      return (
                        <tr key={k} className="border-t border-white/5">
                          <td className="py-1.5" style={k === 'XGBoost' ? { color: ACCENT } : undefined}>{k}</td>
                          <td className="text-right font-mono">{(r.cv_acc * 100).toFixed(1)}<span className="text-text-tertiary"> ±{(r.cv_acc_sd * 100).toFixed(1)}</span></td>
                          <td className="text-right font-mono">{(r.cv_bal * 100).toFixed(1)}</td>
                          <td className="text-right font-mono">{r.cv_auc.toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <p className="text-xs text-text-secondary mt-4 leading-relaxed">
                  Across 50 different splits, accuracy sits near the majority baseline, so the single held-out split above is a
                  favourable one. An AUC around 0.72–0.78 shows the EEG features do carry a modest signal.
                </p>
              </section>

              <section className="glass-panel rounded-card-lg border border-white/10 p-6">
                <p className="text-xs uppercase tracking-widest text-text-secondary mb-3">Pipeline</p>
                <ol className="text-sm space-y-1.5">
                  {model.meta.pipeline.map((s, i) => (
                    <li key={s} className="flex gap-3"><span className="font-mono text-text-tertiary">{i + 1}</span>{s}</li>
                  ))}
                </ol>
                <p className="text-xs text-text-secondary mt-4 leading-relaxed">
                  {model.meta.features_in.toLocaleString()} EEG features (band power, coherence and four biomarkers) reduced to{' '}
                  {model.meta.components} components. {model.meta.n_train} training and {model.meta.n_test} test subjects; {model.meta.split.toLowerCase()}.
                </p>
              </section>
            </div>

            {/* Right: subjects */}
            <div className="flex flex-col gap-6 min-w-0">
              <section className="glass-panel rounded-card-lg border border-white/10 p-6">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <p className="text-xs uppercase tracking-widest text-text-secondary">73 held-out subjects</p>
                  <div className="flex glass-panel rounded-pill p-1 border border-white/5 text-xs">
                    {(['all', 'wrong', 'healthy', 'mood'] as Filter[]).map((f) => (
                      <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`px-3 py-1 rounded-pill transition-colors ${filter === f ? 'bg-white/10 text-text-primary' : 'text-text-secondary hover:text-text-primary'}`}
                      >
                        {f === 'all' ? 'All' : f === 'wrong' ? 'Misclassified' : f === 'healthy' ? 'Healthy' : 'Mood'}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(52px,1fr))] gap-1.5">
                  {visible.map((r) => (
                    <button
                      key={r.s.id}
                      onClick={() => setSelected(r.i)}
                      title={`Subject ${r.s.id}: ${model.meta.labels[r.s.truth]}, predicted ${model.meta.labels[r.pred]}`}
                      className={`relative h-9 rounded-lg text-xs font-mono transition-all border ${selected === r.i ? 'scale-105' : 'hover:bg-white/5'}`}
                      style={{
                        borderColor: selected === r.i ? ACCENT : r.correct ? 'rgba(255,255,255,0.08)' : `${MOOD}88`,
                        background: selected === r.i ? `${ACCENT}1a` : undefined,
                      }}
                    >
                      <span className="absolute left-1.5 top-1.5 w-1.5 h-1.5 rounded-full" style={{ background: r.s.truth ? MOOD : HEALTHY }} />
                      {r.s.id}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-text-tertiary mt-3 flex flex-wrap gap-x-4 gap-y-1">
                  <span><span className="inline-block w-1.5 h-1.5 rounded-full mr-1.5" style={{ background: HEALTHY }} />healthy control</span>
                  <span><span className="inline-block w-1.5 h-1.5 rounded-full mr-1.5" style={{ background: MOOD }} />mood disorder</span>
                  <span><span className="inline-block w-3 h-2.5 rounded border mr-1.5 align-middle" style={{ borderColor: `${MOOD}88` }} />misclassified</span>
                </p>
              </section>

              <section className="glass-panel rounded-card-lg border border-white/10 p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-text-secondary">Subject {cur.s.id}</p>
                    <p className="text-lg mt-1">
                      Actual: <span style={{ color: cur.s.truth ? MOOD : HEALTHY }}>{model.meta.labels[cur.s.truth]}</span>
                    </p>
                  </div>
                  <span
                    className="px-3 py-1 rounded-pill text-xs uppercase tracking-wider border"
                    style={{ borderColor: cur.correct ? `${HEALTHY}55` : `${MOOD}88`, color: cur.correct ? HEALTHY : MOOD }}
                  >
                    {cur.correct ? 'Correct' : 'Misclassified'}
                  </span>
                </div>

                <div className="mt-5">
                  <div className="flex justify-between text-xs text-text-secondary mb-1.5">
                    <span>Healthy control</span>
                    <span>Model: {pct(cur.p, 1)} mood disorder</span>
                    <span>Mood disorder</span>
                  </div>
                  <div className="relative h-3 rounded-pill overflow-hidden" style={{ background: `linear-gradient(90deg, ${HEALTHY}33, ${MOOD}33)` }}>
                    <div className="absolute top-0 bottom-0 w-px bg-white/40" style={{ left: '50%' }} />
                    <div
                      className="absolute top-1/2 w-4 h-4 -mt-2 -ml-2 rounded-full border-2 border-white transition-all duration-500"
                      style={{ left: `${cur.p * 100}%`, background: cur.pred ? MOOD : HEALTHY }}
                    />
                  </div>
                </div>

                <div className="grid gap-6 md:grid-cols-2 mt-7">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-text-secondary mb-3">Why: top SHAP contributions</p>
                    <div className="space-y-2.5">
                      {cur.s.shap.map((c) => {
                        const max = Math.max(...cur.s.shap.map((x) => Math.abs(x.v))) || 1;
                        const w = (Math.abs(c.v) / max) * 50;
                        return (
                          <div key={c.pc}>
                            <div className="flex justify-between text-xs">
                              <span className="font-mono">PC{c.pc + 1}</span>
                              <span style={{ color: c.v > 0 ? MOOD : HEALTHY }}>{c.v > 0 ? 'toward mood' : 'toward healthy'}</span>
                            </div>
                            <div className="relative h-1.5 bg-white/5 rounded-pill mt-1">
                              <div className="absolute top-0 bottom-0 w-px bg-white/30" style={{ left: '50%' }} />
                              <div
                                className="absolute top-0 bottom-0 rounded-pill"
                                style={{ left: c.v > 0 ? '50%' : `${50 - w}%`, width: `${w}%`, background: c.v > 0 ? MOOD : HEALTHY }}
                              />
                            </div>
                            <p className="text-[11px] text-text-tertiary mt-1 truncate">{model.components[c.pc].join(' · ')}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-widest text-text-secondary mb-3">Biomarkers vs group medians</p>
                    <div className="space-y-3.5">
                      {BIOMARKERS.map((b) => {
                        const v = cur.s.bio[b.key];
                        const h = model.medians.healthy[b.key];
                        const m = model.medians.mood[b.key];
                        const lo = Math.min(v, h, m), hi = Math.max(v, h, m);
                        const span = hi - lo || 1;
                        const pos = (x: number) => `${8 + ((x - lo) / span) * 84}%`;
                        return (
                          <div key={b.key} title={b.hint}>
                            <div className="flex justify-between text-xs">
                              <span>{b.label}</span>
                              <span className="font-mono text-text-secondary">{v.toFixed(3)}</span>
                            </div>
                            <div className="relative h-4 mt-1">
                              <div className="absolute left-0 right-0 top-1/2 h-px bg-white/10" />
                              <span className="absolute top-1/2 -mt-1 w-2 h-2 rounded-full -ml-1" style={{ left: pos(h), background: HEALTHY, opacity: 0.6 }} />
                              <span className="absolute top-1/2 -mt-1 w-2 h-2 rounded-full -ml-1" style={{ left: pos(m), background: MOOD, opacity: 0.6 }} />
                              <span className="absolute top-1/2 -mt-1.5 w-3 h-3 rounded-full -ml-1.5 border-2 border-white" style={{ left: pos(v), background: ACCENT }} />
                            </div>
                          </div>
                        );
                      })}
                      <p className="text-[11px] text-text-tertiary">
                        <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ background: ACCENT }} />this subject ·
                        <span className="inline-block w-2 h-2 rounded-full mx-1.5" style={{ background: HEALTHY }} />healthy median ·
                        <span className="inline-block w-2 h-2 rounded-full mx-1.5" style={{ background: MOOD }} />mood median (training set)
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              <section className="glass-panel rounded-card-lg border border-white/10 p-6">
                <p className="text-xs uppercase tracking-widest text-text-secondary mb-3">Most influential components across all test subjects</p>
                <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2">
                  {model.global_shap.map((g) => (
                    <div key={g.pc} className="text-xs">
                      <span className="font-mono" style={{ color: ACCENT }}>PC{g.pc + 1}</span>
                      <span className="text-text-tertiary"> · mean |SHAP| {g.imp.toFixed(3)}</span>
                      <p className="text-text-secondary truncate">{g.made_of.join(' · ')}</p>
                    </div>
                  ))}
                </div>
              </section>

              <p className="flex gap-2 text-xs text-text-tertiary leading-relaxed pb-4">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                Research demo on the public, de-identified {model.meta.dataset.replace(' (public, de-identified)', '')}. Predictions are computed in
                your browser by the exported XGBoost model. Educational only, not a diagnostic tool.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function Cell({ n, good }: { n: number; good?: boolean }) {
  return (
    <span
      className="py-2.5 rounded-lg font-mono text-sm"
      style={{ background: good ? `${HEALTHY}14` : `${MOOD}14`, border: `1px solid ${good ? HEALTHY : MOOD}33` }}
    >
      {n}
    </span>
  );
}
