import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { FileUp, Plus, Download } from 'lucide-react'
import {
  Badge, C, Card, Field, Loading, Stat, Table, Tip, api, axisProps, btn2Cls, btnCls, fmt, gridProps, inputCls, useApi,
} from '../ui.jsx'
import { ForecastChart, Predictor, Recommendations } from '../components.jsx'

export default function Manager() {
  const fc = useApi('/api/forecast?days=7')
  const recent = useApi('/api/records/recent?n=14')
  const inv = useApi('/api/inventory')
  const [meal, setMeal] = useState('Lunch')
  const [tick, setTick] = useState(0)
  const refresh = () => { fc.reload(); recent.reload(); inv.reload(); setTick(tick + 1) }
  if (!fc.data || !recent.data || !inv.data) return <Loading error={fc.error || recent.error || inv.error} />

  const next = fc.data.slice(0, 2)
  const atRisk = inv.data.filter((i) => i.status !== 'OK')
  const valueAtRisk = atRisk.reduce((t, i) => t + i.value_at_risk, 0)
  const recentChart = [...recent.data].reverse().map((r) => ({ ...r, label: `${r.date.slice(5)} ${r.meal_type[0]}` }))

  return (
    <div className="space-y-6">
      <div>
        <div className="text-[11px] font-semibold tracking-[0.18em] text-brand-600">MESS MANAGER DASHBOARD · HOSTEL A</div>
        <h1 className="text-3xl font-extrabold tracking-tight mt-1">Kitchen control room</h1>
        <p className="text-ink-2 mt-1">Demand forecast, preparation guidance, leftover monitoring and inventory — all in one place.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {next.map((n) => (
          <Stat key={n.meal_type} label={`${n.day} · ${n.meal_type}`} value={n.recommended_prep_kg} unit="kg to prepare"
            hint={`${n.dish} · ~${n.attendance} students · usual ${n.usual_prep_kg} kg`} tone="brand" />
        ))}
        <Stat label="Inventory at risk" value={atRisk.length} unit="batches" hint={`≈₹${fmt(valueAtRisk, 0)} could expire`} tone={atRisk.length ? 'bad' : 'good'} />
        <Stat label="Last meal leftover" value={recent.data[0].leftover_kg} unit="kg" hint={`${recent.data[0].dish} · ${recent.data[0].waste_pct}% wasted`} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2" title="7-day demand forecast & preparation guidance"
          right={<div className="flex gap-1 bg-stone-100 p-1 rounded-lg">{['Lunch', 'Dinner'].map((m) => <button key={m} onClick={() => setMeal(m)} className={`px-3 py-1 text-xs rounded-md font-medium ${meal === m ? 'bg-white shadow' : 'text-ink-2'}`}>{m}</button>)}</div>}>
          <ForecastChart data={fc.data} meal={meal} />
          <div className="mt-4">
            <Table dense max={260} rows={fc.data.filter((f) => f.meal_type === meal)} columns={[
              { key: 'day' }, { key: 'dish' }, { key: 'attendance', label: 'Exp. students' },
              { key: 'predicted_kg', label: 'Predicted (kg)' },
              { key: 'band', label: '80% range', render: (r) => `${r.lower_kg} – ${r.upper_kg}` },
              { key: 'recommended_prep_kg', label: 'Prepare (kg)', cls: () => 'font-semibold text-brand-700' },
              { key: 'usual_prep_kg', label: 'Usual (kg)' },
              { key: 'potential_saving_kg', label: 'Saving (kg)', cls: (r) => (r.potential_saving_kg > 2 ? 'text-emerald-700 font-semibold' : '') },
            ]} />
          </div>
        </Card>
        <Card title="Today's recommendations" subtitle="Approve or dismiss — nothing changes without you.">
          <Recommendations compact key={tick} />
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Predictor />
        <Card title="Leftover monitoring" subtitle="Last 14 meals: prepared vs consumed (kg)">
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={recentChart} margin={{ left: -10, right: 8 }} barGap={1}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="label" {...axisProps} interval={1} tick={{ fontSize: 10, fill: C.ink2 }} />
                <YAxis {...axisProps} />
                <Tooltip content={<Tip unit=" kg" />} cursor={{ fill: '#f4f3ef' }} />
                <Legend />
                <Bar dataKey="consumed_kg" name="Consumed" stackId="a" fill={C.s1} stroke="#fff" strokeWidth={1} />
                <Bar dataKey="leftover_kg" name="Leftover" stackId="a" fill={C.s2} radius={[4, 4, 0, 0]} stroke="#fff" strokeWidth={1} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <Table dense max={180} rows={recent.data} columns={[
            { key: 'date' }, { key: 'meal_type', label: 'Meal' }, { key: 'dish' }, { key: 'attendance' },
            { key: 'prepared_kg', label: 'Prep' }, { key: 'consumed_kg', label: 'Eaten' },
            { key: 'leftover_kg', label: 'Left', cls: (r) => (r.waste_pct > 20 ? 'text-red-700 font-semibold' : '') },
          ]} />
        </Card>
      </div>

      <Inventory data={inv.data} onChange={inv.reload} />

      <div className="grid lg:grid-cols-2 gap-4">
        <EntryForm onSaved={refresh} />
        <Upload onSaved={refresh} />
      </div>
    </div>
  )
}

