export type Category = 'TOTAL' | 'PARTIAL' | 'MINOR' | 'NOT_A_HOUSE';
export type PartState = 'intact' | 'partly_damaged' | 'mostly_gone' | 'not_visible';

export interface AiAnswer {
  photo_description: string;
  main_subject: string;
  is_house_visible: boolean;
  roof: PartState;
  walls: PartState;
  structure: 'standing' | 'leaning' | 'collapsed' | 'not_visible';
  category: Category;
  reason: string;
}

export interface Flag { code: string; message: string }

export interface HouseholdRef { id: number; headName: string; barangay: string; streetPurok: string | null }

export interface Assessment {
  id: number;
  photoUrl: string;
  originalName: string | null;
  householdId: number | null;
  household: HouseholdRef | null;
  status: 'queued' | 'running' | 'done' | 'error';
  ai: AiAnswer | null;
  aiCategory: Category | null;
  flags: Flag[];
  finalCategory: Category | null;
  overridden: boolean;
  note: string | null;
  model: string | null;
  promptVersion: string | null;
  seconds: number | null;
  error: string | null;
  createdAt: string;
  decidedAt: string | null;
}

export interface Household {
  id: number;
  headName: string;
  barangay: string;
  streetPurok: string | null;
  familySize: number | null;
  contact: string | null;
  isSample: boolean;
  photoCount: number;
  createdAt: string;
}

export interface Duplicate { id: number; score: number; reason: string; household: Household }

export interface QueueState { total: number; done: number; queued: number; running: boolean }

export interface Health {
  ok: boolean;
  internet: boolean;
  ollama: { reachable: boolean; visionModel: string; visionInstalled?: boolean; embedModel: string; embedInstalled?: boolean; warm: boolean };
  queue: QueueState;
  lanUrls: string[];
}

export interface Summary {
  totals: { photos: number; analyzed: number; waiting: number; errors: number; decided: number; overridden: number; avgSeconds: number | null };
  byFinal: { category: Category; count: number }[];
  byBarangay: { barangay: string; category: Category; count: number }[];
  households: number;
  models: { model: string; promptVersion: string }[];
}

export interface HouseholdInput { headName: string; barangay: string; streetPurok?: string; familySize?: number | ''; contact?: string; confirmedDifferent?: boolean }

export class ApiError extends Error {
  constructor(message: string, public status: number, public body: unknown) { super(message); }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError((body as { error?: string }).error ?? `Request failed (${res.status})`, res.status, body);
  return body as T;
}

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export const api = {
  health: () => request<Health>('/api/health'),
  assessments: () => request<Assessment[]>('/api/assessments'),
  households: () => request<Household[]>('/api/households'),
  summary: () => request<Summary>('/api/summary'),
  upload: (files: Blob[], names: string[]) => {
    const form = new FormData();
    files.forEach((f, i) => form.append('photos', f, names[i]));
    return request<Assessment[]>('/api/photos', { method: 'POST', body: form });
  },
  decide: (id: number, finalCategory: Category | null, note?: string) =>
    request<Assessment>(`/api/assessments/${id}`, json('PATCH', { finalCategory, note })),
  link: (id: number, householdId: number | null) =>
    request<Assessment>(`/api/assessments/${id}`, json('PATCH', { householdId })),
  retry: (id: number) => request<Assessment>(`/api/assessments/${id}/retry`, { method: 'POST' }),
  remove: (id: number) => request<void>(`/api/assessments/${id}`, { method: 'DELETE' }),
  checkHousehold: (h: HouseholdInput) => request<{ duplicates: Duplicate[] }>('/api/households/check', json('POST', h)),
  createHousehold: (h: HouseholdInput) => request<Household>('/api/households', json('POST', h)),
};
