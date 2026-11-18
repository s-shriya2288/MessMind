import { useState } from 'react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Leaf, ThumbsDown, ThumbsUp, Star } from 'lucide-react'
import { C, Card, Field, Loading, Stat, Tip, api, axisProps, btnCls, fmt, gridProps, inputCls, useApi } from '../ui.jsx'

export default function Student() {
  const meta = useApi('/api/meta')
  const fb = useApi('/api/feedback?n=12')
  const sus = useApi('/api/sustainability')
  const [votes, setVotes] = useState(null)
  const v = useApi('/api/votes')
  const voteList = votes || v.data
  if (!meta.data || !fb.data || !sus.data || !voteList) return <Loading error={meta.error || fb.error || sus.error || v.error} />

  const vote = async (dish, up) => setVotes(await api('/api/votes', { method: 'POST', body: JSON.stringify({ dish, up }) }))
  const s = sus.data
  return (
    <div className="space-y-6">
      <div>
        <div className="text-[11px] font-semibold tracking-[0.18em] text-brand-600">STUDENT DASHBOARD</div>
        <h1 className="text-3xl font-extrabold tracking-tight mt-1">Your mess, your voice</h1>
        <p className="text-ink-2 mt-1">Rate meals, vote on dishes and see how much food your hostel is saving.</p>
      </div>

      <div className="rounded-2xl bg-gradient-to-r from-brand-700 to-brand-500 text-white p-6 grid sm:grid-cols-4 gap-4">
        <div className="sm:col-span-1 flex items-center gap-3"><Leaf size={36} className="text-brand-100" /><div><div className="font-bold text-lg leading-tight">Sustainability progress</div><div className="text-xs text-brand-100/80">Simulated, last {s.period_meals} meals</div></div></div>
        <Big v={`${fmt(s.food_saved_kg, 0)} kg`} l="food that need not be cooked" />
        <Big v={fmt(s.meals_equivalent, 0)} l="plates' worth of food" />
        <Big v={`${fmt(s.co2e_kg, 0)} kg`} l="CO₂e avoided (est.)" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <RateMeal dishes={meta.data.dishes} onSaved={fb.reload} />
        <Card className="lg:col-span-2" title="Vote for next week's menu" subtitle="Up-vote dishes you want more often; down-votes flag dishes for review.">
          <div className="grid sm:grid-cols-2 gap-2 max-h-[420px] overflow-auto pr-1">
            {voteList.map((d) => {
              const total = d.upvotes + d.downvotes
              return (
                <div key={d.dish} className="rounded-xl border border-stone-200 p-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">{d.dish}</div>
                    <div className="text-[11px] text-ink-2">{d.meal_type} · score {d.score > 0 ? '+' : ''}{d.score}</div>
                    <div className="h-1.5 rounded-full bg-stone-100 mt-1.5 overflow-hidden flex">
                      <div style={{ width: `${(d.upvotes / total) * 100}%`, background: C.s3 }} />
                      <div style={{ width: `${(d.downvotes / total) * 100}%`, background: C.s2 }} />
                    </div>
                  </div>
                  <button onClick={() => vote(d.dish, true)} className="flex items-center gap-1 text-xs font-semibold rounded-lg px-2 py-1.5 hover:bg-emerald-50 text-emerald-800" aria-label={`Upvote ${d.dish}`}><ThumbsUp size={14} />{d.upvotes}</button>
                  <button onClick={() => vote(d.dish, false)} className="flex items-center gap-1 text-xs font-semibold rounded-lg px-2 py-1.5 hover:bg-red-50 text-red-800" aria-label={`Downvote ${d.dish}`}><ThumbsDown size={14} />{d.downvotes}</button>
                </div>
              )
            })}
          </div>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card title="Dish ratings" subtitle="Average student rating (1–5) from surveys">
          <div className="h-96">
            <ResponsiveContainer>
              <BarChart data={fb.data.dish_ratings} layout="vertical" margin={{ left: 20, right: 30 }}>
                <CartesianGrid {...gridProps} horizontal={false} vertical />
                <XAxis type="number" domain={[0, 5]} {...axisProps} />
                <YAxis type="category" dataKey="dish" {...axisProps} width={140} />
                <Tooltip content={<Tip />} cursor={{ fill: '#f4f3ef' }} />
                <Bar dataKey="rating" name="Avg rating" fill={C.s1} radius={[0, 4, 4, 0]} barSize={14} label={{ position: 'right', fontSize: 10, fill: C.ink2 }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <div className="space-y-4">
          <Card title="Food saved over time" subtitle="Cumulative kg if recommended preparation had been followed">
            <div className="h-44">
              <ResponsiveContainer>
                <AreaChart data={s.cumulative} margin={{ left: -15, right: 4 }}>
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="date" {...axisProps} minTickGap={40} tickFormatter={(d) => d.slice(5)} />
                  <YAxis {...axisProps} />
                  <Tooltip content={<Tip unit=" kg" />} />
                  <Area dataKey="saved" name="Saved" stroke={C.s3} strokeWidth={2} fill={C.s3} fillOpacity={0.15} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card title="Recent feedback">
            <ul className="divide-y divide-stone-100 max-h-56 overflow-auto">
              {fb.data.recent.map((r, i) => (
                <li key={i} className="py-2 flex items-start gap-3 text-sm">
                  <span className="text-amber-600 font-semibold tabular-nums w-12 shrink-0">{'★'.repeat(r.rating)}</span>
                  <div className="flex-1"><b>{r.dish}</b> <span className="text-ink-2">— {r.comment || 'no comment'}</span><div className="text-[11px] text-ink-3">{r.date} · portion: {r.portion}</div></div>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  )
}

function RateMeal({ dishes, onSaved }) {
  const [f, setF] = useState({ meal_type: 'Lunch', dish: '', rating: 0, portion: 'Just right', comment: '' })
  const [msg, setMsg] = useState(null)
  const save = async (e) => {
    e.preventDefault()
    if (!f.dish || !f.rating) { setMsg('Pick a dish and a star rating.'); return }
    await api('/api/feedback', { method: 'POST', body: JSON.stringify(f) })
    setMsg('Thanks! Your anonymous feedback was recorded.'); setF({ ...f, rating: 0, comment: '' }); onSaved()
  }
  return (
    <Card title="Rate today's meal" subtitle="Anonymous — feeds the preference analysis.">
      <form onSubmit={save} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Meal"><select className={inputCls} value={f.meal_type} onChange={(e) => setF({ ...f, meal_type: e.target.value, dish: '' })}><option>Lunch</option><option>Dinner</option></select></Field>
          <Field label="Dish"><select className={inputCls} value={f.dish} onChange={(e) => setF({ ...f, dish: e.target.value })}><option value="">Select…</option>{dishes.filter((d) => d.meal_type === f.meal_type).map((d) => <option key={d.dish}>{d.dish}</option>)}</select></Field>
        </div>
        <Field label="Rating">
          <div className="flex gap-1">{[1, 2, 3, 4, 5].map((n) => (
            <button type="button" key={n} onClick={() => setF({ ...f, rating: n })} aria-label={`${n} stars`}>
              <Star size={28} className={n <= f.rating ? 'fill-amber-400 text-amber-500' : 'text-stone-300'} />
            </button>))}</div>
        </Field>
        <Field label="Portion size">
          <div className="flex gap-1">{['Too little', 'Just right', 'Too much'].map((p) => (
            <button type="button" key={p} onClick={() => setF({ ...f, portion: p })} className={`flex-1 text-xs rounded-lg py-2 border ${f.portion === p ? 'border-brand-600 bg-brand-50 text-brand-700 font-semibold' : 'border-stone-300'}`}>{p}</button>))}</div>
        </Field>
        <Field label="Comment"><textarea rows={2} className={inputCls} value={f.comment} onChange={(e) => setF({ ...f, comment: e.target.value })} placeholder="Too salty? Loved it?" /></Field>
        <button className={btnCls}>Submit feedback</button>
        {msg && <div className="text-sm text-ink-2">{msg}</div>}
      </form>
    </Card>
  )
}

function Big({ v, l }) {
  return <div><div className="text-3xl font-extrabold tabular-nums">{v}</div><div className="text-xs text-brand-100/85">{l}</div></div>
}
