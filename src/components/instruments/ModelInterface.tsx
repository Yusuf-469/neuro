import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ChevronDown, Cpu, Download, FlaskConical, Info, RotateCcw, Upload } from 'lucide-react';
import { IconButton } from '../ui/Button';
import {
  BIOMARKERS,
  contributions,
  loadNeuroModel,
  loadPipeline,
  predictProba,
  transform,
  type NeuroModel,
  type Pipeline,
} from '../../lib/neuroModel';
import {
  BANDS,
  BIO_TEXT,
  NO_CHANGE,
  applyAdjustments,
  buildGroups,
  isUnchanged,
  levelText,
  parseRecordings,
  reasons,
  verdict,
  type Adjustments,
  type Band,
  type Recording,
} from '../../lib/neuroExplain';

interface ModelInterfaceProps {
  onBack: () => void;
}

type Filter = 'all' | 'wrong' | 'healthy' | 'mood';
type Source = 'examples' | 'upload';

const HEALTHY = '#00D4FF';
const MOOD = '#FF006E';
const ACCENT = '#FFD60A';
const MAX_FILE_MB = 20;

const pct = (v: number, d = 1) => `${(v * 100).toFixed(d)}%`;

// Slider position (-1..1) <-> factor. Strength: x0.5 to x2. Sync: 60% to 140%.
const toFactor = (mode: 'power' | 'sync', v: number) => (mode === 'power' ? 2 ** v : 1 + 0.4 * v);
const toSlider = (mode: 'power' | 'sync', f: number) => (mode === 'power' ? Math.log2(f) : (f - 1) / 0.4);
const factorText = (f: number) =>
  Math.abs(f - 1) < 0.005 ? 'unchanged' : f > 1 ? `${Math.round((f - 1) * 100)}% more` : `${Math.round((1 - f) * 100)}% less`;

