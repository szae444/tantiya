import { AlertTriangle, CheckCircle2, Loader2, PenLine, RotateCw, UserRound } from 'lucide-react';
import { useMemo, useState } from 'react';
import { api, type Assessment } from '../lib/api';
import { CATEGORIES, currentCategory, needsReview } from '../lib/categories';
import { useRoute, useStore } from '../lib/store';
import { Button, EmptyState, PageHeader } from '../components/ui';
import { ReviewDrawer } from './ReviewDrawer';

type Filter = 'review' | 'all' | 'decided';

export function TriagePage() {
  const { assessments, loaded } = useStore();
  const [, go] = useRoute();
  const [filter, setFilter] = useState<Filter>('all');
  const [openId, setOpenId] = useState<number | null>(null);

  const done = assessments.filter((a) => a.status === 'done');
  const waiting = assessments.filter((a) => a.status === 'queued' || a.status === 'running');
  const errors = assessments.filter((a) => a.status === 'error');
  const toReview = done.filter(needsReview).length;
  const decided = done.length - toReview;
  const changed = done.filter((a) => a.overridden).length;

  const visible = done.filter((a) => (filter === 'review' ? needsReview(a) : filter === 'decided' ? !needsReview(a) : true));

  // Review order: items needing review first (flagged ones at the top), oldest first, column by column.
  const ordered = useMemo(() => {
    const rank = (a: Assessment) => (needsReview(a) ? (a.flags.length ? 0 : 1) : 2);
    return CATEGORIES.flatMap((c) =>
      visible.filter((a) => currentCategory(a) === c.id).sort((a, b) => rank(a) - rank(b) || a.id - b.id),
    );
  }, [visible]);

  if (loaded && assessments.length === 0) {
    return (
      <div>
        <PageHeader kicker="Step 2 · Triage" title="Review AI suggestions" />
        <EmptyState title="No photos yet" body="Load photos from the field team. The AI on this laptop will sort them here for you to review." action={<Button variant="primary" onClick={() => go('intake')}>Load photos</Button>} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader kicker="Step 2 · Triage" title={toReview ? `${toReview} photo${toReview === 1 ? '' : 's'} to review` : 'All photos reviewed'}>
        <div className="flex items-center gap-5 pr-2 font-mono text-[13px] text-fg-2">
          <span><b className="text-fg">{decided}</b> decided</span>
          <span><b className="text-fg">{changed}</b> changed by officer</span>
        </div>
        <div className="flex rounded-lg border border-line bg-ink-1 p-1" role="tablist">
          {(['all', 'review', 'decided'] as Filter[]).map((f) => (
            <button key={f} role="tab" aria-selected={filter === f} onClick={() => setFilter(f)}
              className={`rounded-md px-3 py-1.5 text-[13px] font-semibold transition-colors ${filter === f ? 'bg-ink-3 text-fg' : 'text-fg-3 hover:text-fg'}`}>
              {f === 'all' ? 'All' : f === 'review' ? 'Needs review' : 'Decided'}
            </button>
          ))}
        </div>
        {toReview > 0 && (
          <Button variant="primary" onClick={() => setOpenId(ordered.find(needsReview)?.id ?? null)}>Start reviewing</Button>
        )}
      </PageHeader>

      {(waiting.length > 0 || errors.length > 0) && (
        <div className="flex flex-wrap items-center gap-3 border-b border-line bg-ink-1 px-5 md:px-10 py-3 text-[14px]">
          {waiting.length > 0 && (
            <span className="flex items-center gap-2 text-fg-2"><Loader2 size={15} className="animate-spin text-coral" /> AI is analyzing {waiting.length} more photo{waiting.length === 1 ? '' : 's'}. Cards appear as they finish.</span>
          )}
          {errors.map((e) => (
            <span key={e.id} className="flex items-center gap-2 rounded-md bg-total/10 px-2.5 py-1 text-total">
              <AlertTriangle size={14} /> {e.originalName ?? `Photo ${e.id}`}: {e.error}
              <button className="ml-1 inline-flex items-center gap-1 font-semibold underline-offset-2 hover:underline" onClick={() => void api.retry(e.id)}>
                <RotateCw size={13} /> Retry
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 px-5 md:px-10 py-7 md:grid-cols-2 xl:grid-cols-4">
        {CATEGORIES.map((c) => {
          const items = ordered.filter((a) => currentCategory(a) === c.id);
          const Icon = c.icon;
          return (
            <section key={c.id} className="min-w-0" aria-label={c.label}>
              <header className="mb-3 flex items-center gap-2.5 border-t-2 pt-3" style={{ borderColor: c.color }}>
                <Icon size={17} strokeWidth={2.2} style={{ color: c.color }} />
                <h2 className="text-[16px] font-bold" style={{ fontStretch: '115%' }}>{c.label}</h2>
                <span className="ml-auto font-mono text-[13px] text-fg-2">{items.length}</span>
              </header>
              <p className="mb-3 text-[12.5px] text-fg-3">{c.meaning}</p>
              <div className="space-y-3">
                {items.map((a) => <Card key={a.id} a={a} onOpen={() => setOpenId(a.id)} />)}
                {items.length === 0 && <div className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-[13px] text-fg-3">None</div>}
              </div>
            </section>
          );
        })}
      </div>

      {openId !== null && (
        <ReviewDrawer
          ids={ordered.map((a) => a.id)}
          id={openId}
          onNavigate={setOpenId}
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  );
}

function Card({ a, onOpen }: { a: Assessment; onOpen: () => void }) {
  const review = needsReview(a);
  return (
    <button
      onClick={onOpen}
      className={`card-in group block w-full overflow-hidden rounded-xl border bg-ink-1 text-left transition-all duration-300 ease-[var(--ease-out-expo)] hover:-translate-y-0.5 hover:border-fg-3 hover:bg-ink-2 ${review ? 'border-line-strong' : 'border-line opacity-80 hover:opacity-100'}`}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-ink-2">
        <img src={a.photoUrl} alt={a.ai?.photo_description ?? ''} loading="lazy" className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
        <span className={`absolute left-2 top-2 inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[12px] font-semibold backdrop-blur ${review ? 'bg-ink-0/85 text-fg' : 'bg-ink-0/85 text-minor'}`}>
          {review ? <><span className="size-1.5 rounded-full bg-coral" /> AI suggestion</>
            : a.overridden ? <><PenLine size={12} /> Changed by officer</> : <><CheckCircle2 size={12} /> Confirmed</>}
        </span>
        {a.flags.length > 0 && review && (
          <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md bg-partial px-1.5 py-0.5 text-[12px] font-semibold text-ink-0" title={a.flags.map((f) => f.message).join('\n')}>
            <AlertTriangle size={12} /> Check
          </span>
        )}
      </div>
      <div className="space-y-2 p-3.5">
        <p className="line-clamp-2 text-[13.5px] leading-snug text-fg-2">{a.ai?.reason}</p>
        <div className="flex items-center justify-between gap-2 text-[12px] text-fg-3">
          <span className="flex min-w-0 items-center gap-1.5 truncate">
            <UserRound size={12} className="shrink-0" />
            <span className="truncate">{a.household ? `${a.household.headName} · ${a.household.barangay}` : 'No family linked'}</span>
          </span>
          <span className="shrink-0 font-mono">#{a.id}</span>
        </div>
      </div>
    </button>
  );
}
