import type { Item } from './types';

export const CATEGORIES = ['食品', '清洁用品', '个护用品', '宠物用品', '日用杂物'];
export const EXPIRY_WARNING_DAYS = 14;

const CATEGORY_ICONS: Record<string, string> = {
  食品: '🍎', 清洁用品: '🫧', 个护用品: '🪥', 宠物用品: '🐾', 日用杂物: '📦',
};

export type ViewFilter = 'all' | 'low' | 'expiring';
export type ExpiryState = { kind: 'none' } | { kind: 'ok' | 'soon' | 'expired'; days: number };

export const iconFor = (category: string) => CATEGORY_ICONS[category] ?? '📦';

/** 与原型一致：数量等于最低库存时就提醒补货。 */
export const isLow = (item: Pick<Item, 'quantity' | 'minimum'>) => item.quantity <= item.minimum;

export function localDate(date = new Date()) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function dayNumber(iso: string) {
  const [year, month, day] = iso.split('-').map(Number);
  return Date.UTC(year, month - 1, day) / 86_400_000;
}

export function expiryState(expiryDate: string | null, today = localDate()): ExpiryState {
  if (!expiryDate) return { kind: 'none' };
  const days = dayNumber(expiryDate) - dayNumber(today);
  if (days < 0) return { kind: 'expired', days };
  return { kind: days <= EXPIRY_WARNING_DAYS ? 'soon' : 'ok', days };
}

export const isExpiring = (item: Item, today = localDate()) => {
  const { kind } = expiryState(item.expiryDate, today);
  return kind === 'soon' || kind === 'expired';
};

export function filterItems(
  items: Item[],
  { query, category, view, today = localDate() }:
  { query: string; category: string; view: ViewFilter; today?: string },
) {
  const needle = query.trim().toLowerCase();
  return items.filter((item) => {
    const matchesQuery = !needle
      || `${item.name} ${item.category} ${item.location}`.toLowerCase().includes(needle);
    const matchesView = view === 'all'
      || (view === 'low' && isLow(item))
      || (view === 'expiring' && isExpiring(item, today));
    return matchesQuery && matchesView && (category === '全部' || item.category === category);
  });
}

/** 需要处理的排前面：过期、临期、缺货，其余按名称。 */
export function sortItems(items: Item[], today = localDate()) {
  const urgency = (item: Item) => {
    const { kind } = expiryState(item.expiryDate, today);
    if (kind === 'expired') return 0;
    if (kind === 'soon') return 1;
    return isLow(item) ? 2 : 3;
  };
  return [...items].sort((a, b) => urgency(a) - urgency(b) || a.name.localeCompare(b.name, 'zh-CN'));
}

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function formatExpiry(state: ExpiryState) {
  if (state.kind === 'none') return '';
  if (state.kind === 'expired') return `已过期 ${-state.days} 天`;
  if (state.days === 0) return '今天到期';
  return `${state.days} 天后到期`;
}
