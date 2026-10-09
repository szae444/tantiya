import { FileBarChart2, ImageUp, LayoutGrid, Users, WifiOff, Wifi, Cpu } from 'lucide-react';
import { Gauge } from './components/Gauge';
import { needsReview } from './lib/categories';
import { useRoute, useStore } from './lib/store';
import { HouseholdsPage } from './pages/Households';
import { IntakePage } from './pages/Intake';
import { ReportPage } from './pages/Report';
import { TriagePage } from './pages/Triage';

const NAV = [
  { id: 'intake', label: 'Intake', hint: 'Load field photos', icon: ImageUp },
  { id: 'triage', label: 'Triage', hint: 'Review AI suggestions', icon: LayoutGrid },
  { id: 'households', label: 'Households', hint: 'Families & duplicates', icon: Users },
  { id: 'report', label: 'Report', hint: 'Masterlist & export', icon: FileBarChart2 },
] as const;

export function App() {
  const [route, go] = useRoute();
  const { assessments, households } = useStore();
  const reviewCount = assessments.filter(needsReview).length;
  const counts: Record<string, number | undefined> = {
    intake: undefined,
    triage: reviewCount || undefined,
    households: households.length || undefined,
  };

  return (
    <div className="flex h-full flex-col md:flex-row">
      {/* Phones: compact header + tab bar (field staff uploading over local Wi-Fi) */}
      <header className="no-print flex items-center justify-between border-b border-line px-4 py-3 md:hidden">
        <img src="/logo.png" alt="Tantiya" className="h-auto w-[120px]" />
        <nav className="flex gap-1">
          {NAV.map((n) => {
            const Icon = n.icon;
            return (
              <button key={n.id} onClick={() => go(n.id)} aria-label={n.label}
                className={`rounded-lg p-2.5 ${route === n.id ? 'bg-ink-2 text-coral' : 'text-fg-2'}`}>
                <Icon size={20} />
              </button>
            );
          })}
        </nav>
      </header>
      <aside className="no-print hidden w-[248px] shrink-0 flex-col border-r border-line bg-ink-0 md:flex">
        <a href="#/triage" className="block px-5 pt-5 pb-6" aria-label="Tantiya home">
          <img src="/logo.png" alt="Tantiya" className="h-auto w-[170px]" />
        </a>
        <nav className="flex flex-col gap-1 px-3">
          {NAV.map((n) => {
            const active = route === n.id;
            const Icon = n.icon;
            return (
              <button
                key={n.id}
                onClick={() => go(n.id)}
                className={`group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors duration-200 ${active ? 'bg-ink-2 text-fg' : 'text-fg-2 hover:bg-ink-1 hover:text-fg'}`}
              >
                {active && <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-coral" />}
                <Icon size={18} strokeWidth={1.9} />
                <span className="flex-1">
                  <span className="block text-[15px] font-semibold" style={{ fontStretch: '110%' }}>{n.label}</span>
                  <span className="block text-[12px] text-fg-3">{n.hint}</span>
                </span>
                {counts[n.id] !== undefined && (
                  <span className={`rounded-md px-1.5 font-mono text-[12px] ${n.id === 'triage' ? 'bg-coral/15 text-coral' : 'bg-ink-3 text-fg-2'}`}>
                    {counts[n.id]}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
        <div className="mt-auto px-5 pb-5">
          <EngineStatus />
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto">
        {route === 'intake' && <IntakePage />}
        {route === 'triage' && <TriagePage />}
        {route === 'households' && <HouseholdsPage />}
        {route === 'report' && <ReportPage />}
      </main>
    </div>
  );
}

function EngineStatus() {
  const { health, queue, connected } = useStore();
  const ollama = health?.ollama;
  const busy = queue.running || queue.queued > 0;
  const aiState = !connected || !health ? 'App server offline'
    : !ollama?.reachable ? 'AI engine not running'
    : busy ? 'Analyzing photos'
    : ollama.warm ? 'AI ready' : 'AI idle (loads on first photo)';
  const aiOk = connected && ollama?.reachable;

  return (
    <div className="rounded-xl border border-line bg-ink-1 p-4">
      <div className="flex items-center gap-3">
        <Gauge value={queue.total ? queue.done / queue.total : aiOk ? 1 : 0} size={44} live={busy} />
        <div className="min-w-0">
          <div className="label-mono text-fg-3">On this laptop</div>
          <div className="truncate text-sm font-semibold">{aiState}</div>
          {busy && <div className="font-mono text-[12px] text-fg-2">{queue.done} of {queue.total} done</div>}
        </div>
      </div>
      <dl className="mt-3 space-y-1.5 border-t border-line pt-3 text-[13px]">
        <div className="flex items-center justify-between">
          <dt className="flex items-center gap-1.5 text-fg-3"><Cpu size={13} /> Model</dt>
          <dd className="font-mono text-[12px] text-fg-2">{ollama?.visionModel ?? '—'}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="flex items-center gap-1.5 text-fg-3">{health?.internet ? <Wifi size={13} /> : <WifiOff size={13} />} Internet</dt>
          <dd className={`whitespace-nowrap font-mono text-[12px] ${health?.internet ? 'text-fg-2' : 'font-semibold text-minor'}`}>
            {health ? (health.internet ? 'connected' : 'offline') : '—'}
          </dd>
        </div>
        {health && !health.internet && (
          <div className="flex items-center gap-1.5 rounded-md bg-minor/10 px-2 py-1 text-[12px] text-minor">
            <span className="size-1.5 rounded-full bg-minor" /> Everything still works offline
          </div>
        )}
      </dl>
    </div>
  );
}
