import { useMemo, useState } from 'react';
import { HouseholdForm } from '../components/HouseholdForm';
import { EmptyState, inputClass, PageHeader } from '../components/ui';
import { useStore } from '../lib/store';

export function HouseholdsPage() {
  const { households, refreshHouseholds } = useStore();
  const [q, setQ] = useState('');
  const [justAdded, setJustAdded] = useState<string | null>(null);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? households.filter((h) => `${h.headName} ${h.barangay} ${h.streetPurok ?? ''}`.toLowerCase().includes(s)) : households;
  }, [households, q]);

  const barangays = new Set(households.map((h) => h.barangay)).size;

  return (
    <div>
      <PageHeader kicker="Step 3 · Households" title="Families">
        <span className="font-mono text-[13px] text-fg-2"><b className="text-fg">{households.length}</b> families · <b className="text-fg">{barangays}</b> barangays</span>
      </PageHeader>

      <div className="grid gap-8 px-5 md:px-10 py-8 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="min-w-0">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, barangay or purok…" className={`${inputClass} max-w-md`} />
          {households.length === 0 ? (
            <EmptyState title="No families yet" body="Add families here or while reviewing a photo. Tantiya checks every new family against the list for duplicates." />
          ) : (
            <div className="mt-5 overflow-hidden rounded-xl border border-line">
              <table className="w-full text-left text-[14px]">
                <thead className="bg-ink-1">
                  <tr className="label-mono text-fg-3">
                    <th className="px-4 py-3 font-medium">Family head</th>
                    <th className="px-4 py-3 font-medium">Barangay</th>
                    <th className="px-4 py-3 font-medium">Street / Purok</th>
                    <th className="px-4 py-3 text-right font-medium">Size</th>
                    <th className="px-4 py-3 text-right font-medium">Photos</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((h) => (
                    <tr key={h.id} className="border-t border-line transition-colors hover:bg-ink-1">
                      <td className="px-4 py-2.5 font-semibold">
                        {h.headName}
                        {h.isSample && <span className="ml-2 rounded bg-ink-3 px-1.5 py-px font-mono text-[10px] uppercase tracking-wider text-fg-3">sample</span>}
                      </td>
                      <td className="px-4 py-2.5 text-fg-2">{h.barangay}</td>
                      <td className="px-4 py-2.5 text-fg-2">{h.streetPurok ?? '—'}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-fg-2">{h.familySize ?? '—'}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-fg-2">{h.photoCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <aside>
          <div className="rounded-xl border border-line bg-ink-1 p-5">
            <h2 className="display text-xl">Add a family</h2>
            <p className="mt-1 mb-4 text-[14px] text-fg-2">Checked against existing families by name and address, including spelling variants, using a small AI model on this laptop.</p>
            <HouseholdForm onCreated={(h) => { setJustAdded(h.headName); void refreshHouseholds(); }} />
            {justAdded && <p className="mt-3 text-[14px] text-minor">Added {justAdded}.</p>}
          </div>
        </aside>
      </div>
    </div>
  );
}
