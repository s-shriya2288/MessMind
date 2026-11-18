import { useState } from 'react'
import {
  Area, Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { Sparkles } from 'lucide-react'
import { C, Badge, Card, Field, Tip, api, axisProps, btnCls, fmt, gridProps, inputCls, useApi } from './ui.jsx'

// ------------------------------------------------------------ What-if demand predictor
export function Predictor() {
  const meta = useApi('/api/meta')
  const today = new Date().toISOString().slice(0, 10)
  const [f, setF] = useState({ date: today, meal_type: 'Lunch', dish: '', attendance: '', event_flag: 0, holiday_flag: 0 })
  const [res, setRes] = useState(null)
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? (e.target.checked ? 1 : 0) : e.target.value })
  const dishes = meta.data?.dishes.filter((d) => d.meal_type === f.meal_type) || []

  const run = async (e) => {
    e.preventDefault(); setBusy(true); setErr(null)
    try {
      setRes(await api('/api/predict', {
        method: 'POST',
        body: JSON.stringify({ ...f, dish: f.dish || null, attendance: f.attendance ? +f.attendance : null }),
      }))
    } catch (x) { setErr(x.message) } finally { setBusy(false) }
  }

  const lo = res ? Math.min(res.lower_kg, res.usual_prep_kg) * 0.93 : 0
  const hi = res ? Math.max(res.upper_kg, res.usual_prep_kg) * 1.04 : 1
  const pct = (v) => `${((v - lo) / (hi - lo)) * 100}%`
  return (
    <Card title="What-if demand predictor" subtitle="Random Forest regression · enter a meal and get the predicted quantity with an 80% interval.">
      <form onSubmit={run} className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Field label="Date"><input type="date" className={inputCls} value={f.date} onChange={set('date')} /></Field>
        <Field label="Meal">
          <select className={inputCls} value={f.meal_type} onChange={(e) => setF({ ...f, meal_type: e.target.value, dish: '' })}>
            <option>Lunch</option><option>Dinner</option>
          </select>
        </Field>
        <Field label="Dish (blank = menu)">
          <select className={inputCls} value={f.dish} onChange={set('dish')}>
            <option value="">From weekly menu</option>
            {dishes.map((d) => <option key={d.dish}>{d.dish}</option>)}
          </select>
        </Field>
        <Field label="Expected attendance"><input type="number" min="20" max="600" placeholder="auto (recent avg)" className={inputCls} value={f.attendance} onChange={set('attendance')} /></Field>
        <label className="flex items-center gap-2 text-sm mt-5"><input type="checkbox" checked={!!f.event_flag} onChange={set('event_flag')} className="accent-brand-600 w-4 h-4" /> Special event</label>
        <label className="flex items-center gap-2 text-sm mt-5"><input type="checkbox" checked={!!f.holiday_flag} onChange={set('holiday_flag')} className="accent-brand-600 w-4 h-4" /> Holiday</label>
        <div className="col-span-2 sm:col-span-3"><button className={btnCls} disabled={busy}><Sparkles size={16} />{busy ? 'Predicting…' : 'Predict demand'}</button></div>
      </form>
      {err && <div className="mt-3 text-sm text-red-700">{err}</div>}
      {res && (
        <div className="mt-5 rounded-xl bg-stone-50 p-4">
          <div className="text-sm text-ink-2">{res.weekday} {res.meal_type} · <b className="text-ink">{res.dish}</b> · {res.attendance} students</div>
          <div className="grid grid-cols-3 gap-3 mt-3">
            <div><div className="text-[11px] uppercase tracking-wider text-ink-3 font-semibold">Predicted demand</div><div className="text-2xl font-bold tabular-nums">{res.predicted_kg} <span className="text-sm text-ink-2">kg</span></div></div>
            <div><div className="text-[11px] uppercase tracking-wider text-ink-3 font-semibold">Recommended prep</div><div className="text-2xl font-bold tabular-nums text-brand-600">{res.recommended_prep_kg} <span className="text-sm text-ink-2">kg</span></div></div>
            <div><div className="text-[11px] uppercase tracking-wider text-ink-3 font-semibold">vs usual prep</div><div className="text-2xl font-bold tabular-nums">{res.usual_prep_kg} <span className="text-sm text-ink-2">kg</span></div></div>
          </div>
          <div className="relative h-10 mt-4 mb-1">
            <div className="absolute top-4 h-2 w-full rounded-full bg-stone-200" />
            <div className="absolute top-4 h-2 rounded-full" style={{ left: pct(res.lower_kg), width: `calc(${pct(res.upper_kg)} - ${pct(res.lower_kg)})`, background: '#9ec5f4' }} title="80% interval" />
            <Marker x={pct(res.predicted_kg)} color={C.s1} label="pred" />
            <Marker x={pct(res.recommended_prep_kg)} color="#256649" label="rec" />
            <Marker x={pct(res.usual_prep_kg)} color={C.s2} label="usual" />
          </div>
          <div className="text-xs text-ink-2 flex flex-wrap gap-x-4 gap-y-1">
            <span><span className="inline-block w-3 h-2 rounded-sm align-middle mr-1" style={{ background: '#9ec5f4' }} />80% interval {res.lower_kg}–{res.upper_kg} kg</span>
            <span><span className="inline-block w-2.5 h-2.5 rounded-full align-middle mr-1" style={{ background: C.s1 }} />predicted</span>
            <span><span className="inline-block w-2.5 h-2.5 rounded-full align-middle mr-1" style={{ background: '#256649' }} />recommended (P75 of trees)</span>
            <span><span className="inline-block w-2.5 h-2.5 rounded-full align-middle mr-1" style={{ background: C.s2 }} />usual preparation</span>
          </div>
          {res.potential_saving_kg > 0
            ? <p className="text-sm mt-3">→ Preparing the recommended amount avoids about <b>{res.potential_saving_kg} kg</b> of over-production (≈₹{fmt(res.potential_saving_inr, 0)}).</p>
            : <p className="text-sm mt-3">→ Usual preparation is already close to predicted demand.</p>}
          <p className="text-[11px] text-ink-3 mt-1">Human approval remains required before operational changes.</p>
        </div>
      )}
    </Card>
  )
}
function Marker({ x, color, label }) {
  return (
    <div className="absolute top-2.5 -translate-x-1/2 flex flex-col items-center" style={{ left: x }}>
      <div className="w-3.5 h-3.5 rounded-full ring-2 ring-white" style={{ background: color }} />
      <div className="text-[10px] text-ink-2 mt-0.5">{label}</div>
    </div>
  )
}

