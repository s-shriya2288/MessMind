import { useState } from 'react'
import {
  Area, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, LineChart, Pie, PieChart,
  ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis,
} from 'recharts'
import { Download } from 'lucide-react'
import {
  C, Card, Heatmap, Loading, Note, Stat, Table, Tabs, Tip, axisProps, btn2Cls, fmt, gridProps, useApi,
} from '../ui.jsx'
import { ForecastChart, Predictor, Recommendations } from '../components.jsx'

const STAGES = [
  { id: 'collect', label: '1 · Collect' },
  { id: 'clean', label: '2 · Clean' },
  { id: 'explore', label: '3 · Explore (EDA)' },
  { id: 'predict', label: '4 · Predict' },
  { id: 'evaluate', label: '5 · Evaluate' },
  { id: 'recommend', label: '6 · Recommend' },
  { id: 'report', label: 'Seaborn report' },
]

export default function DataLab({ sub, go }) {
  const stage = STAGES.some((s) => s.id === sub) ? sub : 'collect'
  return (
    <div className="space-y-6">
      <div>
        <div className="text-[11px] font-semibold tracking-[0.18em] text-brand-600">DATA SCIENCE WORKBENCH · PANDAS · NUMPY · SCIKIT-LEARN · MATPLOTLIB · SEABORN</div>
        <h1 className="text-3xl font-extrabold tracking-tight mt-1">Data Science Lab</h1>
        <p className="text-ink-2 mt-1 max-w-3xl">Follow the full pipeline on the synthetic hostel-mess dataset — from messy raw logs to a validated demand model and actionable recommendations.</p>
      </div>
      <Tabs tabs={STAGES} value={stage} onChange={(id) => go('lab', id)} />
      {stage === 'collect' && <Collect />}
      {stage === 'clean' && <Clean />}
      {stage === 'explore' && <Explore />}
      {stage === 'predict' && <Predict />}
      {stage === 'evaluate' && <Evaluate />}
      {stage === 'recommend' && <Recommend />}
      {stage === 'report' && <Report />}
    </div>
  )
}

