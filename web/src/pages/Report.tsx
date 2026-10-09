import { Download, Printer } from 'lucide-react';
import { useEffect, useState } from 'react';
import { CategoryBadge } from '../components/CategoryBadge';
import { Button, PageHeader } from '../components/ui';
import { api, type Category, type Summary } from '../lib/api';
import { CATEGORIES } from '../lib/categories';
import { useStore } from '../lib/store';

export function ReportPage() {
  const { assessments } = useStore();
  const [summary, setSummary] = useState<Summary | null>(null);

  // Refresh whenever any decision changes.
  const decidedKey = assessments.map((a) => `${a.id}:${a.finalCategory}:${a.householdId}`).join(',');
  useEffect(() => { void api.summary().then(setSummary); }, [decidedKey]);

  const decided = assessments
    .filter((a) => a.finalCategory)
    .sort((a, b) => (a.household?.barangay ?? '~').localeCompare(b.household?.barangay ?? '~') || a.id - b.id);
  const count = (c: Category) => summary?.byFinal.find((x) => x.category === c)?.count ?? 0;
  const barangays = [...new Set(summary?.byBarangay.map((r) => r.barangay) ?? [])];
  const cell = (b: string, c: Category) => summary?.byBarangay.find((r) => r.barangay === b && r.category === c)?.count ?? 0;
  const t = summary?.totals;
  const today = new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="print-page">
      <div className="no-print">
        <PageHeader kicker="Step 4 · Report" title="Damage report">
          <Button variant="secondary" onClick={() => { window.location.href = '/api/export.csv'; }}><Download size={16} /> Download masterlist (CSV)</Button>
          <Button variant="primary" onClick={() => window.print()}><Printer size={16} /> Print / Save as PDF</Button>
        </PageHeader>
      </div>

      <div className="px-5 md:px-10 py-8">
        <div className="hidden print:block">
          <div className="text-[22px] font-extrabold" style={{ fontStretch: '125%' }}>Tantiya · Damage report</div>
          <div className="mb-4 text-[12px]">Prepared {today}. Officer-confirmed categories only.</div>
        </div>

        <section className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-4">
          {CATEGORIES.map((c) => (
            <div key={c.id} className="bg-ink-1 p-5">
              <div className="flex items-center gap-2 text-[13px] font-semibold" style={{ color: c.color }}><c.icon size={15} /> {c.label}</div>
              <div className="display mt-3 text-[44px]">{count(c.id)}</div>
              <div className="mt-1 text-[12px] text-fg-3">{c.meaning}</div>
            </div>
          ))}
        </section>

        <section className="mt-6 flex flex-wrap gap-x-10 gap-y-2 font-mono text-[13px] text-fg-2">
          <span><b className="text-fg">{t?.photos ?? 0}</b> photos loaded</span>
          <span><b className="text-fg">{t?.decided ?? 0}</b> decided by officer</span>
          <span><b className="text-fg">{t?.overridden ?? 0}</b> AI suggestion{t?.overridden === 1 ? '' : 's'} changed</span>
          <span><b className="text-fg">{t?.avgSeconds ?? '—'} s</b> average AI time per photo</span>
          <span><b className="text-fg">{summary?.households ?? 0}</b> families on file</span>
        </section>

        {barangays.length > 0 && (
          <section className="mt-10">
            <h2 className="text-lg font-bold" style={{ fontStretch: '115%' }}>By barangay</h2>
            <table className="mt-3 w-full max-w-3xl text-left text-[14px]">
              <thead>
                <tr className="label-mono border-b border-line-strong text-fg-3">
                  <th className="py-2 pr-4 font-medium">Barangay</th>
                  {CATEGORIES.map((c) => <th key={c.id} className="py-2 pr-4 text-right font-medium">{c.short}</th>)}
                </tr>
              </thead>
              <tbody>
                {barangays.map((b) => (
                  <tr key={b} className="border-b border-line">
                    <td className="py-2 pr-4 font-semibold">{b}</td>
                    {CATEGORIES.map((c) => <td key={c.id} className="py-2 pr-4 text-right font-mono">{cell(b, c.id) || '·'}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <section className="mt-10">
          <h2 className="text-lg font-bold" style={{ fontStretch: '115%' }}>Masterlist</h2>
          <p className="mt-1 text-[13px] text-fg-3">Only photos with an officer decision are listed.</p>
          {decided.length === 0 ? (
            <p className="mt-6 text-fg-2">No decisions yet. Review photos on the Triage page first.</p>
          ) : (
            <table className="mt-3 w-full text-left text-[14px]">
              <thead>
                <tr className="label-mono border-b border-line-strong text-fg-3">
                  <th className="py-2 pr-4 font-medium">#</th>
                  <th className="py-2 pr-4 font-medium">Family head</th>
                  <th className="py-2 pr-4 font-medium">Barangay</th>
                  <th className="py-2 pr-4 font-medium">Final category</th>
                  <th className="py-2 pr-4 font-medium">AI suggested</th>
                  <th className="py-2 font-medium">Officer note</th>
                </tr>
              </thead>
              <tbody>
                {decided.map((a) => (
                  <tr key={a.id} className="border-b border-line align-top">
                    <td className="py-2 pr-4 font-mono text-fg-3">{a.id}</td>
                    <td className="py-2 pr-4 font-semibold">{a.household?.headName ?? <span className="font-normal text-fg-3">Not linked</span>}</td>
                    <td className="py-2 pr-4 text-fg-2">{a.household ? `${a.household.barangay}${a.household.streetPurok ? ` · ${a.household.streetPurok}` : ''}` : '—'}</td>
                    <td className="py-2 pr-4"><CategoryBadge category={a.finalCategory} /></td>
                    <td className="py-2 pr-4 text-fg-2">{a.overridden ? <CategoryBadge category={a.aiCategory} /> : <span className="text-[13px]">same</span>}</td>
                    <td className="py-2 text-[13px] text-fg-2">{a.note ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <footer className="mt-12 border-t border-line pt-4 text-[12px] text-fg-3">
          Generated by Tantiya. All AI ran on this laptop; no photos or names were sent to the internet. AI suggestions by {summary?.models.map((m) => `${m.model} (prompt ${m.promptVersion})`).join(', ') || 'a local model'}; every category above was confirmed or changed by an officer. Tantiya is designed to fit the DSWD Emergency Shelter Assistance process; it does not replace LSWDO certification or C/MAT validation.
        </footer>
      </div>
    </div>
  );
}