// ------------------------------------------------------------ 7-day forecast chart
export function ForecastChart({ data, meal }) {
  const rows = data.filter((d) => d.meal_type === meal).map((d) => ({ ...d, band: [d.lower_kg, d.upper_kg] }))
  const vals = rows.flatMap((d) => [d.lower_kg, d.upper_kg, d.usual_prep_kg, d.recommended_prep_kg])
  const lo = Math.floor(Math.min(...vals) * 0.9), hi = Math.ceil(Math.max(...vals) * 1.05)
  return (
    <div className="h-64">
      <ResponsiveContainer>
        <ComposedChart data={rows} margin={{ left: -10, right: 8 }}>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="day" {...axisProps} />
          <YAxis {...axisProps} domain={[lo, hi]} allowDataOverflow unit=" kg" />
          <Tooltip content={<Tip unit=" kg" />} />
          <Legend />
          <Area dataKey="band" name="80% interval" stroke="none" fill={C.s1} fillOpacity={0.15} />
          <Bar dataKey="recommended_prep_kg" name="Recommended prep" fill={C.s3} radius={[4, 4, 0, 0]} barSize={22} />
          <Line dataKey="predicted_kg" name="Predicted demand" stroke={C.s1} strokeWidth={2} dot={{ r: 4 }} />
          <Line dataKey="usual_prep_kg" name="Usual preparation" stroke={C.s2} strokeWidth={2} strokeDasharray="5 4" dot={{ r: 4 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

// ------------------------------------------------------------ Recommendation list with human approval
export function Recommendations({ compact }) {
  const { data, error } = useApi('/api/recommendations')
  const [decision, setDecision] = useState({})
  if (!data) return <div className="text-sm text-ink-2">{error || 'Loading recommendations…'}</div>
  return (
    <div className="space-y-2.5">
      {(compact ? data.slice(0, 5) : data).map((r, i) => (
        <div key={i} className={`rounded-xl border p-3.5 transition ${decision[i] === 'approved' ? 'border-emerald-300 bg-emerald-50/50' : decision[i] === 'dismissed' ? 'opacity-50 border-stone-200' : 'border-stone-200 bg-white'}`}>
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-600">{r.type}</span>
                <Badge>{r.priority}</Badge>
              </div>
              <div className="text-sm font-semibold mt-1">{r.title}</div>
              <div className="text-xs text-ink-2 mt-1 leading-relaxed">{r.detail}</div>
            </div>
            <div className="flex flex-col gap-1.5 shrink-0">
              {decision[i] ? (
                <button className="text-xs text-ink-2 underline" onClick={() => setDecision({ ...decision, [i]: undefined })}>{decision[i]} · undo</button>
              ) : (
                <>
                  <button className="text-xs font-semibold rounded-md bg-brand-600 text-white px-2.5 py-1 hover:bg-brand-700" onClick={() => setDecision({ ...decision, [i]: 'approved' })}>Approve</button>
                  <button className="text-xs font-medium rounded-md border border-stone-300 px-2.5 py-1 hover:bg-stone-50" onClick={() => setDecision({ ...decision, [i]: 'dismissed' })}>Dismiss</button>
                </>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
