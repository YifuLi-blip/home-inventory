import { describe, expect, it } from 'vitest';
import {
  expiryState, filterItems, formatExpiry, formatMoney, isLow, normalizeEmail, parseAmount,
  shiftMonth, sortExpenses, sortItems, summarizeExpenses,
} from '../src/logic';
import type { Expense, Item } from '../src/types';

const item = (over: Partial<Item>): Item => ({
  id: over.name ?? 'x', name: '牙膏', category: '个护用品', location: '浴室',
  quantity: 5, unit: '支', minimum: 1, expiryDate: null, ...over,
});
const today = '2026-11-03';

describe('isLow', () => {
  it('数量等于最低库存时提醒', () => expect(isLow({ quantity: 2, minimum: 2 })).toBe(true));
  it('高于最低库存时不提醒', () => expect(isLow({ quantity: 3, minimum: 2 })).toBe(false));
});

describe('expiryState', () => {
  it('没有日期', () => expect(expiryState(null, today)).toEqual({ kind: 'none' }));
  it('今天到期算临期', () => expect(expiryState(today, today)).toEqual({ kind: 'soon', days: 0 }));
  it('第 14 天仍是临期', () => expect(expiryState('2026-11-17', today).kind).toBe('soon'));
  it('第 15 天不是临期', () => expect(expiryState('2026-11-18', today).kind).toBe('ok'));
  it('昨天已过期', () => expect(expiryState('2026-11-02', today)).toEqual({ kind: 'expired', days: -1 }));
  it('跨夏令时仍是整数天', () => expect(expiryState('2026-03-09', '2026-03-07').kind).toBe('soon'));
  it('文案', () => {
    expect(formatExpiry({ kind: 'expired', days: -3 })).toBe('已过期 3 天');
    expect(formatExpiry({ kind: 'soon', days: 0 })).toBe('今天到期');
  });
});

describe('filterItems', () => {
  const items = [
    item({ name: 'AA 电池', category: '日用杂物', location: '客厅抽屉', quantity: 8 }),
    item({ name: '牛奶', category: '食品', quantity: 1, minimum: 2, expiryDate: '2026-11-05' }),
  ];
  const run = (over = {}) => filterItems(items, { query: '', category: '全部', view: 'all', today, ...over }).map((i) => i.name);
  it('搜索忽略大小写并匹配位置', () => {
    expect(run({ query: 'aa' })).toEqual(['AA 电池']);
    expect(run({ query: '客厅' })).toEqual(['AA 电池']);
  });
  it('分类和视图', () => {
    expect(run({ category: '食品' })).toEqual(['牛奶']);
    expect(run({ view: 'low' })).toEqual(['牛奶']);
    expect(run({ view: 'expiring' })).toEqual(['牛奶']);
  });
});

it('sortItems 把最紧急的排前面', () => {
  const sorted = sortItems([
    item({ name: '普通' }),
    item({ name: '缺货', quantity: 0 }),
    item({ name: '临期', expiryDate: '2026-11-04' }),
    item({ name: '过期', expiryDate: '2026-11-01' }),
  ], today);
  expect(sorted.map((i) => i.name)).toEqual(['过期', '临期', '缺货', '普通']);
});

it('normalizeEmail 与 Firebase token 的小写邮箱一致', () => {
  expect(normalizeEmail('  Amy@Gmail.COM ')).toBe('amy@gmail.com');
});

describe('金额', () => {
  it.each([['12', 1200], ['12.3', 1230], ['12.34', 1234], ['0.01', 1], ['19.99', 1999], [' 5. ', 500]])('解析 %s', (input, cents) => {
    expect(parseAmount(input)).toBe(cents);
  });
  it.each(['', '0', '0.00', '-1', 'abc', '1.234', '1,50', '12345678'])('拒绝 %s', (input) => {
    expect(parseAmount(input)).toBeNull();
  });
  it('格式化', () => {
    expect(formatMoney(150000)).toBe('$1,500.00');
    expect(formatMoney(5)).toBe('$0.05');
  });
});

describe('shiftMonth', () => {
  it('跨年', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
  });
  it('普通月份', () => expect(shiftMonth('2026-11', -1)).toBe('2026-10'));
});

describe('账目汇总', () => {
  const expense = (id: string, amountCents: number, category: string, paidBy: string, date = '2026-11-01'): Expense =>
    ({ id, amountCents, category, paidBy, date, note: '' });
  const list = [expense('a', 10, '买菜', 'n', '2026-11-01'), expense('b', 20, '餐饮', 'a', '2026-11-03'), expense('c', 5, '买菜', 'a', '2026-11-02')];

  it('总额、分类和付款人', () => {
    expect(summarizeExpenses(list)).toEqual({
      total: 35,
      byCategory: [{ name: '餐饮', cents: 20 }, { name: '买菜', cents: 15 }],
      byPayer: [{ name: 'a', cents: 25 }, { name: 'n', cents: 10 }],
    });
  });
  it('空账单', () => expect(summarizeExpenses([])).toEqual({ total: 0, byCategory: [], byPayer: [] }));
  it('按日期倒序', () => expect(sortExpenses(list).map((e) => e.id)).toEqual(['b', 'c', 'a']));
});
