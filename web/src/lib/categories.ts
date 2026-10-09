import { CircleSlash, House, HouseIcon, type LucideIcon, TriangleAlert, Wrench } from 'lucide-react';
import type { Assessment, Category, PartState } from './api';

export interface CategoryMeta {
  id: Category;
  label: string;
  short: string;
  key: string; // keyboard shortcut
  color: string; // CSS variable
  icon: LucideIcon;
  meaning: string;
}

export const CATEGORIES: CategoryMeta[] = [
  { id: 'TOTAL', label: 'Totally damaged', short: 'Total', key: '1', color: 'var(--color-total)', icon: TriangleAlert,
    meaning: 'Destroyed or no longer safe to live in.' },
  { id: 'PARTIAL', label: 'Partially damaged', short: 'Partial', key: '2', color: 'var(--color-partial)', icon: Wrench,
    meaning: 'Part is damaged; still safe to live in and repairable.' },
  { id: 'MINOR', label: 'Minor / none', short: 'Minor', key: '3', color: 'var(--color-minor)', icon: House,
    meaning: 'Little or no visible damage.' },
  { id: 'NOT_A_HOUSE', label: 'Not a house', short: 'Not a house', key: '4', color: 'var(--color-none)', icon: CircleSlash,
    meaning: 'No house clearly visible in the photo.' },
];

export const categoryMeta = (c: Category | null | undefined) => CATEGORIES.find((m) => m.id === c);
export const FallbackIcon = HouseIcon;

/** The category a card is shown under: the officer's decision if made, otherwise the AI suggestion. */
export const currentCategory = (a: Assessment): Category | null => a.finalCategory ?? a.aiCategory;

export const needsReview = (a: Assessment) => a.status === 'done' && !a.finalCategory;

export const PART_LABEL: Record<PartState | 'standing' | 'leaning' | 'collapsed', string> = {
  intact: 'Intact',
  partly_damaged: 'Partly damaged',
  mostly_gone: 'Mostly gone',
  not_visible: 'Not visible',
  standing: 'Standing',
  leaning: 'Leaning',
  collapsed: 'Collapsed',
};

export const partSeverity = (v: string) =>
  v === 'mostly_gone' || v === 'collapsed' ? 'severe' : v === 'partly_damaged' || v === 'leaning' ? 'moderate' : v === 'not_visible' ? 'unknown' : 'ok';