function Inventory({ data, onChange }) {
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ item: '', quantity: '', unit: 'kg', cost_per_unit: '', daily_usage: '', expiry_date: '' })
  const save = async (e) => {
    e.preventDefault()
    await api('/api/inventory', { method: 'POST', body: JSON.stringify({ ...f, quantity: +f.quantity, cost_per_unit: +f.cost_per_unit || 0, daily_usage: +f.daily_usage || 1 }) })
    setOpen(false); setF({ item: '', quantity: '', unit: 'kg', cost_per_unit: '', daily_usage: '', expiry_date: '' }); onChange()
  }
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  return (
    <Card title="Inventory & expiry tracking (FEFO)" subtitle="First-Expiry-First-Out ranking. ‘At risk’ = quantity that can't be used up at normal daily usage before it expires."
      right={<button className={btn2Cls} onClick={() => setOpen(!open)}><Plus size={15} /> Add stock</button>}>
      {open && (
        <form onSubmit={save} className="grid grid-cols-2 sm:grid-cols-6 gap-3 mb-4 p-4 rounded-xl bg-stone-50">
          <Field label="Item"><input required className={inputCls} value={f.item} onChange={set('item')} /></Field>
          <Field label="Quantity"><input required type="number" step="0.1" className={inputCls} value={f.quantity} onChange={set('quantity')} /></Field>
          <Field label="Unit"><select className={inputCls} value={f.unit} onChange={set('unit')}><option>kg</option><option>L</option><option>pcs</option></select></Field>
          <Field label="Cost / unit (₹)"><input type="number" className={inputCls} value={f.cost_per_unit} onChange={set('cost_per_unit')} /></Field>
          <Field label="Daily usage"><input type="number" step="0.1" className={inputCls} value={f.daily_usage} onChange={set('daily_usage')} /></Field>
          <Field label="Expiry date"><input required type="date" className={inputCls} value={f.expiry_date} onChange={set('expiry_date')} /></Field>
          <div className="col-span-2 sm:col-span-6"><button className={btnCls}>Save batch</button></div>
        </form>
      )}
      <Table max={380} rows={data} columns={[
        { key: 'status', render: (r) => <Badge>{r.status}</Badge> },
        { key: 'item', cls: () => 'font-medium' }, { key: 'batch' }, { key: 'fefo_rank', label: 'FEFO #' },
        { key: 'quantity', label: 'Qty', render: (r) => `${r.quantity} ${r.unit}` },
        { key: 'expiry_date', label: 'Expires' },
        { key: 'days_left', label: 'Days left', cls: (r) => (r.days_left <= 1 ? 'text-red-700 font-semibold' : '') },
        { key: 'daily_usage', label: 'Use/day' },
        { key: 'at_risk_qty', label: 'At risk', render: (r) => (r.at_risk_qty > 0 ? `${r.at_risk_qty} ${r.unit}` : '—') },
        { key: 'value_at_risk', label: '₹ at risk', render: (r) => (r.value_at_risk > 0 ? `₹${fmt(r.value_at_risk, 0)}` : '—') },
      ]} />
    </Card>
  )
}