// ======================================================================= 1 COLLECT
function Collect() {
  const { data, error } = useApi('/api/collect')
  if (!data) return <Loading error={error} />
  const missing = Object.entries(data.missing).map(([k, v]) => ({ col: k, missing: v }))
  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {data.tables.map((t) => (
          <div key={t.name} className="bg-white rounded-2xl border border-stone-200 p-4">
            <div className="text-xs font-semibold text-brand-600">{t.name}</div>
            <div className="text-2xl font-bold tabular-nums mt-1">{fmt(t.rows, 0)} <span className="text-xs font-medium text-ink-2">rows</span></div>
            <div className="text-[11px] text-ink-2 mt-2 leading-relaxed">{t.cols.join(' · ')}</div>
          </div>
        ))}
      </div>
      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2" title="Raw Daily_Consumption sample (as entered)" subtitle="Notice the problems: NaN cells, quantities logged in grams, inconsistent meal_type spelling, typo outliers.">
          <Table dense rows={data.sample} columns={[
            { key: 'date' }, { key: 'meal_type', render: (r) => <code className="bg-stone-100 px-1 rounded">"{r.meal_type}"</code> },
            { key: 'dish' }, { key: 'attendance', cls: (r) => (r.attendance > 1000 ? 'text-red-700 font-semibold' : '') },
            { key: 'prepared_kg', cls: (r) => (r.unit === 'g' ? 'text-amber-700 font-semibold' : '') },
            { key: 'consumed_kg', cls: (r) => (r.unit === 'g' ? 'text-amber-700 font-semibold' : '') },
            { key: 'rating' }, { key: 'unit' }, { key: 'event_flag' },
          ]} />
        </Card>
        <Card title="Missing values per column" subtitle="Count of NaN cells in the raw table (all messes)">
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={missing} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid {...gridProps} horizontal={false} vertical />
                <XAxis type="number" {...axisProps} />
                <YAxis type="category" dataKey="col" {...axisProps} width={90} />
                <Tooltip content={<Tip unit=" cells" />} cursor={{ fill: '#f4f3ef' }} />
                <Bar dataKey="missing" name="Missing" fill={C.s2} radius={[0, 4, 4, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <Note>Sources: anonymous student surveys (Google Forms), daily preparation and leftover records, inventory and expiry logs, hostel mess records. Public Kaggle/FAO datasets can be used for initial experimentation; actual hostel data is reserved for validation.</Note>
        </Card>
      </div>
    </div>
  )
}

// ======================================================================= 2 CLEAN
function Clean() {
  const { data, error } = useApi('/api/clean')
  if (!data) return <Loading error={error} />
  const steps = data.steps.filter((s) => s.step !== 'Recompute leftovers')
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Rows in" value={fmt(data.rows_in, 0)} />
        <Stat label="Rows out" value={fmt(data.rows_out, 0)} hint={`${data.rows_in - data.rows_out} duplicates removed`} />
        <Stat label="Missing cells before" value={fmt(Object.values(data.missing_before).reduce((a, b) => a + b, 0), 0)} tone="bad" />
        <Stat label="Missing cells after" value={fmt(Object.values(data.missing_after).reduce((a, b) => a + b, 0), 0)} tone="good" />
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <Card title="Preprocessing steps" subtitle="Applied in order by messmind/preprocessing.py">
          <ol className="space-y-2">
            {data.steps.map((s, i) => (
              <li key={s.step} className="flex gap-3 rounded-xl bg-stone-50 px-3 py-2.5">
                <span className="w-6 h-6 rounded-full bg-brand-600 text-white grid place-items-center text-xs font-bold shrink-0">{i + 1}</span>
                <div className="flex-1">
                  <div className="text-sm font-semibold">{s.step}</div>
                  <div className="text-xs text-ink-2">{s.detail}</div>
                </div>
                <div className="text-sm font-bold tabular-nums text-ink">{fmt(s.rows_affected, 0)}<span className="text-[11px] font-normal text-ink-2"> rows</span></div>
              </li>
            ))}
          </ol>
        </Card>
        <Card title="Rows fixed by each step" subtitle="How much each cleaning operation changed">
          <div className="h-80">
            <ResponsiveContainer>
              <BarChart data={steps} layout="vertical" margin={{ left: 20, right: 30 }}>
                <CartesianGrid {...gridProps} horizontal={false} vertical />
                <XAxis type="number" {...axisProps} />
                <YAxis type="category" dataKey="step" {...axisProps} width={150} />
                <Tooltip content={<Tip unit=" rows" />} cursor={{ fill: '#f4f3ef' }} />
                <Bar dataKey="rows_affected" name="Rows affected" fill={C.s1} radius={[0, 4, 4, 0]} barSize={18} label={{ position: 'right', fontSize: 11, fill: C.ink2 }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
      <Card title="Cleaned sample with engineered fields" subtitle="Units in kg, categories standardised, leftovers recomputed, waste % and weekday extracted.">
        <Table dense rows={data.sample} columns={['date', 'meal_type', 'dish', 'attendance', 'prepared_kg', 'consumed_kg', 'leftover_kg', 'waste_pct', 'rating', 'weekday', 'event_flag', 'holiday_flag'].map((k) => ({ key: k }))} />
      </Card>
    </div>
  )
}

// ======================================================================= 3 EXPLORE
function Explore() {
  const [mess, setMess] = useState('Hostel A')
  const { data, error } = useApi(`/api/eda?mess=${encodeURIComponent(mess)}`)
  if (!data) return <Loading error={error} />
  const k = data.kpis
  const dishTop = [...data.dish_waste].sort((a, b) => b.waste_pct - a.waste_pct)
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-ink-2">Mess:</span>
        <Tabs tabs={['Hostel A', 'Hostel B', 'Hostel C'].map((m) => ({ id: m, label: m }))} value={mess} onChange={setMess} />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Stat label="Avg attendance" value={fmt(k.avg_attendance, 0)} hint="students per meal" />
        <Stat label="Prepared" value={fmt(k.prepared_kg, 0)} unit="kg" />
        <Stat label="Left over" value={fmt(k.leftover_kg, 0)} unit="kg" tone="bad" hint={`${k.leftover_per_day_kg} kg/day`} />
        <Stat label="Waste rate" value={`${k.waste_pct}%`} tone="bad" />
        <Stat label="Avg rating" value={k.avg_rating} unit="/ 5" />
      </div>

      <Card title="Descriptive statistics" subtitle="pandas DataFrame.describe() + skewness">
        <Table dense rows={data.describe} columns={['column', 'count', 'mean', 'std', 'min', '25%', '50%', '75%', 'max', 'skew'].map((k) => ({ key: k }))} />
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card title="Most- and least-wasted dishes" subtitle="Average leftover as % of prepared quantity">
          <div className="h-96">
            <ResponsiveContainer>
              <BarChart data={dishTop} layout="vertical" margin={{ left: 20, right: 30 }}>
                <CartesianGrid {...gridProps} horizontal={false} vertical />
                <XAxis type="number" {...axisProps} unit="%" />
                <YAxis type="category" dataKey="dish" {...axisProps} width={140} />
                <Tooltip content={<DishTip />} cursor={{ fill: '#f4f3ef' }} />
                <Bar dataKey="waste_pct" name="Waste %" radius={[0, 4, 4, 0]} barSize={16}>
                  {dishTop.map((d, i) => <Cell key={d.dish} fill={i < 4 ? C.s2 : i >= dishTop.length - 4 ? C.s3 : C.muted} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <Note><span className="inline-block w-2.5 h-2.5 rounded-sm align-middle mr-1" style={{ background: C.s2 }} />4 most wasted · <span className="inline-block w-2.5 h-2.5 rounded-sm align-middle mx-1" style={{ background: C.s3 }} />4 least wasted. Hover for rating and cost.</Note>
        </Card>
        <Card title={`Attendance vs consumption (r = ${data.scatter.r})`} subtitle={`Linear fit: consumed ≈ ${data.scatter.slope} × attendance + ${data.scatter.intercept}`}>
          <div className="h-96">
            <ResponsiveContainer>
              <ComposedChart margin={{ left: -5, right: 10 }}>
                <CartesianGrid {...gridProps} vertical />
                <XAxis type="number" dataKey="attendance" name="Attendance" {...axisProps} domain={['dataMin - 10', 'dataMax + 10']} />
                <YAxis type="number" dataKey="consumed" name="Consumed (kg)" {...axisProps} />
                <ZAxis range={[36, 36]} />
                <Tooltip content={<Tip />} />
                <Legend />
                <Scatter name="Lunch" data={data.scatter.points.filter((p) => p.meal === 'Lunch')} fill={C.s1} fillOpacity={0.6} />
                <Scatter name="Dinner" data={data.scatter.points.filter((p) => p.meal === 'Dinner')} fill={C.s2} fillOpacity={0.6} />
                <Line data={data.scatter.line} dataKey="fit" name="Linear fit" stroke="#0b0b0b" strokeWidth={2} dot={false} legendType="plainline" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card title="Daily trend: prepared vs consumed" subtitle="Daily totals (kg) with a 7-day rolling mean of leftovers below">
        <div className="h-72">
          <ResponsiveContainer>
            <LineChart data={data.daily} margin={{ left: -10, right: 8 }}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="date" {...axisProps} minTickGap={50} tickFormatter={(d) => d.slice(5)} />
              <YAxis {...axisProps} domain={['auto', 'auto']} />
              <Tooltip content={<Tip unit=" kg" />} />
              <Legend iconType="plainline" />
              <Line dataKey="prepared" name="Prepared" stroke={C.s2} strokeWidth={1.6} dot={false} />
              <Line dataKey="consumed" name="Consumed" stroke={C.s1} strokeWidth={1.6} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="h-40 mt-2">
          <ResponsiveContainer>
            <ComposedChart data={data.daily} margin={{ left: -10, right: 8 }}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="date" {...axisProps} minTickGap={50} tickFormatter={(d) => d.slice(5)} />
              <YAxis {...axisProps} />
              <Tooltip content={<Tip unit=" kg" />} />
              <Bar dataKey="leftover" name="Leftover (daily)" fill={C.s2} fillOpacity={0.35} />
              <Line dataKey="leftover_7d" name="Leftover 7-day mean" stroke={C.s2} strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card title="Weekly leftover" subtitle="Total kg left over per week">
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={data.weekly} margin={{ left: -10, right: 8 }}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="week" {...axisProps} minTickGap={20} />
                <YAxis {...axisProps} />
                <Tooltip content={<Tip unit=" kg" />} cursor={{ fill: '#f4f3ef' }} />
                <Bar dataKey="leftover" name="Leftover" fill={C.s2} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Weekly waste rate" subtitle="Leftover as % of prepared, per week">
          <div className="h-64">
            <ResponsiveContainer>
              <LineChart data={data.weekly} margin={{ left: -10, right: 8 }}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="week" {...axisProps} minTickGap={20} />
                <YAxis {...axisProps} unit="%" domain={['auto', 'auto']} />
                <Tooltip content={<Tip unit="%" />} />
                <Line dataKey="waste_pct" name="Waste %" stroke={C.s1} strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card title="Meal-wise comparison by weekday" subtitle="Average leftover (kg) per meal">
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={data.weekday_meal} margin={{ left: -10, right: 8 }} barGap={2}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="day" {...axisProps} />
                <YAxis {...axisProps} />
                <Tooltip content={<Tip unit=" kg" />} cursor={{ fill: '#f4f3ef' }} />
                <Legend />
                <Bar dataKey="lunch_leftover" name="Lunch" fill={C.s1} radius={[4, 4, 0, 0]} />
                <Bar dataKey="dinner_leftover" name="Dinner" fill={C.s2} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Average attendance by weekday" subtitle="Students per meal">
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={data.weekday_meal} margin={{ left: -10, right: 8 }} barGap={2}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="day" {...axisProps} />
                <YAxis {...axisProps} />
                <Tooltip content={<Tip />} cursor={{ fill: '#f4f3ef' }} />
                <Legend />
                <Bar dataKey="lunch_attendance" name="Lunch" fill={C.s1} radius={[4, 4, 0, 0]} />
                <Bar dataKey="dinner_attendance" name="Dinner" fill={C.s2} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card title="Waste by category" subtitle="Four waste categories tracked separately">
          <div className="h-64">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={data.waste_categories} dataKey="kg" nameKey="category" innerRadius={55} outerRadius={90} paddingAngle={2} stroke="#fff" strokeWidth={2}>
                  {data.waste_categories.map((c, i) => <Cell key={c.category} fill={[C.s1, C.s2, C.s3, C.s4][i]} />)}
                </Pie>
                <Tooltip content={<Tip unit=" kg" />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="space-y-1 text-xs">
            {data.waste_categories.map((c, i) => (
              <li key={c.category} className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ background: [C.s1, C.s2, C.s3, C.s4][i] }} />
                <span className="text-ink-2">{c.category}</span>
                <span className="ml-auto font-semibold tabular-nums">{c.pct}%</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Distribution of leftovers" subtitle="Histogram of leftover kg per meal">
          <Histogram data={data.hist_leftover} color={C.s2} />
        </Card>
        <Card title="Distribution of consumption" subtitle="Histogram of consumed kg per meal">
          <Histogram data={data.hist_consumed} color={C.s1} />
        </Card>
      </div>

      <Card title="Correlation heatmap" subtitle="Pearson correlation between numeric features (blue = positive, red = negative)">
        <Heatmap rows={data.correlation.labels} cols={data.correlation.labels} values={data.correlation.values} diverging />
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card title="Student preference heatmap" subtitle="% of survey responses at each star rating, per dish">
          <Heatmap rows={data.preference.rows} cols={data.preference.cols} values={data.preference.values} suffix="%" />
        </Card>
        <Card title="Portion feedback" subtitle="What students say about serving size, by dish (sorted by ‘Too much’)">
          <div className="h-[470px]">
            <ResponsiveContainer>
              <BarChart data={data.portion} layout="vertical" margin={{ left: 10, right: 10 }} stackOffset="expand">
                <CartesianGrid {...gridProps} horizontal={false} vertical />
                <XAxis type="number" {...axisProps} tickFormatter={(v) => `${Math.round(v * 100)}%`} />
                <YAxis type="category" dataKey="dish" {...axisProps} width={130} />
                <Tooltip content={<Tip unit="%" />} cursor={{ fill: '#f4f3ef' }} />
                <Legend />
                <Bar dataKey="Too much" stackId="a" fill={C.s2} stroke="#fff" strokeWidth={2} />
                <Bar dataKey="Just right" stackId="a" fill={C.s1} stroke="#fff" strokeWidth={2} />
                <Bar dataKey="Too little" stackId="a" fill={C.s3} stroke="#fff" strokeWidth={2} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  )
}

function DishTip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="rounded-lg bg-white shadow-lg ring-1 ring-stone-200 px-3 py-2 text-xs space-y-0.5">
      <div className="font-semibold text-ink">{d.dish} <span className="text-ink-3 font-normal">({d.meal_type})</span></div>
      <div className="text-ink-2">Waste: <b className="text-ink">{d.waste_pct}%</b> · {d.leftover_kg} kg/meal</div>
      <div className="text-ink-2">Avg rating: <b className="text-ink">{d.rating}</b> / 5</div>
      <div className="text-ink-2">Cost of leftovers: <b className="text-ink">₹{fmt(d.waste_cost_inr, 0)}</b></div>
    </div>
  )
}

function Histogram({ data, color }) {
  return (
    <div className="h-64">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ left: -15, right: 4 }} barCategoryGap={1}>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="bin" {...axisProps} interval={2} />
          <YAxis {...axisProps} />
          <Tooltip content={<Tip unit=" meals" />} cursor={{ fill: '#f4f3ef' }} />
          <Bar dataKey="count" name="Meals" fill={color} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ======================================================================= 4 PREDICT
function Predict() {
  const model = useApi('/api/model')
  const fc = useApi('/api/forecast?days=7')
  if (!model.data || !fc.data) return <Loading error={model.error || fc.error} />
  const m = model.data
  return (
    <div className="space-y-4">
      <div className="grid lg:grid-cols-3 gap-4">
        <Card title="Problem framing" subtitle="Food demand prediction is a supervised regression problem.">
          <dl className="space-y-3 text-sm">
            <div><dt className="text-[11px] uppercase tracking-wider font-semibold text-ink-3">Target</dt><dd>Quantity of food required for a meal — <code className="bg-stone-100 px-1 rounded">{m.target}</code> (kg)</dd></div>
            <div><dt className="text-[11px] uppercase tracking-wider font-semibold text-ink-3">Features ({m.features.length})</dt>
              <dd className="flex flex-wrap gap-1 mt-1">{m.features.map((f) => <span key={f} className="text-[11px] rounded-md bg-brand-50 text-brand-700 px-1.5 py-0.5">{f}</span>)}</dd></div>
            <div><dt className="text-[11px] uppercase tracking-wider font-semibold text-ink-3">Models</dt><dd>{m.results.map((r) => r.model).join(' · ')}</dd></div>
            <div><dt className="text-[11px] uppercase tracking-wider font-semibold text-ink-3">Data split</dt><dd>{m.n_records} records · chronological 80/20 → {m.n_train} train / {m.n_test} test (test starts {m.split_date})</dd></div>
            {!m.has_xgboost && <div className="text-[11px] text-amber-800 bg-amber-50 rounded-lg p-2">XGBoost's native library could not load on this machine (needs <code>brew install libomp</code>), so scikit-learn's Gradient Boosting is used as the boosting model.</div>}
          </dl>
        </Card>
        <div className="lg:col-span-2"><Predictor /></div>
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <Card title="7-day forecast · Lunch" subtitle="Recursive multi-step forecast; previous-meal features are fed with predictions">
          <ForecastChart data={fc.data} meal="Lunch" />
        </Card>
        <Card title="7-day forecast · Dinner" subtitle="Bars = recommended preparation (75th percentile of the forest's trees)">
          <ForecastChart data={fc.data} meal="Dinner" />
        </Card>
      </div>
      <Card title="Illustrative example" subtitle="How a prediction becomes a decision">
        <p className="text-sm text-ink-2">Usual preparation <b className="text-ink">40 kg</b> of rice → predicted requirement <b className="text-ink">32 kg</b> → <b className="text-brand-600">8 kg</b> potential over-production identified. The manager compares the prediction with planned preparation and decides whether to adjust quantities.</p>
      </Card>
    </div>
  )
}

// ======================================================================= 5 EVALUATE
function Evaluate() {
  const { data, error } = useApi('/api/model')
  const [sel, setSel] = useState(null)
  if (!data) return <Loading error={error} />
  const best = data.results.find((r) => r.model === (sel || data.best_model))
  const all = [...data.results, ...data.baselines.map((b) => ({ ...b, baseline: true }))]
  const test = data.test.map((t, i) => ({ ...t, i: i + 1, band: [t.lower, t.upper], label: `${t.date} ${t.meal_type}` }))
  const lo = Math.min(...test.map((t) => Math.min(t.actual, t.predicted))) - 2
  const hi = Math.max(...test.map((t) => Math.max(t.actual, t.predicted))) + 2
  const resid = binResiduals(test.map((t) => t.residual))
  const short = (n) => n.replace(' Regressor', '').replace(' (XGBoost fallback)', ' (XGB fallback)')
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-ink-2">Model:</span>
        <Tabs tabs={data.results.map((r) => ({ id: r.model, label: short(r.model) }))} value={sel || data.best_model} onChange={setSel} />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="MAE" value={best.mae} unit="kg" hint="Mean absolute error on unseen test data" />
        <Stat label="RMSE" value={best.rmse} unit="kg" hint="Penalises large misses more" />
        <Stat label="R² score" value={best.r2} hint="Share of demand variance explained" tone="brand" />
        <Stat label="5-fold time-series CV" value={`${best.cv_mae_mean} ± ${best.cv_mae_std}`} unit="kg" hint="MAE on training folds (TimeSeriesSplit)" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card title="Model comparison — error (lower is better)" subtitle="Test-set MAE and RMSE, including two non-ML baselines">
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={all.map((r) => ({ ...r, name: short(r.model) }))} margin={{ left: -10, right: 8, bottom: 30 }} barGap={2}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="name" {...axisProps} interval={0} angle={-18} textAnchor="end" height={50} tick={{ fontSize: 10, fill: C.ink2 }} />
                <YAxis {...axisProps} unit=" kg" />
                <Tooltip content={<Tip unit=" kg" />} cursor={{ fill: '#f4f3ef' }} />
                <Legend verticalAlign="top" />
                <Bar dataKey="mae" name="MAE" fill={C.s1} radius={[4, 4, 0, 0]} />
                <Bar dataKey="rmse" name="RMSE" fill={C.s2} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Overfitting check" subtitle="Train vs test R² — a large gap means the model memorised the training data">
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={data.results.map((r) => ({ name: short(r.model), train: r.train.r2, test: r.r2 }))} margin={{ left: -10, right: 8 }} barGap={2}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="name" {...axisProps} interval={0} tick={{ fontSize: 10, fill: C.ink2 }} />
                <YAxis {...axisProps} domain={[0, 1]} />
                <Tooltip content={<Tip />} cursor={{ fill: '#f4f3ef' }} />
                <Legend verticalAlign="top" />
                <Bar dataKey="train" name="Train R²" fill={C.s1} radius={[4, 4, 0, 0]} />
                <Bar dataKey="test" name="Test R²" fill={C.s3} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card title="Metrics table" subtitle="All models evaluated on the same chronological test set">
        <Table rows={all} columns={[
          { key: 'model', render: (r) => <span className={r.baseline ? 'text-ink-2 italic' : 'font-semibold'}>{r.model}{r.model === data.best_model ? ' ★' : ''}</span> },
          { key: 'mae', label: 'MAE (kg)' }, { key: 'rmse', label: 'RMSE (kg)' }, { key: 'r2', label: 'R²' },
          { key: 'cv_mae_mean', label: 'CV MAE', render: (r) => (r.cv_mae_mean ? `${r.cv_mae_mean} ± ${r.cv_mae_std}` : '—') },
        ]} />
        <Note>★ Random Forest is the deployed model: it is competitive with the others and its individual trees give a prediction interval ({Math.round(data.interval_coverage * 100)}% of test meals fell inside the 80% band). Linear Regression is a strong baseline here because consumption is close to linear in attendance. Metrics are computed on synthetic data only and are not evidence of accuracy in a real hostel.</Note>
      </Card>

      <Card title="Actual vs predicted demand on unseen test data" subtitle={`${short(data.best_model)} · shaded band = 80% interval from the forest's trees`}>
        <div className="h-80">
          <ResponsiveContainer>
            <ComposedChart data={test} margin={{ left: -10, right: 8 }}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="label" {...axisProps} minTickGap={60} tickFormatter={(l) => l.slice(5, 10)} />
              <YAxis {...axisProps} domain={['auto', 'auto']} unit=" kg" />
              <Tooltip content={<Tip unit=" kg" />} />
              <Legend iconType="plainline" />
              <Area dataKey="band" name="80% interval" stroke="none" fill={C.s1} fillOpacity={0.14} />
              <Line dataKey="prepared" name="Kitchen prepared" stroke={C.muted} strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
              <Line dataKey="actual" name="Actual" stroke={C.s2} strokeWidth={2} dot={false} />
              <Line dataKey="predicted" name="Predicted" stroke={C.s1} strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card title="Predicted vs actual" subtitle="Points on the diagonal are perfect predictions">
          <div className="h-72">
            <ResponsiveContainer>
              <ScatterChart margin={{ left: -10, right: 8 }}>
                <CartesianGrid {...gridProps} vertical />
                <XAxis type="number" dataKey="actual" name="Actual" {...axisProps} domain={[lo, hi]} tickFormatter={(v) => Math.round(v)} />
                <YAxis type="number" dataKey="predicted" name="Predicted" {...axisProps} domain={[lo, hi]} tickFormatter={(v) => Math.round(v)} />
                <ZAxis range={[40, 40]} />
                <Tooltip content={<Tip unit=" kg" />} />
                <ReferenceLine segment={[{ x: lo, y: lo }, { x: hi, y: hi }]} stroke="#0b0b0b" strokeDasharray="4 3" />
                <Scatter data={test} fill={C.s1} fillOpacity={0.65} name="Test meal" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Residual distribution" subtitle="Actual − predicted; centred near 0 = little bias">
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={resid} margin={{ left: -15, right: 4 }} barCategoryGap={1}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="bin" {...axisProps} />
                <YAxis {...axisProps} />
                <Tooltip content={<Tip unit=" meals" />} cursor={{ fill: '#f4f3ef' }} />
                <Bar dataKey="count" name="Meals" fill={C.s6} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Feature importance" subtitle="Random Forest impurity-based importance">
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={data.importance} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid {...gridProps} horizontal={false} vertical />
                <XAxis type="number" {...axisProps} tickFormatter={(v) => `${Math.round(v * 100)}%`} />
                <YAxis type="category" dataKey="feature" {...axisProps} width={150} tick={{ fontSize: 10, fill: C.ink2 }} />
                <Tooltip content={<Tip />} cursor={{ fill: '#f4f3ef' }} />
                <Bar dataKey="importance" name="Importance" fill={C.s3} radius={[0, 4, 4, 0]} barSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card title="Linear Regression coefficients (standardised features)" subtitle="kg change in demand per 1 standard deviation increase in each feature — blue raises demand, red lowers it">
        <div className="h-72">
          <ResponsiveContainer>
            <BarChart data={[...data.coefficients].sort((a, b) => b.coef - a.coef)} layout="vertical" margin={{ left: 20, right: 30 }}>
              <CartesianGrid {...gridProps} horizontal={false} vertical />
              <XAxis type="number" {...axisProps} />
              <YAxis type="category" dataKey="feature" {...axisProps} width={170} />
              <ReferenceLine x={0} stroke={C.axis} />
              <Tooltip content={<Tip unit=" kg" />} cursor={{ fill: '#f4f3ef' }} />
              <Bar dataKey="coef" name="Coefficient" radius={4} barSize={14}>
                {data.coefficients.slice().sort((a, b) => b.coef - a.coef).map((c) => <Cell key={c.feature} fill={c.coef >= 0 ? C.s1 : '#e34948'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  )
}

function binResiduals(r) {
  const edges = []
  for (let x = -8; x <= 8; x += 1) edges.push(x)
  return edges.slice(0, -1).map((e) => ({ bin: e, count: r.filter((v) => v >= e && v < e + 1).length }))
}

// ======================================================================= 6 RECOMMEND
function Recommend() {
  const sus = useApi('/api/sustainability')
  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <Card className="lg:col-span-2" title="Recommendations" subtitle="Preparation quantities · near-expiry usage (FEFO) · menu improvements · portion planning · purchasing. Human approval is required before any operational change.">
        <Recommendations />
      </Card>
      <div className="space-y-4">
        {sus.data ? (
          <Card title="Measure: simulated impact" subtitle={`Following the recommended prep over ${sus.data.period_meals} test meals`}>
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Food saved" value={fmt(sus.data.food_saved_kg, 0)} unit="kg" tone="good" />
              <Stat label="Cost visibility" value={`₹${fmt(sus.data.cost_saved_inr / 1000, 1)}k`} tone="good" />
              <Stat label="Plates" value={fmt(sus.data.meals_equivalent, 0)} />
              <Stat label="Shortfall risk" value={sus.data.shortfall_meals} hint="meals short by > 1 kg" />
            </div>
            <div className="h-40 mt-4">
              <ResponsiveContainer>
                <LineChart data={sus.data.cumulative} margin={{ left: -15, right: 4 }}>
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="date" {...axisProps} minTickGap={40} tickFormatter={(d) => d.slice(5)} />
                  <YAxis {...axisProps} />
                  <Tooltip content={<Tip unit=" kg" />} />
                  <Line dataKey="saved" name="Cumulative kg saved" stroke={C.s3} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <Note>{sus.data.note}</Note>
          </Card>
        ) : <Loading error={sus.error} />}
      </div>
    </div>
  )
}

// ======================================================================= REPORT
function Report() {
  const { data, error } = useApi('/api/figures')
  if (!data) return <Loading error={error} />
  return (
    <div className="space-y-4">
      <Card title="Matplotlib + Seaborn analysis report" subtitle="Static figures generated by messmind/plots.py into backend/reports/ — ready to drop into your project report or slides."
        right={<a className={btn2Cls} href="/api/admin/report.xlsx"><Download size={15} /> Excel report</a>}>
        <div className="grid md:grid-cols-2 gap-4">
          {data.map((f) => (
            <figure key={f.file} className="rounded-xl border border-stone-200 overflow-hidden bg-white">
              <a href={`/reports/${f.file}`} target="_blank" rel="noreferrer"><img src={`/reports/${f.file}?v=${Date.now() % 100000}`} alt={f.title} className="w-full" loading="lazy" /></a>
              <figcaption className="px-4 py-3 border-t border-stone-100">
                <div className="text-sm font-semibold">{f.title}</div>
                <div className="text-xs text-ink-2">{f.caption}</div>
              </figcaption>
            </figure>
          ))}
        </div>
      </Card>
    </div>
  )
}
