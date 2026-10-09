import { Camera, ImagePlus, Smartphone, Sun, Frame, UserX } from 'lucide-react';
import { useRef, useState } from 'react';
import { api } from '../lib/api';
import { isImage, resizeImage } from '../lib/resize';
import { useRoute, useStore } from '../lib/store';
import { Button, PageHeader } from '../components/ui';

type Phase = { kind: 'idle' } | { kind: 'preparing'; done: number; total: number } | { kind: 'sending'; total: number } | { kind: 'error'; message: string };

export function IntakePage() {
  const { assessments, health, queue } = useStore();
  const [, go] = useRoute();
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const waiting = assessments.filter((a) => a.status === 'queued' || a.status === 'running');

  async function handleFiles(list: FileList | null) {
    const files = Array.from(list ?? []).filter(isImage);
    if (!files.length) return setPhase({ kind: 'error', message: 'Those files are not photos. Use JPG, PNG or WebP.' });
    try {
      const blobs: Blob[] = [];
      for (let i = 0; i < files.length; i++) {
        setPhase({ kind: 'preparing', done: i, total: files.length });
        blobs.push(await resizeImage(files[i]));
      }
      setPhase({ kind: 'sending', total: files.length });
      // Send in small batches so a very large selection never times out.
      for (let i = 0; i < blobs.length; i += 12) {
        await api.upload(blobs.slice(i, i + 12), files.slice(i, i + 12).map((f) => f.name.replace(/\.\w+$/, '.jpg')));
      }
      setPhase({ kind: 'idle' });
    } catch (err) {
      setPhase({ kind: 'error', message: err instanceof Error ? err.message : 'Upload failed' });
    }
  }

  const busy = phase.kind === 'preparing' || phase.kind === 'sending';

  return (
    <div>
      <PageHeader kicker="Step 1 · Intake" title="Load photos from the field">
        <Button variant="secondary" onClick={() => go('triage')}>Go to triage →</Button>
      </PageHeader>

      <div className="grid gap-8 px-5 md:px-10 py-8 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); void handleFiles(e.dataTransfer.files); }}
            className={`relative flex min-h-[340px] flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed px-8 py-12 text-center transition-colors duration-300 ${dragging ? 'border-coral bg-coral/5' : 'border-line-strong bg-ink-1'}`}
          >
            <div className="silver-ring relative grid size-28 place-items-center rounded-full p-[7px]">
              <div className="grid size-full place-items-center rounded-full bg-ink-1">
                <ImagePlus size={34} strokeWidth={1.6} className="text-fg-2" />
              </div>
              <span className={`absolute right-3 top-2 size-4 rounded-full bg-coral ${busy ? 'live-dot' : ''}`} />
            </div>
            <h2 className="display mt-7 text-[28px]">
              {phase.kind === 'preparing' ? `Preparing ${phase.done + 1} of ${phase.total}…`
                : phase.kind === 'sending' ? `Sending ${phase.total} photos…`
                : 'Drop photos here'}
            </h2>
            <p className="mt-2 max-w-md text-fg-2">
              Photos are resized on this laptop, then analyzed one by one by the AI model running here. Nothing is sent to the internet.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Button variant="primary" disabled={busy} onClick={() => fileInput.current?.click()}><ImagePlus size={17} /> Choose photos</Button>
              <Button variant="secondary" disabled={busy} onClick={() => cameraInput.current?.click()}><Camera size={17} /> Take a photo</Button>
            </div>
            {phase.kind === 'error' && <p className="mt-5 rounded-lg bg-total/10 px-4 py-2 text-sm text-total">{phase.message}</p>}
            <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={(e) => { void handleFiles(e.target.files); e.target.value = ''; }} />
            <input ref={cameraInput} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { void handleFiles(e.target.files); e.target.value = ''; }} />
          </div>

          {waiting.length > 0 && (
            <div className="mt-8">
              <div className="flex items-baseline justify-between">
                <h3 className="text-lg font-bold" style={{ fontStretch: '115%' }}>Being analyzed</h3>
                <span className="font-mono text-sm text-fg-2">{queue.done} of {queue.total} done</span>
              </div>
              <div className="mt-3 flex gap-3 overflow-x-auto pb-2">
                {waiting.slice().reverse().map((a) => (
                  <figure key={a.id} className="relative h-28 w-40 shrink-0 overflow-hidden rounded-lg border border-line bg-ink-2">
                    <img src={a.photoUrl} alt="" className={`size-full object-cover ${a.status === 'queued' ? 'opacity-40 grayscale' : ''}`} />
                    {a.status === 'running' && (
                      <div className="pointer-events-none absolute inset-0 overflow-hidden">
                        <div className="scan-line h-1/2 w-full bg-gradient-to-b from-transparent via-coral/25 to-transparent" />
                      </div>
                    )}
                    <figcaption className="absolute bottom-1.5 left-1.5 rounded bg-ink-0/80 px-1.5 font-mono text-[11px] text-fg-2">
                      {a.status === 'running' ? 'analyzing' : 'waiting'}
                    </figcaption>
                  </figure>
                ))}
              </div>
            </div>
          )}
        </section>

        <aside className="space-y-6">
          <div className="rounded-xl border border-line bg-ink-1 p-5">
            <div className="label-mono text-fg-3">For the field team</div>
            <ul className="mt-3 space-y-3 text-[14px] text-fg-2">
              <li className="flex gap-3"><Frame size={17} className="mt-0.5 shrink-0 text-fg" /> One house per photo. Fit the whole house, roof included.</li>
              <li className="flex gap-3"><Sun size={17} className="mt-0.5 shrink-0 text-fg" /> Shoot in daylight, facing the most damaged side.</li>
              <li className="flex gap-3"><UserX size={17} className="mt-0.5 shrink-0 text-fg" /> Avoid faces when you can. Photos are personal data.</li>
            </ul>
          </div>
          <div className="rounded-xl border border-line bg-ink-1 p-5">
            <div className="label-mono flex items-center gap-2 text-fg-3"><Smartphone size={14} /> Upload from a phone</div>
            <p className="mt-3 text-[14px] text-fg-2">
              Put the phone and this laptop on the same local Wi-Fi (a phone hotspot with mobile data <b className="text-fg">off</b> works with no internet), then open:
            </p>
            <div className="mt-3 space-y-1.5">
              {(health?.lanUrls ?? []).map((u) => (
                <div key={u} className="rounded-md bg-ink-0 px-3 py-2 font-mono text-[13px] text-fg select-all">{u}/#/intake</div>
              ))}
              {!health?.lanUrls?.length && <div className="text-[13px] text-fg-3">No local network found. Copy photos by cable instead.</div>}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
