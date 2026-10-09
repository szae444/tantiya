// Progress gauge drawn from the logo: a silver ring, a needle from the lower left,
// and the coral dot riding the ring at the current progress.
interface Props { value: number; size?: number; live?: boolean; label?: string }

export function Gauge({ value, size = 56, live = false, label }: Props) {
  const v = Math.max(0, Math.min(1, value));
  const r = 40;
  const c = 2 * Math.PI * r;
  // Start at the top-right gap like the logo (about -60deg) and sweep clockwise.
  const start = -60;
  const angle = ((start + v * 330) * Math.PI) / 180;
  const dot = { x: 50 + r * Math.cos(angle), y: 50 + r * Math.sin(angle) };
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={label ?? `${Math.round(v * 100)}% done`}>
      <defs>
        <linearGradient id="silver" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f4f4f4" />
          <stop offset="0.55" stopColor="#6d6d6d" />
          <stop offset="1" stopColor="#c9c9c9" />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r={r} fill="none" stroke="var(--color-line-strong)" strokeWidth="7" />
      <circle
        cx="50" cy="50" r={r} fill="none" stroke="url(#silver)" strokeWidth="7" strokeLinecap="round"
        strokeDasharray={`${(v * 330 / 360) * c} ${c}`}
        transform={`rotate(${start} 50 50)`}
        style={{ transition: 'stroke-dasharray 600ms var(--ease-out-expo)' }}
      />
      <line x1="14" y1="86" x2={dot.x} y2={dot.y} stroke="#9a9a9a" strokeWidth="2.2" strokeLinecap="round"
        style={{ transition: 'all 600ms var(--ease-out-expo)' }} />
      <circle cx={dot.x} cy={dot.y} r="7" fill="var(--color-coral)" className={live ? 'live-dot' : ''}
        style={{ transition: 'cx 600ms var(--ease-out-expo), cy 600ms var(--ease-out-expo)', transformOrigin: `${dot.x}px ${dot.y}px` }} />
    </svg>
  );
}
