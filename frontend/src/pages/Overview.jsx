import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowRight, Brush, Database, LineChart, Lightbulb, Ruler, Search } from 'lucide-react'
import { C, Card, Loading, Stat, Tip, axisProps, fmt, gridProps, useApi } from '../ui.jsx'

const LOOP = [
  { id: 'collect', icon: Database, title: 'Collect', text: 'Surveys, attendance, preparation, leftovers, feedback and inventory records.' },
  { id: 'clean', icon: Brush, title: 'Clean', text: 'Missing values, duplicates, units and inconsistent entries.' },
  { id: 'explore', icon: Search, title: 'Explore', text: 'Preference, consumption, wastage and expiry patterns.' },
  { id: 'predict', icon: LineChart, title: 'Predict', text: 'Predict demand and identify waste patterns.' },
  { id: 'recommend', icon: Lightbulb, title: 'Recommend', text: 'Preparation, procurement, menu and inventory actions.' },
  { id: 'evaluate', icon: Ruler, title: 'Measure', text: 'Food saved, estimated cost impact and waste trends.' },
]

const PROBLEMS = [
  ['Demand is estimated, not understood', 'Inaccurate demand estimation drives excess preparation.'],
  ['Inventory signals arrive too late', 'Ingredients expire without coordinated inventory and consumption analysis.'],
  ['Preferences stay unstructured', 'Unpopular dishes and portion patterns remain hidden.'],
  ['The cost is avoidable', 'Avoidable financial and environmental losses add up every day.'],
]

const ROADMAP = [
  ['Data collection', 'Public datasets, mess records and feedback', 'done'],
  ['Data science', 'Cleaning, EDA, feature engineering and analysis', 'done'],
  ['Machine learning', 'Train, compare and evaluate regression models', 'done'],
  ['Web development', 'Dashboards, uploads, inventory and prediction integration', 'done'],
  ['Testing & validation', 'Compare predictions with actual consumption in a real hostel', 'next'],
]

