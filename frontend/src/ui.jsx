import { useEffect, useState } from 'react'

// ---------------------------------------------------------------- data access
export async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: opts.body && !(opts.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {},
    ...opts,
  })
  if (!res.ok) {
    let msg = res.statusText
    try { msg = (await res.json()).detail || msg } catch { /* ignore */ }
    throw new Error(msg)
  }
  return res.json()
}

export function useApi(path, deps = []) {
  const [state, set] = useState({ data: null, error: null, loading: true })
  const load = () => {
    set((s) => ({ ...s, loading: true }))
    api(path).then((data) => set({ data, error: null, loading: false }))
      .catch((error) => set({ data: null, error: error.message, loading: false }))
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [path, ...deps])
  return { ...state, reload: load }
}

// ---------------------------------------------------------------- chart tokens
// Categorical order (validated, CVD-safe for adjacent pairs): blue, orange, aqua.
export const C = {
  s1: '#2a78d6', s2: '#eb6834', s3: '#1baf7a', s4: '#eda100', s5: '#e87ba4', s6: '#6250d6',
  grid: '#e8e7e3', axis: '#8a8984', ink2: '#52514e', muted: '#c9c8c2',
}
export const SEQ = ['#f2f7fd', '#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#184f95', '#0d366b']
export const axisProps = { stroke: C.axis, tick: { fontSize: 11, fill: C.ink2 }, tickLine: false, axisLine: { stroke: C.grid } }
export const gridProps = { stroke: C.grid, strokeDasharray: '0', vertical: false }
export const fmt = (n, d = 1) => (n === null || n === undefined || Number.isNaN(n) ? '—' : Number(n).toLocaleString('en-IN', { maximumFractionDigits: d }))

// ---------------------------------------------------------------- primitives
export function Card({ title, subtitle, right, children, className = '' }) {
  return (
    <section className={`bg-white rounded-2xl border border-stone-200/80 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ${className}`}>
      {(title || right) && (
        <header className="flex items-start justify-between gap-3 px-5 pt-4">
          <div>
            {title && <h3 className="text-[15px] font-semibold text-ink">{title}</h3>}
            {subtitle && <p className="text-xs text-ink-2 mt-0.5 leading-relaxed">{subtitle}</p>}
          </div>
          {right}
        </header>
      )}
      <div className="p-5 pt-3">{children}</div>
    </section>
  )
}

export function Stat({ label, value, unit, hint, tone = 'default' }) {
  const toneCls = { default: 'text-ink', good: 'text-emerald-700', bad: 'text-red-700', brand: 'text-brand-600' }[tone]
  return (
    <div className="bg-white rounded-2xl border border-stone-200/80 px-5 py-4">
      <div className="text-[11px] uppercase tracking-wider font-semibold text-ink-3">{label}</div>
      <div className={`mt-1 text-2xl font-bold tabular-nums ${toneCls}`}>
        {value}{unit && <span className="text-sm font-medium text-ink-2 ml-1">{unit}</span>}
      </div>
      {hint && <div className="text-xs text-ink-2 mt-1">{hint}</div>}
    </div>
  )
}

