import { useEffect, useState } from 'react'
import { BarChart3, ChefHat, FlaskConical, GraduationCap, LayoutDashboard, ShieldCheck, Menu, X } from 'lucide-react'
import Overview from './pages/Overview.jsx'
import DataLab from './pages/DataLab.jsx'
import Manager from './pages/Manager.jsx'
import Student from './pages/Student.jsx'
import Admin from './pages/Admin.jsx'

const NAV = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard, el: Overview },
  { id: 'lab', label: 'Data Science Lab', icon: FlaskConical, el: DataLab },
  { id: 'manager', label: 'Mess Manager', icon: ChefHat, el: Manager },
  { id: 'student', label: 'Student', icon: GraduationCap, el: Student },
  { id: 'admin', label: 'Administrator', icon: ShieldCheck, el: Admin },
]

function readHash() {
  const [page, sub] = window.location.hash.replace('#', '').split('/')
  return { page: NAV.some((n) => n.id === page) ? page : 'overview', sub }
}

export default function App() {
  const [route, setRoute] = useState(readHash())
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const h = () => { setRoute(readHash()); setOpen(false); window.scrollTo(0, 0) }
    window.addEventListener('hashchange', h)
    return () => window.removeEventListener('hashchange', h)
  }, [])
  const go = (page, sub) => { window.location.hash = sub ? `${page}/${sub}` : page }
  const Page = NAV.find((n) => n.id === route.page).el

  return (
    <div className="min-h-full lg:flex">
      <aside className={`fixed lg:sticky top-0 z-40 h-screen w-64 shrink-0 bg-brand-900 text-white flex flex-col transition-transform ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="px-6 pt-6 pb-8">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-brand-500 grid place-items-center"><BarChart3 size={20} /></div>
            <div>
              <div className="font-extrabold tracking-wide text-lg leading-none">MESSMIND</div>
              <div className="text-[11px] text-brand-100/70 mt-1">Predict · Prevent · Preserve</div>
            </div>
          </div>
        </div>
        <nav className="px-3 space-y-1 flex-1">
          {NAV.map(({ id, label, icon: Icon }) => (
            <a key={id} href={`#${id}`}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${route.page === id ? 'bg-white/12 text-white bg-white/10' : 'text-brand-100/75 hover:bg-white/5 hover:text-white'}`}>
              <Icon size={18} /> {label}
            </a>
          ))}
        </nav>
        <div className="m-4 p-4 rounded-xl bg-white/5 text-[11px] leading-relaxed text-brand-100/70">
          All figures come from a <b className="text-white">synthetic demonstration dataset</b>. Validate with real mess records before deployment.
        </div>
      </aside>
      {open && <div className="fixed inset-0 bg-black/30 z-30 lg:hidden" onClick={() => setOpen(false)} />}
      <main className="flex-1 min-w-0">
        <div className="lg:hidden sticky top-0 z-20 bg-brand-900 text-white px-4 py-3 flex items-center gap-3">
          <button onClick={() => setOpen(!open)} aria-label="Menu">{open ? <X /> : <Menu />}</button>
          <span className="font-extrabold tracking-wide">MESSMIND</span>
        </div>
        <div className="max-w-[1400px] mx-auto px-4 sm:px-8 py-6 sm:py-8">
          <Page sub={route.sub} go={go} />
        </div>
      </main>
    </div>
  )
}