export default function Overview({ go }) {
  const eda = useApi('/api/eda')
  const model = useApi('/api/model')
  const sus = useApi('/api/sustainability')
  if (!eda.data || !model.data || !sus.data) return <Loading error={eda.error || model.error || sus.error} />
  const k = eda.data.kpis
  const rf = model.data.results.find((r) => r.model === model.data.best_model)
  const kitchen = model.data.baselines[0]

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-gradient-to-br from-brand-900 via-brand-700 to-brand-500 text-white p-7 sm:p-10 relative overflow-hidden">
        <div className="absolute -right-16 -top-16 w-72 h-72 rounded-full bg-white/5" />
        <div className="absolute right-24 -bottom-24 w-64 h-64 rounded-full bg-white/5" />
        <div className="relative max-w-3xl">
          <div className="text-[11px] font-semibold tracking-[0.2em] text-brand-100/80">DATA SCIENCE · MACHINE LEARNING · AI · WEB DEVELOPMENT</div>
          <h1 className="mt-3 text-4xl sm:text-5xl font-extrabold tracking-tight">MESSMIND</h1>
          <p className="mt-2 text-xl font-semibold text-brand-100">Predict. Prevent. Preserve.</p>
          <p className="mt-4 text-brand-50/90 leading-relaxed">AI-powered food waste prediction and intelligent mess management for hostel messes, universities, hotels and institutional cafeterias.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button onClick={() => go('lab')} className="inline-flex items-center gap-2 rounded-xl bg-white text-brand-900 px-4 py-2.5 text-sm font-semibold hover:bg-brand-50">Open the Data Science Lab <ArrowRight size={16} /></button>
            <button onClick={() => go('manager')} className="inline-flex items-center gap-2 rounded-xl bg-white/10 ring-1 ring-white/30 px-4 py-2.5 text-sm font-semibold hover:bg-white/20">Manager dashboard</button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Meal records analysed" value={fmt(k.meals, 0)} hint={`${k.days} days × 2 meals · Hostel A`} />
        <Stat label="Food left over" value={fmt(k.leftover_kg, 0)} unit="kg" hint={`${k.waste_pct}% of everything prepared`} tone="bad" />
        <Stat label="Cost of leftovers" value={`₹${fmt(k.waste_cost_inr / 1000, 0)}k`} hint="Leftover kg × dish cost/kg" tone="bad" />
        <Stat label="Model error (MAE)" value={fmt(rf.mae, 2)} unit="kg" hint={`vs ${fmt(kitchen.mae, 2)} kg for the kitchen's usual guess`} tone="good" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2" title="Every day, more food is prepared than eaten" subtitle="Hostel A · 7-day rolling totals (kg/day). The gap between the lines is leftover food.">
          <div className="h-72">
            <ResponsiveContainer>
              <AreaChart data={eda.data.daily.map((d, i, a) => ({ ...d, p7: avg(a, i, 'prepared'), c7: avg(a, i, 'consumed') }))} margin={{ left: -10, right: 8 }}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="date" {...axisProps} minTickGap={40} tickFormatter={(d) => d.slice(5)} />
                <YAxis {...axisProps} domain={['auto', 'auto']} />
                <Tooltip content={<Tip unit=" kg" />} />
                <Legend iconType="plainline" />
                <Area type="monotone" dataKey="p7" name="Prepared" stroke={C.s2} strokeWidth={2} fill={C.s2} fillOpacity={0.12} dot={false} />
                <Area type="monotone" dataKey="c7" name="Consumed" stroke={C.s1} strokeWidth={2} fill="#fff" fillOpacity={1} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="If managers followed the model" subtitle={`Simulated on the last ${sus.data.period_meals} test meals`}>
          <div className="space-y-4 mt-1">
            <Big v={`${fmt(sus.data.food_saved_kg, 0)} kg`} l="potential over-production avoided" />
            <Big v={`₹${fmt(sus.data.cost_saved_inr, 0)}`} l="estimated ingredient cost visibility" />
            <Big v={fmt(sus.data.meals_equivalent, 0)} l="plates of food (≈400 g each)" />
          </div>
          <p className="text-[11px] text-ink-3 mt-4">{sus.data.note}</p>
        </Card>
      </div>

      <Card title="The learning loop" subtitle="MessMind turns kitchen activity into a learning loop. Click a stage to see it in the Data Science Lab.">
        <div className="grid sm:grid-cols-2 lg:grid-cols-6 gap-3">
          {LOOP.map(({ id, icon: Icon, title, text }, i) => (
            <button key={id} onClick={() => go('lab', id)} className="text-left rounded-xl border border-stone-200 p-4 hover:border-brand-500 hover:bg-brand-50/40 transition group">
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-lg bg-brand-50 text-brand-600 grid place-items-center group-hover:bg-brand-600 group-hover:text-white transition"><Icon size={18} /></div>
                <span className="text-xs font-bold text-ink-3">0{i + 1}</span>
              </div>
              <div className="mt-3 font-semibold text-sm">{title}</div>
              <div className="text-xs text-ink-2 mt-1 leading-relaxed">{text}</div>
            </button>
          ))}
        </div>
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card title="The problem" subtitle="Institutional kitchens are still making decisions in the dark.">
          <div className="grid sm:grid-cols-2 gap-3">
            {PROBLEMS.map(([t, d]) => (
              <div key={t} className="rounded-xl bg-stone-50 p-4">
                <div className="font-semibold text-sm">{t}</div>
                <div className="text-xs text-ink-2 mt-1 leading-relaxed">{d}</div>
              </div>
            ))}
          </div>
        </Card>
        <Card title="Implementation roadmap" subtitle="Build the intelligence in five practical phases.">
          <ol className="space-y-2.5">
            {ROADMAP.map(([t, d, s], i) => (
              <li key={t} className="flex gap-3 items-start">
                <span className={`w-7 h-7 shrink-0 rounded-full grid place-items-center text-xs font-bold ${s === 'done' ? 'bg-brand-600 text-white' : 'bg-stone-200 text-ink-2'}`}>{s === 'done' ? '✓' : i + 1}</span>
                <div>
                  <div className="text-sm font-semibold">{t} {s === 'next' && <span className="text-[11px] font-medium text-amber-700 ml-1">next step</span>}</div>
                  <div className="text-xs text-ink-2">{d}</div>
                </div>
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </div>
  )
}

function avg(a, i, key) {
  const s = a.slice(Math.max(0, i - 6), i + 1)
  return +(s.reduce((t, d) => t + d[key], 0) / s.length).toFixed(1)
}
function Big({ v, l }) {
  return (
    <div>
      <div className="text-3xl font-extrabold text-brand-600 tabular-nums">{v}</div>
      <div className="text-xs text-ink-2">{l}</div>
    </div>
  )
}