const BADGE = {
  High: 'bg-red-50 text-red-800 ring-red-200', 'Use today': 'bg-red-50 text-red-800 ring-red-200',
  Medium: 'bg-amber-50 text-amber-800 ring-amber-200', 'At risk': 'bg-amber-50 text-amber-800 ring-amber-200',
  'Use soon': 'bg-amber-50 text-amber-800 ring-amber-200',
  Low: 'bg-stone-100 text-stone-700 ring-stone-200', OK: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
}
const ICON = { High: '▲', 'Use today': '⚠', Medium: '●', 'At risk': '!', 'Use soon': '●', Low: '○', OK: '✓' }
export function Badge({ children }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${BADGE[children] || 'bg-stone-100 text-stone-700 ring-stone-200'}`}>
      {ICON[children] && <span aria-hidden>{ICON[children]}</span>}{children}
    </span>
  )
}

export function Loading({ error }) {
  if (error) return <div className="p-6 text-sm text-red-700 bg-red-50 rounded-xl">Couldn't load data: {error}. Is the backend running on port 8000?</div>
  return <div className="p-10 text-center text-sm text-ink-2 animate-pulse">Crunching the numbers…</div>
}

export function Table({ columns, rows, max = 400, dense }) {
  return (
    <div className="overflow-auto rounded-xl border border-stone-200" style={{ maxHeight: max }}>
      <table className="w-full text-xs">
        <thead className="bg-stone-50 sticky top-0 z-10">
          <tr>{columns.map((c) => <th key={c.key} className={`text-left font-semibold text-ink-2 px-3 ${dense ? 'py-1.5' : 'py-2'} whitespace-nowrap`}>{c.label ?? c.key}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-stone-100 hover:bg-stone-50/70">
              {columns.map((c) => {
                const v = r[c.key]
                const isNull = !c.render && (v === null || v === undefined || (typeof v === 'number' && Number.isNaN(v)))
                return (
                  <td key={c.key} className={`px-3 ${dense ? 'py-1' : 'py-1.5'} whitespace-nowrap tabular-nums ${isNull ? 'bg-red-50 text-red-700 italic' : ''} ${c.cls ? c.cls(r) : ''}`}>
                    {c.render ? c.render(r) : isNull ? 'NaN' : typeof v === 'number' ? fmt(v, 2) : String(v)}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-1 bg-stone-100 p-1 rounded-xl w-fit">
      {tabs.map((t) => (
        <button key={t.id} onClick={() => onChange(t.id)}
          className={`px-3.5 py-1.5 text-sm rounded-lg font-medium transition ${value === t.id ? 'bg-white shadow text-ink' : 'text-ink-2 hover:text-ink'}`}>
          {t.label}
        </button>
      ))}
    </div>
  )
}

export function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-ink-2">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  )
}
export const inputCls = 'w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500'
export const btnCls = 'inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 text-white px-4 py-2 text-sm font-semibold hover:bg-brand-700 disabled:opacity-50 transition'
export const btn2Cls = 'inline-flex items-center justify-center gap-2 rounded-lg border border-stone-300 bg-white text-ink px-3 py-2 text-sm font-medium hover:bg-stone-50 transition'

// Custom tooltip in text ink with a colour swatch carrying identity
export function Tip({ active, payload, label, unit = '' }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg bg-white/95 backdrop-blur shadow-lg ring-1 ring-stone-200 px-3 py-2 text-xs">
      {label !== undefined && <div className="font-semibold text-ink mb-1">{label}</div>}
      {payload.filter((p) => p.value !== undefined && p.value !== null).map((p) => (
        <div key={p.dataKey + p.name} className="flex items-center gap-2 text-ink-2">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: p.color || p.fill || p.stroke }} />
          <span>{p.name}</span>
          <span className="ml-auto pl-3 font-semibold text-ink tabular-nums">
            {Array.isArray(p.value) ? `${fmt(p.value[0])} – ${fmt(p.value[1])}` : fmt(p.value, 2)}{unit}
          </span>
        </div>
      ))}
    </div>
  )
}

// Heatmap grid (sequential or diverging) with hover readout
export function Heatmap({ rows, cols, values, diverging = false, suffix = '', min, max }) {
  const [hover, setHover] = useState(null)
  const flat = values.flat()
  const lo = min ?? Math.min(...flat), hi = max ?? Math.max(...flat)
  const color = (v) => {
    if (diverging) {
      const t = Math.max(-1, Math.min(1, v))
      const a = Math.abs(t)
      if (a < 0.05) return '#f1f0ed'
      return t > 0 ? `rgba(42,120,214,${0.12 + a * 0.88})` : `rgba(227,73,72,${0.12 + a * 0.88})`
    }
    const t = (v - lo) / (hi - lo || 1)
    return SEQ[Math.min(SEQ.length - 1, Math.floor(t * SEQ.length))]
  }
  const textOn = (v) => (diverging ? Math.abs(v) > 0.55 : (v - lo) / (hi - lo || 1) > 0.55) ? '#fff' : '#0b0b0b'
  return (
    <div className="overflow-x-auto">
      <div className="inline-grid gap-[2px] text-[11px]" style={{ gridTemplateColumns: `minmax(120px,auto) repeat(${cols.length}, minmax(64px,1fr))` }}>
        <div />
        {cols.map((c) => <div key={c} className="text-center text-ink-2 font-medium pb-1 px-1 truncate" title={c}>{c}</div>)}
        {rows.map((r, i) => [
          <div key={r} className="pr-2 text-ink-2 flex items-center justify-end text-right">{r}</div>,
          ...cols.map((c, j) => (
            <div key={r + c} onMouseEnter={() => setHover({ r, c, v: values[i][j] })} onMouseLeave={() => setHover(null)}
              className="h-8 rounded-[4px] flex items-center justify-center tabular-nums cursor-default transition-transform hover:scale-105"
              style={{ background: color(values[i][j]), color: textOn(values[i][j]) }}>
              {fmt(values[i][j], diverging ? 2 : 0)}
            </div>
          )),
        ])}
      </div>
      <div className="h-5 mt-2 text-xs text-ink-2">{hover ? <><b className="text-ink">{hover.r}</b> × <b className="text-ink">{hover.c}</b>: {fmt(hover.v, 2)}{suffix}</> : 'Hover a cell for details'}</div>
    </div>
  )
}

export function Note({ children }) {
  return <p className="text-[11px] text-ink-3 mt-3 leading-relaxed">{children}</p>
}
