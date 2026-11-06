// 只用于 `vite --mode fake` 的界面测试：与 src/data.ts 相同的接口，数据放在内存里。
import type { Account, Expense, ExpenseInput, Household, Item, ItemInput, JournalEntry, JournalInput } from '../src/types';

type Listener<T> = (value: T) => void;
const params = new URLSearchParams(location.search);
let account: Account | null = null;
let households: Household[] = [];
let items: Item[] = [];
let expenses: Expense[] = [];
let journal: JournalEntry[] = [];
const accountListeners = new Set<Listener<Account | null>>();
const householdListeners = new Set<Listener<Household[]>>();
const itemListeners = new Set<Listener<Item[]>>();
const expenseListeners = new Map<Listener<Expense[]>, string>();
const journalListeners = new Map<Listener<JournalEntry[]>, string>();

const emit = () => {
  accountListeners.forEach((listener) => listener(account));
  householdListeners.forEach((listener) => listener(households));
  itemListeners.forEach((listener) => listener(items));
  journalListeners.forEach((month, listener) => listener(journal.filter((entry) => entry.date.startsWith(month))));
  expenseListeners.forEach((month, listener) => listener(expenses.filter((entry) => entry.date.startsWith(month))));
};
const watch = <T>(set: Set<Listener<T>>, listener: Listener<T>, value: T) => {
  set.add(listener); listener(value);
  return () => { set.delete(listener); };
};
const addDays = (days: number) => {
  const date = new Date(); date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

export function watchExpenses(_id: string, month: string, callback: Listener<Expense[]>, _onError: (error: Error) => void) {
  expenseListeners.set(callback, month);
  callback(expenses.filter((entry) => entry.date.startsWith(month)));
  return () => { expenseListeners.delete(callback); };
}
export async function addExpense(_id: string, input: ExpenseInput) { expenses = [...expenses, { ...input, id: String(Date.now()) }]; emit(); }
export async function updateExpense(_h: string, id: string, input: ExpenseInput) { expenses = expenses.map((entry) => entry.id === id ? { ...input, id } : entry); emit(); }
export async function deleteExpense(_h: string, id: string) { expenses = expenses.filter((entry) => entry.id !== id); emit(); }

export function watchJournal(_id: string, month: string, callback: Listener<JournalEntry[]>, _onError: (error: Error) => void) {
  journalListeners.set(callback, month);
  callback(journal.filter((entry) => entry.date.startsWith(month)));
  return () => { journalListeners.delete(callback); };
}
export async function addJournal(_h: string, owner: Account, input: JournalInput) { journal = [...journal, { ...input, id: String(Date.now()), author: owner.email, authorUid: owner.uid }]; emit(); }
export async function updateJournal(_h: string, id: string, input: JournalInput) { journal = journal.map((entry) => entry.id === id ? { ...entry, ...input } : entry); emit(); }
export async function deleteJournal(_h: string, id: string) { journal = journal.filter((entry) => entry.id !== id); emit(); }

if (params.get('seed')) {
  account = { uid: 'u1', email: 'noah@example.com', verified: true };
  households = [{ id: 'h1', name: '我们的家', ownerEmail: account.email, memberEmails: [account.email, 'amy@example.com'] }];
  const base = { unit: '件', minimum: 1, expiryDate: null };
  items = [
    { ...base, id: '1', name: '厨房纸', category: '清洁用品', location: '厨房吊柜', quantity: 2, unit: '卷', minimum: 3 },
    { ...base, id: '2', name: '意大利面', category: '食品', location: '厨房食品柜', quantity: 5, unit: '袋', expiryDate: addDays(200) },
    { ...base, id: '3', name: '牛奶', category: '食品', location: '冰箱', quantity: 1, unit: '盒', minimum: 0, expiryDate: addDays(3) },
    { ...base, id: '4', name: '酸奶', category: '食品', location: '冰箱', quantity: 2, unit: '杯', minimum: 2, expiryDate: addDays(-2) },
    { ...base, id: '5', name: 'AA 电池', category: '日用杂物', location: '客厅抽屉', quantity: 8, unit: '节' },
    { ...base, id: '6', name: '一个名字特别特别特别长的家庭装洗衣液补充包', category: '清洁用品', location: '阳台储物架最上面那一层', quantity: 12, unit: '瓶', minimum: 2 },
  ];
  journal = [{ id: 'j1', date: addDays(0), text: '今天一起去了 Costco，\n回家做了火锅。', author: 'amy@example.com', authorUid: 'u2' }];
  expenses = [
    { id: 'e1', amountCents: 8642, category: '買菜', note: 'Costco', date: addDays(0), paidBy: 'noah@example.com' },
    { id: 'e2', amountCents: 3250, category: '餐飲', note: '', date: addDays(0), paidBy: 'amy@example.com' },
    { id: 'e3', amountCents: 150000, category: '房租', note: '一条特别特别特别长的备注，用来检查手机上的换行效果', date: addDays(0), paidBy: 'noah@example.com' },
  ];
}

export const watchAccount = (callback: Listener<Account | null>) => watch(accountListeners, callback, account);
export async function signIn(email: string) { account = { uid: 'u1', email, verified: true }; emit(); }
export async function signUp(email: string) { account = { uid: 'u1', email, verified: false }; emit(); }
export async function resetPassword() {}
export async function logOut() { account = null; emit(); }
export async function resendVerification() {}
export async function refreshAccount() { if (account) account = { ...account, verified: true }; return account; }
export const watchHouseholds = (_email: string, callback: Listener<Household[]>, _onError: (error: Error) => void) => watch(householdListeners, callback, households);
export async function createHousehold(name: string, owner: Account) {
  households = [{ id: 'h1', name, ownerEmail: owner.email, memberEmails: [owner.email] }]; emit();
}
export async function saveCategories(id: string, field: 'ledgerCategories' | 'itemCategories', categories: string[]) {
  households = households.map((entry) => entry.id === id ? { ...entry, [field]: categories } : entry); emit();
}
export async function saveMembers(id: string, memberEmails: string[]) {
  households = households.map((entry) => entry.id === id ? { ...entry, memberEmails } : entry); emit();
}
export const watchItems = (_id: string, callback: Listener<Item[]>, _onError: (error: Error) => void) => watch(itemListeners, callback, items);
export async function addItem(_id: string, input: ItemInput) { items = [...items, { ...input, id: String(Date.now()) }]; emit(); }
export async function updateItem(_h: string, id: string, input: ItemInput) { items = items.map((item) => item.id === id ? { ...input, id } : item); emit(); }
export async function changeQuantity(_h: string, id: string, delta: number) { items = items.map((item) => item.id === id ? { ...item, quantity: item.quantity + delta } : item); emit(); }
export async function deleteItem(_h: string, id: string) { items = items.filter((item) => item.id !== id); emit(); }
