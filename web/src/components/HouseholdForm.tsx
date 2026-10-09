import { CopyCheck, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { api, ApiError, type Duplicate, type Household, type HouseholdInput } from '../lib/api';
import { Button, Field, inputClass } from './ui';

interface Props {
  onCreated: (h: Household) => void;
  onUseExisting?: (h: Household) => void;
  onCancel?: () => void;
  compact?: boolean;
}

const empty: HouseholdInput = { headName: '', barangay: '', streetPurok: '', familySize: '', contact: '' };

/** Add-family form with a live duplicate check (rules + local embeddings on the server). */
export function HouseholdForm({ onCreated, onUseExisting, onCancel, compact }: Props) {
  const [form, setForm] = useState<HouseholdInput>(empty);
  const [duplicates, setDuplicates] = useState<Duplicate[]>([]);
  const [blocked, setBlocked] = useState(false); // server refused because of a duplicate
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = (k: keyof HouseholdInput) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setBlocked(false);
  };

  async function check() {
    if (!form.headName?.trim() || !form.barangay?.trim()) return;
    try { setDuplicates((await api.checkHousehold(form)).duplicates); } catch { /* checked again on save */ }
  }

  async function save(confirmedDifferent = false) {
    setError(null);
    setSaving(true);
    try {
      const h = await api.createHousehold({ ...form, familySize: form.familySize === '' ? undefined : Number(form.familySize), confirmedDifferent });
      setForm(empty);
      setDuplicates([]);
      setBlocked(false);
      onCreated(h);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setDuplicates((e.body as { duplicates: Duplicate[] }).duplicates);
        setBlocked(true);
      } else setError(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); void save(); }} className="space-y-3">
      <div className={`grid gap-3 ${compact ? 'grid-cols-2' : 'grid-cols-1 sm:grid-cols-2'}`}>
        <Field label="Family head"><input className={inputClass} value={form.headName} onChange={set('headName')} onBlur={() => void check()} placeholder="Juan Dela Cruz" required /></Field>
        <Field label="Barangay"><input className={inputClass} value={form.barangay} onChange={set('barangay')} onBlur={() => void check()} placeholder="San Jose" required /></Field>
        <Field label="Street / Purok"><input className={inputClass} value={form.streetPurok} onChange={set('streetPurok')} onBlur={() => void check()} placeholder="Purok 3" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Family size"><input className={inputClass} value={form.familySize} onChange={set('familySize')} inputMode="numeric" placeholder="5" /></Field>
          <Field label="Contact"><input className={inputClass} value={form.contact} onChange={set('contact')} placeholder="optional" /></Field>
        </div>
      </div>

      {duplicates.length > 0 && (
        <div className="rounded-xl border border-partial/50 bg-partial/10 p-3.5">
          <div className="flex items-center gap-2 text-[14px] font-semibold text-partial">
            <CopyCheck size={16} /> Possible duplicate {duplicates.length === 1 ? 'family' : 'families'}
          </div>
          <ul className="mt-2 space-y-2">
            {duplicates.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-3 rounded-lg bg-ink-0 px-3 py-2 text-[14px]">
                <span className="min-w-0 flex-1">
                  <b>{d.household.headName}</b> · {d.household.barangay}{d.household.streetPurok ? ` · ${d.household.streetPurok}` : ''}
                  <span className="block text-[12px] text-fg-3">{d.reason}{d.score < 1 ? ` (similarity ${d.score})` : ''}</span>
                </span>
                {onUseExisting && <Button type="button" variant="secondary" onClick={() => onUseExisting(d.household)}>Same family</Button>}
              </li>
            ))}
          </ul>
          {blocked && (
            <Button type="button" variant="ghost" className="mt-2" onClick={() => void save(true)}>Different family, save anyway</Button>
          )}
        </div>
      )}

      {error && <p className="text-[14px] text-total">{error}</p>}
      <div className="flex items-center gap-2">
        <Button type="submit" variant="primary" disabled={saving}><UserPlus size={16} /> Add family</Button>
        {onCancel && <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>}
      </div>
    </form>
  );
}
