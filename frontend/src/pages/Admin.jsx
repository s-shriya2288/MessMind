import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Download, RotateCcw } from 'lucide-react'
import { C, Card, Loading, Table, Tip, api, axisProps, btn2Cls, btnCls, fmt, gridProps, useApi } from '../ui.jsx'

const MESS_COLOR = { 'Hostel A': C.s1, 'Hostel B': C.s2, 'Hostel C': C.s3 }
const CAT_COLOR = [C.s1, C.s2, C.s3, C.s4]

export default function Admin() {
  const { data, error, reload } = useApi('/api/admin/compare')
  const [busy, setBusy] = useState(false)
  if (!data) return <Loading error={error} />
  const m = data.messes
  const cats = Object.keys(m[0].categories)
  const catRows = m.map((x) => ({ mess: x.mess, ...x.categories }))
  const best = [...m].sort((a, b) => a.waste_pct - b.waste_pct)[0]
  const reset = async () => {
    if (!window.confirm('Reset all demo data (removes uploaded records, feedback and votes) and retrain?')) return
    setBusy(true); await api('/api/admin/reset', { method: 'POST' }); setBusy(false); reload()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold tracking-[0.18em] text-brand-600">ADMINISTRATOR DASHBOARD</div>
          <h1 className="text-3xl font-extrabold tracking-tight mt-1">Compare messes</h1>
          <p className="text-ink-2 mt-1">Monitor waste across institutions, view illustrative financial metrics and generate sustainability reports.</p>
        </div>
        <div className="flex gap-2">
          <a href="/api/admin/report.xlsx" className={btnCls}><Download size={15} /> Sustainability report (.xlsx)</a>
          <button onClick={reset} disabled={busy} className={btn2Cls}><RotateCcw size={15} /> {busy ? 'Resetting…' : 'Reset demo data'}</button>
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        {m.map((x) => (
          <div key={x.mess} className="bg-white rounded-2xl border border-stone-200 p-5">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-sm" style={{ background: MESS_COLOR[x.mess] }} />
              <span className="font-semibold">{x.mess}</span>
              {x.mess === best.mess && <span className="ml-auto text-[11px] font-semibold text-emerald-800 bg-emerald-50 ring-1 ring-emerald-200 rounded-full px-2 py-0.5">✓ Lowest waste</span>}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <KV k="Waste rate" v={`${x.waste_pct}%`} />
              <KV k="Leftover" v={`${fmt(x.leftover_kg, 0)} kg`} />
              <KV k="Cost of waste" v={`₹${fmt(x.waste_cost_inr, 0)}`} />
              <KV k="Avg rating" v={`${x.avg_rating} / 5`} />
              <KV k="Avg attendance" v={fmt(x.avg_attendance, 0)} />
              <KV k="Leftover / day" v={`${x.leftover_per_day_kg} kg`} />
            </div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card title="Weekly waste rate by mess" subtitle="Leftover as % of prepared">
          <div className="h-72">
            <ResponsiveContainer>
              <LineChart data={data.trend} margin={{ left: -10, right: 8 }}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="week" {...axisProps} minTickGap={24} />
                <YAxis {...axisProps} unit="%" />
                <Tooltip content={<Tip unit="%" />} />
                <Legend iconType="plainline" />
                {m.map((x) => <Line key={x.mess} dataKey={x.mess} stroke={MESS_COLOR[x.mess]} strokeWidth={2} dot={false} />)}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Waste by category per mess" subtitle="Total kg in each of the four waste categories">
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={catRows} margin={{ left: -5, right: 8 }}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="mess" {...axisProps} />
                <YAxis {...axisProps} />
                <Tooltip content={<Tip unit=" kg" />} cursor={{ fill: '#f4f3ef' }} />
                <Legend />
                {cats.map((c, i) => <Bar key={c} dataKey={c} stackId="a" fill={CAT_COLOR[i]} stroke="#fff" strokeWidth={2} barSize={60} radius={i === cats.length - 1 ? [4, 4, 0, 0] : 0} />)}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card title="Illustrative financial metric: cost of leftovers" subtitle="₹ over the 180-day period (leftover kg × dish ingredient cost)">
          <div className="h-60">
            <ResponsiveContainer>
              <BarChart data={m} layout="vertical" margin={{ left: 10, right: 40 }}>
                <CartesianGrid {...gridProps} horizontal={false} vertical />
                <XAxis type="number" {...axisProps} tickFormatter={(v) => `₹${v / 1000}k`} />
                <YAxis type="category" dataKey="mess" {...axisProps} width={70} />
                <Tooltip content={<Tip />} cursor={{ fill: '#f4f3ef' }} />
                <Bar dataKey="waste_cost_inr" name="₹ cost of leftovers" fill={C.s2} radius={[0, 4, 4, 0]} barSize={28} label={{ position: 'right', fontSize: 11, fill: C.ink2, formatter: (v) => `₹${fmt(v / 1000, 0)}k` }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Mess KPI table">
          <Table rows={m} columns={[
            { key: 'mess' }, { key: 'meals' }, { key: 'prepared_kg', label: 'Prepared kg' }, { key: 'consumed_kg', label: 'Consumed kg' },
            { key: 'leftover_kg', label: 'Leftover kg' }, { key: 'waste_pct', label: 'Waste %' }, { key: 'avg_rating', label: 'Rating' },
          ]} />
          <p className="text-[11px] text-ink-3 mt-3">Future scope: multi-institution analytics, computer vision plate-waste capture, IoT weighing scales, advanced forecasting and NGO integration for safe untouched surplus (under food-safety controls).</p>
        </Card>
      </div>
    </div>
  )
}

function KV({ k, v }) {
  return <div><div className="text-[11px] text-ink-3">{k}</div><div className="font-semibold tabular-nums">{v}</div></div>
}