export function ModelInterface({ onBack }: ModelInterfaceProps) {
  const [model, setModel] = useState<NeuroModel | null>(null);
  const [pipe, setPipe] = useState<Pipeline | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [source, setSource] = useState<Source>('examples');
  const [selected, setSelected] = useState(0);
  const [uploads, setUploads] = useState<Recording[]>([]);
  const [uploadSel, setUploadSel] = useState(0);
  const [uploadMsg, setUploadMsg] = useState<{ error: boolean; text: string } | null>(null);
  // Slider changes belong to one recording; picking another starts from unchanged brainwaves
  const [adjState, setAdjState] = useState<{ key: string; adj: Adjustments }>({ key: '', adj: NO_CHANGE });
  const [adjMode, setAdjMode] = useState<'power' | 'sync'>('power');
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadNeuroModel()
      .then((m) => {
        setModel(m);
        // open on a person the model classifies correctly
        const first = m.subjects.findIndex((s) => (predictProba(m, s.z) >= 0.5 ? 1 : 0) === s.truth);
        setSelected(Math.max(0, first));
        return loadPipeline(m).then(setPipe);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  const grouping = useMemo(() => (model ? buildGroups(model) : null), [model]);

  // Held-out results (used by the example picker and the research details)
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
      if (r.s.truth === 0) cm[r.pred === 0 ? 'tn' : 'fp']++;
      else cm[r.pred === 1 ? 'tp' : 'fn']++;
    });
    const correct = cm.tn + cm.tp;
    const maxDiff = rows.reduce((m, r) => Math.max(m, Math.abs(r.p - r.s.p)), 0);
    return { cm, correct, acc: rows.length ? correct / rows.length : 0, maxDiff };
  }, [rows]);

  // The recording being analysed
  const recording: Recording | null = useMemo(() => {
    if (!model || !pipe) return null;
    if (source === 'upload') return uploads[uploadSel] ?? null;
    const s = model.subjects[selected];
    return { name: `Person ${s.id}`, raw: Float64Array.from(pipe.examples[selected]), truth: s.truth, matched: pipe.R };
  }, [model, pipe, source, selected, uploads, uploadSel]);

  const recKey = source === 'upload' ? `u${uploadSel}:${uploads.length}:${uploads[uploadSel]?.name}` : `e${selected}`;
  const adj = adjState.key === recKey ? adjState.adj : NO_CHANGE;
  const setAdj = (next: Adjustments | ((a: Adjustments) => Adjustments)) =>
    setAdjState({ key: recKey, adj: typeof next === 'function' ? next(adj) : next });

  // Run the full model on the recording (and on the adjusted version, if the sliders moved)
  const analysis = useMemo(() => {
    if (!model || !pipe || !grouping || !recording) return null;
    const base = transform(pipe, recording.raw);
    const p0 = predictProba(model, base.z);
    const changed = !isUnchanged(adj);
    const cur = changed ? transform(pipe, applyAdjustments(model, recording.raw, adj)) : base;
    const p = changed ? predictProba(model, cur.z) : p0;
    const { phi } = contributions(model, cur.z);
    const top = reasons(pipe, grouping.groups, grouping.groupOf, cur.s, phi)
      .sort((a, b) => Math.abs(b.push) - Math.abs(a.push))
      .slice(0, 6);
    return { p, p0, changed, bio: cur.bio, top };
  }, [model, pipe, grouping, recording, adj]);

  const onFile = async (file: File | undefined) => {
    if (!file || !model || !pipe) return;
    setUploadMsg(null);
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      setUploadMsg({ error: true, text: `That file is larger than ${MAX_FILE_MB} MB.` });
      return;
    }
    try {
      const recs = parseRecordings(pipe, await file.text());
      const partial = recs.filter((r) => r.matched < pipe.R).length;
      setUploads(recs);
      setUploadSel(0);
      setUploadMsg({
        error: false,
        text:
          `Loaded ${recs.length} recording${recs.length === 1 ? '' : 's'} from ${file.name}.` +
          (partial ? ` ${partial} had missing measurements, which were filled with typical values, so treat those results with extra care.` : ''),
      });
    } catch (e) {
      setUploadMsg({ error: true, text: (e as Error).message });
    }
  };

  const visible = rows.filter((r) =>
    filter === 'all' ? true : filter === 'wrong' ? !r.correct : filter === 'healthy' ? r.s.truth === 0 : r.s.truth === 1,
  );

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
            <FlaskConical className="w-5 h-5" style={{ color: ACCENT }} /> Prediction Model
          </h1>
          <p className="text-xs uppercase tracking-widest text-text-secondary">Brainwave pattern check · research demo</p>
        </div>
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-pill glass-panel border border-white/10 text-xs text-text-secondary">
          <Cpu className="w-3.5 h-3.5" style={{ color: ACCENT }} /> Runs in your browser
        </div>
      </header>

      <main className="relative z-10 flex-1 overflow-y-auto">
        {error && <p className="p-8 text-center text-pink">{error}</p>}
        {!model && !error && <p className="p-8 text-center text-text-secondary">Loading model…</p>}

        {model && (
          <div className="max-w-6xl mx-auto p-5 md:p-8 flex flex-col gap-6">
            <section className="glass-panel rounded-card-lg border border-white/10 p-6">
              <h2 className="text-lg font-semibold">What this does</h2>
              <p className="text-sm text-text-secondary mt-2 leading-relaxed max-w-3xl">
                An EEG records the brain's electrical rhythms ("brainwaves") through small sensors on the scalp. This model looks at a
                resting EEG and estimates whether its pattern looks more like people diagnosed with a <span className="text-text-primary">mood disorder</span>{' '}
                (such as depression or bipolar disorder) or like <span className="text-text-primary">healthy volunteers</span>. It was trained on{' '}
                {model.meta.n_train} people. Choose a recording below, or upload your own, and it will show its answer and the reasons for it.
              </p>
            </section>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
              {/* Step 1: choose a recording */}
              <section className="glass-panel rounded-card-lg border border-white/10 p-6 min-w-0">
                <StepTitle n={1} title="Choose a recording" />
                <div className="flex glass-panel rounded-pill p-1 border border-white/5 text-sm mt-4 w-fit">
                  {(['examples', 'upload'] as Source[]).map((s) => (
                    <button
                      key={s}
                      onClick={() => setSource(s)}
                      className={`px-4 py-1.5 rounded-pill transition-colors ${source === s ? 'bg-white/10 text-text-primary' : 'text-text-secondary hover:text-text-primary'}`}
                    >
                      {s === 'examples' ? 'Example people' : 'Upload a file'}
                    </button>
                  ))}
                </div>

                {source === 'examples' ? (
                  <div className="mt-5">
                    <p className="text-sm text-text-secondary leading-relaxed">
                      These {rows.length} people were kept aside and never shown to the model while it learned, so they are a fair test.
                      The dot shows their real diagnosis.
                    </p>
                    <div className="flex flex-wrap gap-1 mt-4 text-xs">
                      {(['all', 'healthy', 'mood', 'wrong'] as Filter[]).map((f) => (
                        <button
                          key={f}
                          onClick={() => setFilter(f)}
                          className={`px-3 py-1 rounded-pill border transition-colors ${filter === f ? 'bg-white/10 border-white/20 text-text-primary' : 'border-white/5 text-text-secondary hover:text-text-primary'}`}
                        >
                          {f === 'all' ? 'Everyone' : f === 'healthy' ? 'Healthy' : f === 'mood' ? 'Mood disorder' : 'Model got wrong'}
                        </button>
                      ))}
                    </div>
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(52px,1fr))] gap-1.5 mt-3 max-h-64 overflow-y-auto pr-1">
                      {visible.map((r) => (
                        <button
                          key={r.s.id}
                          onClick={() => setSelected(r.i)}
                          title={`Person ${r.s.id}: ${model.meta.labels[r.s.truth]}`}
                          className={`relative h-9 rounded-lg text-xs font-mono transition-all border ${selected === r.i ? 'scale-105' : 'hover:bg-white/5'}`}
                          style={{
                            borderColor: selected === r.i ? ACCENT : 'rgba(255,255,255,0.08)',
                            background: selected === r.i ? `${ACCENT}1a` : undefined,
                          }}
                        >
                          <span className="absolute left-1.5 top-1.5 w-1.5 h-1.5 rounded-full" style={{ background: r.s.truth ? MOOD : HEALTHY }} />
                          {r.s.id}
                        </button>
                      ))}
                    </div>
                    <p className="text-[11px] text-text-tertiary mt-3 flex flex-wrap gap-x-4 gap-y-1">
                      <span><Dot color={HEALTHY} />healthy volunteer</span>
                      <span><Dot color={MOOD} />diagnosed mood disorder</span>
                    </p>
                  </div>
                ) : (
                  <div className="mt-5">
                    <p className="text-sm text-text-secondary leading-relaxed">
                      Upload a CSV with one recording per row, using the same measurements as the research dataset (brainwave strength and sync
                      at the 19 standard EEG positions). The file is read in your browser and never uploaded anywhere.
                    </p>
                    <div
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        onFile(e.dataTransfer.files[0]);
                      }}
                      onClick={() => fileInput.current?.click()}
                      className="mt-4 rounded-card border border-dashed border-white/15 hover:border-white/30 transition-colors p-6 text-center cursor-pointer"
                    >
                      <Upload className="w-6 h-6 mx-auto text-text-secondary" />
                      <p className="text-sm mt-2">Drop a .csv file here or click to choose</p>
                      <input
                        ref={fileInput}
                        type="file"
                        accept=".csv,text/csv"
                        className="hidden"
                        onChange={(e) => {
                          onFile(e.target.files?.[0]);
                          e.target.value = '';
                        }}
                      />
                    </div>
                    <a
                      href="/research/sample-eeg.csv"
                      download
                      className="inline-flex items-center gap-1.5 text-xs mt-3 hover:underline"
                      style={{ color: ACCENT }}
                    >
                      <Download className="w-3.5 h-3.5" /> Download a sample file (6 real recordings) to try it
                    </a>
                    {uploadMsg && <p className={`text-xs mt-3 leading-relaxed ${uploadMsg.error ? 'text-pink' : 'text-text-secondary'}`}>{uploadMsg.text}</p>}
                    {uploads.length > 1 && (
                      <div className="flex flex-wrap gap-1.5 mt-4 max-h-40 overflow-y-auto">
                        {uploads.map((u, i) => (
                          <button
                            key={i}
                            onClick={() => setUploadSel(i)}
                            className="px-3 py-1 rounded-lg text-xs border transition-colors"
                            style={{ borderColor: uploadSel === i ? ACCENT : 'rgba(255,255,255,0.08)', background: uploadSel === i ? `${ACCENT}1a` : undefined }}
                          >
                            {u.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </section>

              {/* Step 2: result */}
              <section className="glass-panel rounded-card-lg border border-white/10 p-6 min-w-0">
                <StepTitle n={2} title="The model's answer" />
                {!pipe && <p className="text-sm text-text-secondary mt-4">Loading the model…</p>}
                {pipe && !recording && <p className="text-sm text-text-secondary mt-4">Upload a file to see a result.</p>}
                {analysis && recording && <Verdict model={model} recording={recording} p={analysis.p} p0={analysis.p0} changed={analysis.changed} />}
              </section>
            </div>

            {analysis && recording && (
              <div className="grid gap-6 lg:grid-cols-2">
                {/* Step 3: reasons */}
                <section className="glass-panel rounded-card-lg border border-white/10 p-6 min-w-0">
                  <StepTitle n={3} title="Why it said that" />
                  <p className="text-sm text-text-secondary mt-2 leading-relaxed">
                    The measurements that moved the answer most for {recording.name.toLowerCase().startsWith('person') ? 'this person' : 'this recording'}.
                    A bar to the <span style={{ color: HEALTHY }}>left</span> pushed toward the healthy pattern, to the{' '}
                    <span style={{ color: MOOD }}>right</span> toward the mood-disorder pattern. Longer means stronger.
                  </p>
                  <div className="space-y-4 mt-5">
                    {analysis.top.map((r) => {
                      const max = Math.abs(analysis.top[0].push) || 1;
                      const w = (Math.abs(r.push) / max) * 50;
                      const toMood = r.push > 0;
                      return (
                        <div key={r.group.key}>
                          <p className="text-sm leading-snug">{r.group.label}</p>
                          <div className="relative h-2 bg-white/5 rounded-pill mt-1.5">
                            <div className="absolute top-0 bottom-0 w-px bg-white/30" style={{ left: '50%' }} />
                            <div
                              className="absolute top-0 bottom-0 rounded-pill transition-all duration-300"
                              style={{ left: toMood ? '50%' : `${50 - w}%`, width: `${w}%`, background: toMood ? MOOD : HEALTHY }}
                            />
                          </div>
                          <p className="text-[11px] text-text-tertiary mt-1">
                            Here: <span className="text-text-secondary">{levelText(r.level)}</span> ·{' '}
                            <span style={{ color: toMood ? MOOD : HEALTHY }}>{toMood ? 'points toward mood disorder' : 'points toward healthy'}</span>
                          </p>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-[11px] text-text-tertiary mt-5 leading-relaxed">
                    "In sync" means two areas rise and fall together (EEG coherence). "Typical" is the average of the people the model learned from.
                  </p>
                </section>

                {/* Step 4: what if */}
                <section className="glass-panel rounded-card-lg border border-white/10 p-6 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <StepTitle n={4} title="Try it: change the brainwaves" />
                    <button
                      onClick={() => setAdj(NO_CHANGE)}
                      disabled={!analysis.changed}
                      className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary disabled:opacity-30 shrink-0"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Reset
                    </button>
                  </div>
                  <p className="text-sm text-text-secondary mt-2 leading-relaxed">
                    Turn each type of brainwave up or down and the model re-runs instantly. It shows what the model pays attention to, not how
                    to change a diagnosis.
                  </p>
                  <div className="flex glass-panel rounded-pill p-1 border border-white/5 text-xs mt-4 w-fit">
                    {(['power', 'sync'] as const).map((m) => (
                      <button
                        key={m}
                        onClick={() => setAdjMode(m)}
                        className={`px-3 py-1 rounded-pill transition-colors ${adjMode === m ? 'bg-white/10 text-text-primary' : 'text-text-secondary hover:text-text-primary'}`}
                      >
                        {m === 'power' ? 'Strength' : 'How in sync'}
                      </button>
                    ))}
                  </div>
                  <div className="space-y-3.5 mt-4">
                    {BANDS.map((b) => {
                      const f = adj[adjMode][b.key];
                      return (
                        <div key={b.key}>
                          <div className="flex justify-between text-xs">
                            <span>
                              <span style={{ color: b.color }}>{b.name}</span>
                              <span className="text-text-secondary"> · {b.plain}</span>
                            </span>
                            <span className="font-mono text-text-secondary">{factorText(f)}</span>
                          </div>
                          <input
                            type="range"
                            min={-1}
                            max={1}
                            step={0.05}
                            value={toSlider(adjMode, f)}
                            aria-label={`${b.name} ${adjMode === 'power' ? 'strength' : 'sync'}`}
                            onChange={(e) => {
                              const v = toFactor(adjMode, Number(e.target.value));
                              setAdj((a) => ({ ...a, [adjMode]: { ...a[adjMode], [b.key as Band]: Math.round(v * 1000) / 1000 } }));
                            }}
                            className="w-full mt-1"
                            style={{ accentColor: b.color }}
                          />
                          <p className="text-[11px] text-text-tertiary -mt-0.5">{b.hint}</p>
                        </div>
                      );
                    })}
                  </div>
                </section>

                {/* Step 5: markers */}
                <section className="glass-panel rounded-card-lg border border-white/10 p-6 lg:col-span-2">
                  <StepTitle n={5} title="Four well-known brain markers" />
                  <p className="text-sm text-text-secondary mt-2 leading-relaxed">
                    Researchers have linked these simple measures to mood. The marks show where this recording sits next to the typical
                    healthy and mood-disorder person the model learned from.
                  </p>
                  <div className="grid gap-x-8 gap-y-5 md:grid-cols-2 mt-5">
                    {BIOMARKERS.map((b) => {
                      const v = analysis.bio[b.key];
                      const h = model.medians.healthy[b.key];
                      const m = model.medians.mood[b.key];
                      const lo = Math.min(v, h, m), hi = Math.max(v, h, m);
                      const span = hi - lo || 1;
                      const pos = (x: number) => `${8 + ((x - lo) / span) * 84}%`;
                      const closer = Math.abs(v - h) <= Math.abs(v - m) ? 'healthy' : 'mood';
                      return (
                        <div key={b.key}>
                          <p className="text-sm">{BIO_TEXT[b.key]}</p>
                          <p className="text-[11px] text-text-tertiary">{b.label} · {b.hint}</p>
                          <div className="relative h-5 mt-1.5">
                            <div className="absolute left-0 right-0 top-1/2 h-px bg-white/10" />
                            <span className="absolute top-1/2 -mt-1 w-2 h-2 rounded-full -ml-1" style={{ left: pos(h), background: HEALTHY, opacity: 0.7 }} />
                            <span className="absolute top-1/2 -mt-1 w-2 h-2 rounded-full -ml-1" style={{ left: pos(m), background: MOOD, opacity: 0.7 }} />
                            <span className="absolute top-1/2 -mt-1.5 w-3 h-3 rounded-full -ml-1.5 border-2 border-white transition-all duration-300" style={{ left: pos(v), background: ACCENT }} />
                          </div>
                          <p className="text-xs" style={{ color: closer === 'healthy' ? HEALTHY : MOOD }}>
                            Closer to the typical {closer === 'healthy' ? 'healthy' : 'mood-disorder'} person
                          </p>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-[11px] text-text-tertiary mt-4">
                    <Dot color={ACCENT} />this recording · <Dot color={HEALTHY} />typical healthy · <Dot color={MOOD} />typical mood disorder.
                    On their own these markers overlap a lot between groups, which is why the model combines {model.meta.features_in.toLocaleString()} measurements.
                  </p>
                </section>
              </div>
            )}

            {/* How good is it, in plain words */}
            <section className="glass-panel rounded-card-lg border border-white/10 p-6">
              <h2 className="text-lg font-semibold">How much should you trust it?</h2>
              <div className="grid gap-4 sm:grid-cols-3 mt-4">
                <Stat big={`${summary.correct} / ${rows.length}`} text="people it had never seen were classified correctly" />
                <Stat big={pct(model.metrics.cv.XGBoost?.cv_acc ?? 0, 0)} text="average accuracy over 50 different random tests" />
                <Stat big={pct(model.metrics.heldout_baseline, 0)} text="what you would get by always guessing the larger group" />
              </div>
              <p className="text-sm text-text-secondary mt-4 leading-relaxed max-w-3xl">
                In plain terms: the brainwave patterns carry a real but modest signal. On average the model is not much better than a simple
                guess, so a single result means little on its own. This is a student research project, not a medical test, and it cannot
                diagnose anyone. If you are worried about your mood, please talk to a doctor or a mental-health professional.
              </p>
            </section>

            {/* Research details */}
            <details className="group glass-panel rounded-card-lg border border-white/10">
              <summary className="cursor-pointer list-none flex items-center justify-between p-6">
                <span>
                  <span className="text-lg font-semibold">For researchers</span>
                  <span className="text-sm text-text-secondary"> · evaluation, cross-validation and pipeline</span>
                </span>
                <ChevronDown className="w-5 h-5 text-text-secondary transition-transform group-open:rotate-180" />
              </summary>
              <div className="px-6 pb-6 grid gap-6 lg:grid-cols-3">
                <div>
                  <p className="text-xs uppercase tracking-widest text-text-secondary mb-3">Held-out test set · report split</p>
                  <div className="flex items-baseline gap-3">
                    <span className="text-4xl font-semibold" style={{ color: ACCENT }}>{pct(summary.acc, 2)}</span>
                    <span className="text-text-secondary text-sm">{summary.correct} of {rows.length}</span>
                  </div>
                  <div className="grid grid-cols-[auto_1fr_1fr] gap-1.5 mt-4 text-xs text-center">
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
                  <p className="text-[11px] text-text-tertiary mt-3">
                    The browser model matches the Python model on every subject (largest probability difference {summary.maxDiff.toExponential(1)}).
                  </p>
                </div>

                <div>
                  <p className="text-xs uppercase tracking-widest text-text-secondary mb-3">Repeated cross-validation · 10 × 5-fold</p>
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
                  <p className="text-xs text-text-secondary mt-3 leading-relaxed">
                    Across 50 splits accuracy sits near the majority baseline, so the held-out split is a favourable one; AUC around 0.72–0.78
                    shows a modest signal.
                  </p>
                </div>

                <div>
                  <p className="text-xs uppercase tracking-widest text-text-secondary mb-3">Pipeline</p>
                  <ol className="text-sm space-y-1.5">
                    {model.meta.pipeline.map((s, i) => (
                      <li key={s} className="flex gap-3"><span className="font-mono text-text-tertiary">{i + 1}</span>{s}</li>
                    ))}
                  </ol>
                  <p className="text-xs text-text-secondary mt-3 leading-relaxed">
                    {model.meta.features_in.toLocaleString()} features (114 band powers, 1,026 coherences, 4 biomarkers) reduced to{' '}
                    {model.meta.components} components; {model.meta.n_train} training and {model.meta.n_test} test subjects,{' '}
                    {model.meta.split.toLowerCase()}. Uploaded recordings go through the same training-set scaling and projection. The reasons
                    above use path attribution on the trees (as XGBoost's approximate contributions), shared out to the measurements behind
                    each component.
                  </p>
                </div>
              </div>
            </details>

            <p className="flex gap-2 text-xs text-text-tertiary leading-relaxed pb-4">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              Trained on the public, de-identified {model.meta.dataset.replace(' (public, de-identified)', '')}. Everything runs in your browser;
              recordings you upload are not sent anywhere. Educational only, not a diagnostic tool.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

function Verdict({ model, recording, p, p0, changed }: { model: NeuroModel; recording: Recording; p: number; p0: number; changed: boolean }) {
  const v = verdict(p);
  const color = v.leansMood ? MOOD : HEALTHY;
  const pred = v.leansMood ? 1 : 0;
  return (
    <div className="mt-4">
      <p className="text-xs uppercase tracking-widest text-text-secondary">{recording.name}</p>
      <p className="text-2xl font-semibold mt-1 leading-snug">
        <span style={{ color }}>{v.strength}</span> closer to the{' '}
        <span style={{ color }}>{v.leansMood ? 'mood-disorder' : 'healthy'}</span> pattern
      </p>

      <div className="mt-5">
        <div className="relative h-3 rounded-pill overflow-hidden" style={{ background: `linear-gradient(90deg, ${HEALTHY}40, ${MOOD}40)` }}>
          <div className="absolute top-0 bottom-0 w-px bg-white/40" style={{ left: '50%' }} />
          {changed && <div className="absolute top-1/2 w-2.5 h-2.5 -mt-[5px] -ml-[5px] rounded-full bg-white/40" style={{ left: `${p0 * 100}%` }} />}
          <div className="absolute top-1/2 w-4 h-4 -mt-2 -ml-2 rounded-full border-2 border-white transition-all duration-300" style={{ left: `${p * 100}%`, background: color }} />
        </div>
        <div className="flex justify-between text-xs text-text-secondary mt-1.5">
          <span style={{ color: HEALTHY }}>Healthy pattern</span>
          <span style={{ color: MOOD }}>Mood-disorder pattern</span>
        </div>
      </div>

      <p className="text-sm text-text-secondary mt-4 leading-relaxed">
        Model score: <span className="text-text-primary font-mono">{Math.round(p * 100)}</span> out of 100 toward the mood-disorder pattern
        (50 is the dividing line). The score is how sure the model is, not how unwell someone is.
        {changed && (
          <>
            {' '}With your changes it moved from <span className="font-mono text-text-primary">{Math.round(p0 * 100)}</span> to{' '}
            <span className="font-mono text-text-primary">{Math.round(p * 100)}</span>.
          </>
        )}
      </p>

      {recording.truth !== undefined && (
        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-text-secondary">Real diagnosis:</span>
          <span style={{ color: recording.truth ? MOOD : HEALTHY }}>{model.meta.labels[recording.truth]}</span>
          {!changed && (
            <span
              className="px-2.5 py-0.5 rounded-pill text-xs border"
              style={{ borderColor: pred === recording.truth ? `${HEALTHY}55` : `${MOOD}88`, color: pred === recording.truth ? HEALTHY : MOOD }}
            >
              {pred === recording.truth ? 'model was right' : 'model was wrong'}
            </span>
          )}
        </div>
      )}
      {recording.matched < model.pipeline.raw.length && (
        <p className="text-xs text-pink mt-3">
          {model.pipeline.raw.length - recording.matched} of {model.pipeline.raw.length} measurements were missing and filled with typical values.
        </p>
      )}
    </div>
  );
}

function StepTitle({ n, title }: { n: number; title: string }) {
  return (
    <h2 className="flex items-center gap-2.5 text-lg font-semibold">
      <span className="w-6 h-6 rounded-full grid place-items-center text-xs font-mono text-black shrink-0" style={{ background: ACCENT }}>{n}</span>
      {title}
    </h2>
  );
}

function Stat({ big, text }: { big: string; text: string }) {
  return (
    <div className="rounded-card border border-white/5 p-4">
      <p className="text-2xl font-semibold" style={{ color: ACCENT }}>{big}</p>
      <p className="text-xs text-text-secondary mt-1 leading-relaxed">{text}</p>
    </div>
  );
}

function Dot({ color }: { color: string }) {
  return <span className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle" style={{ background: color }} />;
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
