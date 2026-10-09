import type { Category } from '../lib/api';
import { categoryMeta } from '../lib/categories';

interface Props { category: Category | null; size?: 'sm' | 'md'; prefix?: string }

export function CategoryBadge({ category, size = 'sm', prefix }: Props) {
  const meta = categoryMeta(category);
  if (!meta) return null;
  const Icon = meta.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border font-medium ${size === 'sm' ? 'px-1.5 py-0.5 text-[12px]' : 'px-2.5 py-1 text-sm'}`}
      style={{
        color: meta.color,
        borderColor: `color-mix(in oklab, ${meta.color} 45%, transparent)`,
        background: `color-mix(in oklab, ${meta.color} 12%, transparent)`,
      }}
    >
      <Icon size={size === 'sm' ? 13 : 15} strokeWidth={2.2} aria-hidden />
      {prefix && <span className="text-fg-3">{prefix}</span>}
      {meta.short}
    </span>
  );
}
