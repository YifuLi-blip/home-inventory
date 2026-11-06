import { describe, expect, it } from 'vitest';
import {
  addCategory, categoryLabel, compactMoney, entriesOn, expenseIcon, expiryState, filterItems, formatExpiry, formatMoney, iconFor, isLow, itemsExpiringOn, leadingEmoji, monthDays,
  normalizeEmail, normalizeExpenseCategory, parseAmount,
  shiftMonth, sortExpenses, totalsByDate, sortItems, summarizeExpenses, withUsedCategories,
} from '../src/logic';
import type { Expense, Item, JournalEntry } from '../src/types';

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

describe('addCategory', () => {
  it('去掉空格后加到末尾', () => expect(addCategory(['买菜'], ' 宠物 ')).toEqual({ categories: ['买菜', '宠物'] }));
  it('拒绝空名称、重复和超长', () => {
    expect(addCategory([], '  ')).toHaveProperty('error');
    expect(addCategory(['买菜'], '买菜')).toHaveProperty('error');
    expect(addCategory([], '一二三四五六七八九十一二三四五六七')).toHaveProperty('error');
  });
  it('最多 30 个', () => {
    const full = Array.from({ length: 30 }, (_, index) => `分类${index}`);
    expect(addCategory(full, '新的')).toHaveProperty('error');
  });
});

describe('分类 emoji', () => {
  it('默认分类使用指定图标', () => {
    expect(expenseIcon('買菜')).toBe('🥦');
    expect(expenseIcon('美容')).toBe('💇🏻‍♀️');
  });
  it('自定义名称开头的 emoji 不会被拆开', () => {
    expect(leadingEmoji('💇🏻‍♀️剪髮')).toBe('💇🏻‍♀️');
    expect(categoryLabel('💇🏻‍♀️ 剪髮')).toBe('剪髮');
    expect(iconFor('🐾寵物')).toBe('🐾');
  });
  it('没有 emoji 时使用默认图标', () => {
    expect(leadingEmoji('寵物')).toBeNull();
    expect(categoryLabel('寵物')).toBe('寵物');
    expect(iconFor('寵物')).toBe('📦');
    expect(expenseIcon('寵物')).toBe('🧾');
  });
  it('只有 emoji 时保留原文', () => expect(categoryLabel('🐾')).toBe('🐾'));
  it('旧简体分类并入新分类', () => {
    expect(normalizeExpenseCategory('买菜')).toBe('買菜');
    expect(normalizeExpenseCategory('餐饮')).toBe('餐飲');
    expect(normalizeExpenseCategory('房租')).toBe('房租');
  });
});

it('withUsedCategories 保留仍在使用的旧分类并去重', () => {
  expect(withUsedCategories(['A'], ['A', 'B', 'B', ''])).toEqual(['A', 'B']);
});

describe('日历', () => {
  it('2026 年 11 月从周日开始，共 30 天', () => {
    const days = monthDays('2026-11');
    expect(days).toHaveLength(30);
    expect(days[0]).toBe('2026-11-01');
    expect(days[29]).toBe('2026-11-30');
  });
  it('月初前补空格', () => {
    const days = monthDays('2026-12');
    expect(days.slice(0, 3)).toEqual([null, null, '2026-12-01']);
    expect(days).toHaveLength(33);
  });
  it('闰年二月', () => expect(monthDays('2028-02').filter(Boolean)).toHaveLength(29));
  it('按日期汇总支出', () => {
    const expense = (id: string, amountCents: number, date: string): Expense =>
      ({ id, amountCents, date, category: '買菜', paidBy: 'n', note: '' });
    expect(totalsByDate([expense('a', 100, '2026-11-01'), expense('b', 50, '2026-11-01'), expense('c', 5, '2026-11-02')]))
      .toEqual({ '2026-11-01': 150, '2026-11-02': 5 });
  });
  it('找出当天到期的物品', () => {
    const items = [item({ name: '牛奶', expiryDate: '2026-11-05' }), item({ name: '盐' })];
    expect(itemsExpiringOn(items, '2026-11-05').map((i) => i.name)).toEqual(['牛奶']);
  });
  it('紧凑金额', () => {
    expect(compactMoney(8642)).toBe('$86');
    expect(compactMoney(150000)).toBe('$1.5k');
    expect(compactMoney(200000)).toBe('$2k');
  });
});

it('entriesOn 只返回当天日记，顺序稳定', () => {
  const entry = (id: string, date: string): JournalEntry => ({ id, date, text: 'x', author: 'a', authorUid: 'u' });
  expect(entriesOn([entry('b', '2026-11-05'), entry('a', '2026-11-05'), entry('c', '2026-11-06')], '2026-11-05').map((e) => e.id)).toEqual(['a', 'b']);
});