function EntryForm({ onSaved }) {
  const meta = useApi('/api/meta')
  const today = new Date().toISOString().slice(0, 10)
  const [f, setF] = useState({ date: today, meal_type: 'Lunch', dish: '', attendance: '', prepared_kg: '', consumed_kg: '', rating: '', event_flag: 0 })
  const [msg, setMsg] = useState(null)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? (e.target.checked ? 1 : 0) : e.target.value })
  const save = async (e) => {
    e.preventDefault(); setMsg('Saving & retraining…')
    try {
      const r = await api('/api/records', { method: 'POST', body: JSON.stringify({
        ...f, attendance: +f.attendance, prepared_kg: +f.prepared_kg, consumed_kg: +f.consumed_kg,
        leftover_kg: Math.max(+f.prepared_kg - +f.consumed_kg, 0), rating: f.rating ? +f.rating : null }) })
      setMsg(`Saved ✓ Model retrained on ${r.records} records.`); onSaved()
    } catch (x) { setMsg(`Error: ${x.message}`) }
  }
  const dishes = meta.data?.dishes.filter((d) => d.meal_type === f.meal_type) || []
  const left = f.prepared_kg && f.consumed_kg ? Math.max(+f.prepared_kg - +f.consumed_kg, 0).toFixed(1) : '—'
  return (
    <Card title="Enter today's preparation & leftovers" subtitle="Each entry is cleaned, stored and the model is retrained automatically.">
      <form onSubmit={save} className="grid grid-cols-2 gap-3">
        <Field label="Date"><input type="date" className={inputCls} value={f.date} onChange={set('date')} /></Field>
        <Field label="Meal"><select className={inputCls} value={f.meal_type} onChange={(e) => setF({ ...f, meal_type: e.target.value, dish: '' })}><option>Lunch</option><option>Dinner</option></select></Field>
        <Field label="Dish"><select required className={inputCls} value={f.dish} onChange={set('dish')}><option value="">Select…</option>{dishes.map((d) => <option key={d.dish}>{d.dish}</option>)}</select></Field>
        <Field label="Attendance"><input required type="number" className={inputCls} value={f.attendance} onChange={set('attendance')} /></Field>
        <Field label="Prepared (kg)"><input required type="number" step="0.1" className={inputCls} value={f.prepared_kg} onChange={set('prepared_kg')} /></Field>
        <Field label="Consumed (kg)"><input required type="number" step="0.1" className={inputCls} value={f.consumed_kg} onChange={set('consumed_kg')} /></Field>
        <Field label="Avg rating (optional)"><input type="number" min="1" max="5" step="0.1" className={inputCls} value={f.rating} onChange={set('rating')} /></Field>
        <div className="flex items-end gap-4 pb-2 text-sm"><label className="flex items-center gap-2"><input type="checkbox" checked={!!f.event_flag} onChange={set('event_flag')} className="accent-brand-600 w-4 h-4" /> Event</label><span className="text-ink-2">Leftover: <b className="text-ink">{left} kg</b></span></div>
        <div className="col-span-2 flex items-center gap-3"><button className={btnCls}>Save record</button>{msg && <span className="text-sm text-ink-2">{msg}</span>}</div>
      </form>
    </Card>
  )
}

function Upload({ onSaved }) {
  const [file, setFile] = useState(null)
  const [res, setRes] = useState(null)
  const [busy, setBusy] = useState(false)
  const send = async () => {
    if (!file) return
    setBusy(true); setRes(null)
    const fd = new FormData(); fd.append('file', file)
    try { setRes(await api('/api/upload', { method: 'POST', body: fd })); onSaved() } catch (x) { setRes({ error: x.message }) } finally { setBusy(false) }
  }
  return (
    <Card title="Upload Excel / CSV" subtitle="Bulk-import mess records. Required columns: date, meal_type, dish, attendance, prepared_kg, consumed_kg."
      right={<a className={btn2Cls} href="/api/template.csv"><Download size={15} /> Template</a>}>
      <label className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-stone-300 p-8 text-center cursor-pointer hover:border-brand-500 hover:bg-brand-50/30 transition">
        <FileUp className="text-brand-600" />
        <span className="text-sm font-medium">{file ? file.name : 'Choose a .csv or .xlsx file'}</span>
        <span className="text-xs text-ink-2">Data goes through the same cleaning pipeline, then the model retrains.</span>
        <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => setFile(e.target.files[0])} />
      </label>
      <button className={`${btnCls} mt-3`} disabled={!file || busy} onClick={send}>{busy ? 'Uploading & retraining…' : 'Upload & retrain'}</button>
      {res && (res.error
        ? <div className="mt-3 text-sm text-red-700">{res.error}</div>
        : <div className="mt-3 text-sm rounded-xl bg-emerald-50 text-emerald-900 p-3">Imported {res.rows_uploaded} rows → {res.records_after} clean records (was {res.records_before}). Random Forest test MAE now {res.metrics.find((m) => m.model.startsWith('Random')).mae} kg.</div>)}
    </Card>
  )
}
