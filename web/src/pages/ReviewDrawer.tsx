import { AlertTriangle, ChevronLeft, ChevronRight, Sparkles, Trash2, Undo2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { api, type Category } from '../lib/api';
import { CATEGORIES, categoryMeta, needsReview, PART_LABEL, partSeverity } from '../lib/categories';
import { useStore } from '../lib/store';
import { CategoryBadge } from '../components/CategoryBadge';
import { HouseholdLink } from '../components/HouseholdLink';
import { Button, Kbd } from '../components/ui';

interface Props { ids: number[]; id: number; onNavigate: (id: number) => void; onClose: () => void }

const SEVERITY_COLOR: Record<string, string> = {
  severe: 'var(--color-total)', moderate: 'var(--color-partial)', ok: 'var(--color-minor)', unknown: 'var(--color-fg-3)',
};

export function ReviewDrawer({ ids, id, onNavigate, onClose }: Props) {
  const { assessments, upsert } = useStore();
  const a = assessments.find((x) => x.id === id);
  const index = ids.indexOf(id);
  const [choice, setChoice] = useState<Category | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const noteRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setChoice(a?.finalCategory ?? a?.aiCategory ?? null);
    setNote(a?.note ?? '');
    setError(null);
    setConfirmDelete(false);
  }, [id, a?.finalCategory, a?.aiCategory]);

  const prev = () => index > 0 && onNavigate(ids[index - 1]);
  const next = () => index < ids.length - 1 && onNavigate(ids[index + 1]);
  const nextToReview = () => {
    const after = [...ids.slice(index + 1), ...ids.slice(0, index)];
    const target = after.find((x) => { const item = assessments.find((y) => y.id === x); return item && needsReview(item); });
    if (target) onNavigate(target); else onClose();
  };

  const changing = !!a && !!choice && choice !== a.aiCategory;

  async function confirm() {
    if (!a || !choice || saving) return;
    if (changing && !note.trim()) {
      setError('Add a short reason for changing the AI suggestion.');
      noteRef.current?.focus();
      return;
    }
    setSaving(true);
    try {
      upsert(await api.decide(a.id, choice, changing ? note : undefined));
      nextToReview();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  async function undo() {
    if (!a) return;
    upsert(await api.decide(a.id, null));
  }

  async function remove() {
    if (!a) return;
    if (!confirmDelete) return setConfirmDelete(true);
    await api.remove(a.id);
    if (index < ids.length - 1) next(); else onClose();
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      if (e.key === 'Escape') { (typing ? (e.target as HTMLElement).blur() : onClose()); return; }
      if (typing) { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void confirm(); return; }
      if (e.key === 'ArrowRight' || e.key === 'j') next();
      else if (e.key === 'ArrowLeft' || e.key === 'k') prev();
      else if (e.key === 'Enter' && a && !a.finalCategory) void confirm();
      else {
        const c = CATEGORIES.find((m) => m.key === e.key);
        if (c && a && !a.finalCategory) setChoice(c.id);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="no-print fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true" aria-label="Review photo">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={onClose} />
      <div className="card-in relative flex h-full w-full max-w-[720px] flex-col border-l border-line-strong bg-ink-1 shadow-2xl">
        <div className="flex items-center gap-2 border-b border-line px-5 py-3">
          <button onClick={prev} disabled={index <= 0} className="rounded-md p-1.5 text-fg-2 hover:bg-ink-3 hover:text-fg disabled:opacity-30" aria-label="Previous photo"><ChevronLeft size={20} /></button>
          <span className="font-mono text-[13px] text-fg-2">{index + 1} / {ids.length}</span>
          <button onClick={next} disabled={index >= ids.length - 1} className="rounded-md p-1.5 text-fg-2 hover:bg-ink-3 hover:text-fg disabled:opacity-30" aria-label="Next photo"><ChevronRight size={20} /></button>
          <span className="ml-2 hidden text-[12px] text-fg-3 sm:inline">
            <Kbd>←</Kbd> <Kbd>→</Kbd> move · <Kbd>1</Kbd>–<Kbd>4</Kbd> choose · <Kbd>Enter</Kbd> confirm
          </span>
          <button onClick={onClose} className="ml-auto rounded-md p-1.5 text-fg-2 hover:bg-ink-3 hover:text-fg" aria-label="Close"><X size={20} /></button>
        </div>

        {!a ? (
          <div className="p-10 text-fg-2">This photo was removed.</div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <div className="bg-black">
              <img src={a.photoUrl} alt={a.ai?.photo_description ?? 'Field photo'} className="mx-auto max-h-[44vh] w-full object-contain" />
            </div>

            <div className="space-y-6 px-6 py-5">
              {a.ai && (
                <section>
                  <div className="label-mono flex items-center gap-2 text-fg-3"><Sparkles size={13} className="text-coral" /> What the AI sees</div>
                  <p className="mt-2 text-[17px] leading-snug text-fg">“{a.ai.photo_description}”</p>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {(['roof', 'walls', 'structure'] as const).map((part) => {
                      const v = a.ai![part];
                      return (
                        <div key={part} className="rounded-lg border border-line bg-ink-0 px-3 py-2">
                          <div className="label-mono text-[10px] text-fg-3">{part}</div>
                          <div className="mt-0.5 flex items-center gap-1.5 text-[14px] font-semibold">
                            <span className="size-2 rounded-full" style={{ background: SEVERITY_COLOR[partSeverity(v)] }} />
                            {PART_LABEL[v]}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-[14px]">
                    <CategoryBadge category={a.aiCategory} size="md" prefix="AI suggests" />
                    <span className="text-fg-2">{a.ai.reason}</span>
                  </div>
                </section>
              )}

              {a.flags.length > 0 && (
                <section className="space-y-2">
                  {a.flags.map((f) => (
                    <div key={f.code} className="flex gap-2.5 rounded-lg border border-partial/40 bg-partial/10 px-3 py-2 text-[14px] text-partial">
                      <AlertTriangle size={16} className="mt-0.5 shrink-0" /> {f.message}
                    </div>
                  ))}
                </section>
              )}

              <section>
                <div className="label-mono text-fg-3">Officer decision</div>
                {a.finalCategory ? (
                  <div className="mt-2 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-ink-0 p-4">
                    <CategoryBadge category={a.finalCategory} size="md" />
                    <span className="text-[14px] text-fg-2">
                      {a.overridden ? 'Changed from the AI suggestion' : 'Confirmed the AI suggestion'}
                      {a.decidedAt && <> · {new Date(a.decidedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</>}
                    </span>
                    {a.note && <p className="w-full text-[14px] text-fg-2">Reason: {a.note}</p>}
                    <Button variant="ghost" className="ml-auto" onClick={() => void undo()}><Undo2 size={15} /> Undo</Button>
                  </div>
                ) : (
                  <>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {CATEGORIES.map((c) => {
                        const selected = choice === c.id;
                        const Icon = c.icon;
                        return (
                          <button key={c.id} onClick={() => setChoice(c.id)} aria-pressed={selected}
                            className="relative flex items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition-all duration-200"
                            style={{
                              borderColor: selected ? c.color : 'var(--color-line)',
                              background: selected ? `color-mix(in oklab, ${c.color} 14%, transparent)` : 'var(--color-ink-0)',
                            }}>
                            <Icon size={18} strokeWidth={2.2} style={{ color: c.color }} className="mt-0.5 shrink-0" />
                            <span className="min-w-0">
                              <span className="block text-[15px] font-semibold">{c.label}</span>
                              <span className="block text-[12.5px] leading-snug text-fg-3">{c.meaning}</span>
                            </span>
                            <span className="ml-auto flex flex-col items-end gap-1">
                              <Kbd>{c.key}</Kbd>
                              {a.aiCategory === c.id && <span className="font-mono text-[10px] uppercase tracking-wider text-coral">AI</span>}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    {changing && (
                      <div className="mt-3">
                        <label className="label-mono text-fg-3" htmlFor="note">Why are you changing it? (required)</label>
                        <textarea id="note" ref={noteRef} value={note} onChange={(e) => setNote(e.target.value)} rows={2}
                          placeholder="e.g. Walls are standing; only roof sheets are missing."
                          className="mt-1.5 w-full rounded-lg border border-line-strong bg-ink-0 px-3 py-2 text-[14px] focus:border-fg-2 focus:outline-none" />
                      </div>
                    )}
                    {error && <p className="mt-2 text-[14px] text-total">{error}</p>}
                    <div className="mt-3 flex items-center gap-3">
                      <Button variant="primary" disabled={!choice || saving || a.status !== 'done'} onClick={() => void confirm()}>
                        {changing ? `Save as ${categoryMeta(choice)?.short}` : 'Confirm AI suggestion'} <Kbd>Enter</Kbd>
                      </Button>
                      <span className="text-[12.5px] text-fg-3">Moves to the next photo that needs review.</span>
                    </div>
                  </>
                )}
              </section>

              <HouseholdLink assessment={a} />

              <footer className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line pt-4 font-mono text-[12px] text-fg-3">
                <span>Suggested by {a.model ?? '—'} · prompt {a.promptVersion ?? '—'}</span>
                {a.seconds !== null && <span>{a.seconds} s on this laptop</span>}
                <span>{a.originalName}</span>
                <button onClick={() => void remove()} className={`ml-auto inline-flex items-center gap-1 rounded px-2 py-1 transition-colors ${confirmDelete ? 'bg-total/15 text-total' : 'hover:text-total'}`}>
                  <Trash2 size={13} /> {confirmDelete ? 'Click again to delete' : 'Delete photo'}
                </button>
              </footer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

