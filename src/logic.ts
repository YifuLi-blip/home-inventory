import type { Expense, Item, JournalEntry } from './types';

export const CATEGORIES = ['食品', '清洁用品', '个护用品', '宠物用品', '日用杂物'];
export const EXPIRY_WARNING_DAYS = 14;

const CATEGORY_ICONS: Record<string, string> = {
  食品: '🍎', 清洁用品: '🫧', 个护用品: '🪥', 宠物用品: '🐾', 日用杂物: '📦',
};

export type ViewFilter = 'all' | 'low' | 'expiring';
export type ExpiryState = { kind: 'none' } | { kind: 'ok' | 'soon' | 'expired'; days: number };

/** 分类名开头的 emoji，例如 '🐾寵物' -> '🐾'。按字素切分，肤色和 ZWJ 组合不会被拆开。 */
export function leadingEmoji(name: string) {
  const first = new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(name)[Symbol.iterator]().next().value?.segment;
  return first && /\p{Extended_Pictographic}/u.test(first) ? first : null;
}

/** 去掉开头 emoji 后用于显示的名称。 */
export function categoryLabel(name: string) {
  const emoji = leadingEmoji(name);
  return (emoji && name.slice(emoji.length).trim()) || name;
}

export const iconFor = (category: string) => leadingEmoji(category) ?? CATEGORY_ICONS[category] ?? '📦';

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

export const MAX_EXPENSE_CATEGORIES = 30;
export const EXPENSE_CATEGORIES = ['買菜', '餐飲', '油費', '交通', '汽車', '手機', '購物', '運動', '美容', '旅遊', '禮物', '醫藥'];

const EXPENSE_ICONS: Record<string, string> = {
  買菜: '🥦', 餐飲: '🍜', 油費: '⛽️', 交通: '🚇', 汽車: '🚙', 手機: '📱',
  購物: '🛍️', 運動: '💪🏻', 美容: '💇🏻‍♀️', 旅遊: '✈️', 禮物: '🎁', 醫藥: '💊',
  // 旧账目可能仍在使用这些分类。
  日用: '🧴', 房租: '🏠', 水电网: '💡', 娱乐: '🎬', 其他: '🧾',
};

const RENAMED_EXPENSE_CATEGORIES: Record<string, string> = { 买菜: '買菜', 餐饮: '餐飲' };

/** 让简体旧账目和新分类合并统计。 */
export const normalizeExpenseCategory = (category: string) => RENAMED_EXPENSE_CATEGORIES[category] ?? category;

/** 保留仍在使用但已从列表删除的分类，避免物品筛不出来或编辑时被改掉。 */
export function withUsedCategories(categories: string[], used: string[]) {
  return [...categories, ...[...new Set(used)].filter((name) => name && !categories.includes(name))];
}

/** 返回新增后的分类列表，或给用户看的错误信息。 */
export function addCategory(categories: string[], value: string): { categories: string[] } | { error: string } {
  const name = value.trim();
  if (!name) return { error: '请输入分类名称。' };
  if ([...name].length > 16) return { error: '分类名称太长了。' };
  if (categories.includes(name)) return { error: '这个分类已经有了。' };
  if (categories.length >= MAX_EXPENSE_CATEGORIES) return { error: `最多 ${MAX_EXPENSE_CATEGORIES} 个分类。` };
  return { categories: [...categories, name] };
}

export const expenseIcon = (category: string) => leadingEmoji(category) ?? EXPENSE_ICONS[category] ?? '🧾';

/** '12.3' -> 1230；无效或不大于 0 时返回 null。用字符串运算避免 0.1 + 0.2 式的误差。 */
export function parseAmount(value: string): number | null {
  const match = /^(\d{1,7})(?:\.(\d{0,2}))?$/.exec(value.trim());
  if (!match) return null;
  const cents = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
  return cents > 0 ? cents : null;
}

export function formatMoney(cents: number) {
  return `$${(cents / 100).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export const centsToInput = (cents: number) => (cents / 100).toFixed(2);

/** 'YYYY-MM' 的月份加减，只做整数运算，不受时区影响。 */
export function shiftMonth(month: string, delta: number) {
  const [year, monthNumber] = month.split('-').map(Number);
  const index = year * 12 + (monthNumber - 1) + delta;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
}

export function formatMonth(month: string) {
  const [year, monthNumber] = month.split('-').map(Number);
  return `${year}年${monthNumber}月`;
}

export const displayName = (email: string) => email.split('@')[0];

function totalsBy(expenses: Expense[], key: (expense: Expense) => string) {
  const totals = new Map<string, number>();
  for (const expense of expenses) totals.set(key(expense), (totals.get(key(expense)) ?? 0) + expense.amountCents);
  return [...totals].map(([name, cents]) => ({ name, cents })).sort((a, b) => b.cents - a.cents || a.name.localeCompare(b.name));
}

export function summarizeExpenses(expenses: Expense[]) {
  return {
    total: expenses.reduce((sum, expense) => sum + expense.amountCents, 0),
    byCategory: totalsBy(expenses, (expense) => expense.category),
    byPayer: totalsBy(expenses, (expense) => expense.paidBy),
  };
}

export const sortExpenses = (expenses: Expense[]) =>
  [...expenses].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));

/** 月历格子：周日开头，月初前用 null 占位。 */
export function monthDays(month: string): (string | null)[] {
  const [year, monthNumber] = month.split('-').map(Number);
  const leading = new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay();
  const count = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const days = Array.from({ length: count }, (_, index) => `${month}-${String(index + 1).padStart(2, '0')}`);
  return [...Array<null>(leading).fill(null), ...days];
}

export function totalsByDate(expenses: Expense[]) {
  const totals: Record<string, number> = {};
  for (const expense of expenses) totals[expense.date] = (totals[expense.date] ?? 0) + expense.amountCents;
  return totals;
}

/** 按 id 排序，让两台设备上的显示顺序一致。 */
export const entriesOn = (entries: JournalEntry[], date: string) =>
  entries.filter((entry) => entry.date === date).sort((a, b) => a.id.localeCompare(b.id));

export function itemsExpiringOn(items: Item[], date: string) {
  return items.filter((item) => item.expiryDate === date);
}

/** 月历格子很窄，四舍五入到元，上千用 k。 */
export function compactMoney(cents: number) {
  const dollars = Math.round(cents / 100);
  if (dollars < 1000) return `$${dollars}`;
  return `$${(dollars / 1000).toFixed(1).replace(/\.0$/, '')}k`;
}

export function formatDay(date: string) {
  const [, month, day] = date.split('-').map(Number);
  return `${month}月${day}日`;
}
