import { Search, Unlink, UserRound } from 'lucide-react';
import { useMemo, useState } from 'react';
import { api, type Assessment, type Household } from '../lib/api';
import { useStore } from '../lib/store';
import { HouseholdForm } from './HouseholdForm';
import { Button, inputClass } from './ui';

/** Links a photo to a family: search existing households or add a new one (with duplicate check). */
export function HouseholdLink({ assessment }: { assessment: Assessment }) {
  const { households, upsert, refreshHouseholds } = useStore();
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return households.filter((h) => `${h.headName} ${h.barangay} ${h.streetPurok ?? ''}`.toLowerCase().includes(q)).slice(0, 6);
  }, [households, query]);

  async function link(h: Household | null) {
    upsert(await api.link(assessment.id, h?.id ?? null));
    setQuery('');
    setAdding(false);
    void refreshHouseholds();
  }

  const linked = assessment.household;
  return (
    <section>
      <div className="label-mono text-fg-3">Family</div>
      {linked ? (
        <div className="mt-2 flex items-center gap-3 rounded-xl border border-line bg-ink-0 px-4 py-3">
          <UserRound size={18} className="text-fg-2" />
          <div className="min-w-0 flex-1">
            <div className="font-semibold">{linked.headName}</div>
            <div className="text-[13px] text-fg-3">{linked.barangay}{linked.streetPurok ? ` · ${linked.streetPurok}` : ''}</div>
          </div>
          <Button variant="ghost" onClick={() => void link(null)}><Unlink size={15} /> Unlink</Button>
        </div>
      ) : adding ? (
        <div className="mt-2 rounded-xl border border-line bg-ink-0 p-4">
          <HouseholdForm compact onCreated={(h) => void link(h)} onUseExisting={(h) => void link(h)} onCancel={() => setAdding(false)} />
        </div>
      ) : (
        <div className="mt-2">
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-3" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search family head or barangay…" className={`${inputClass} pl-9`} />
          </div>
          {matches.length > 0 && (
            <ul className="mt-2 overflow-hidden rounded-lg border border-line">
              {matches.map((h) => (
                <li key={h.id}>
                  <button onClick={() => void link(h)} className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-[14px] hover:bg-ink-3">
                    <span><b>{h.headName}</b> · {h.barangay}{h.streetPurok ? ` · ${h.streetPurok}` : ''}</span>
                    <span className="font-mono text-[12px] text-fg-3">{h.photoCount} photo{h.photoCount === 1 ? '' : 's'}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <Button variant="ghost" className="mt-2" onClick={() => setAdding(true)}>+ Add a new family</Button>
        </div>
      )}
    </section>
  );
}
