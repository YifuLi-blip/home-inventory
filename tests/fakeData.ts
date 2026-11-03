// 只用于 `vite --mode fake` 的界面测试：与 src/data.ts 相同的接口，数据放在内存里。
import type { Account, Household, Item, ItemInput } from '../src/types';

type Listener<T> = (value: T) => void;
const params = new URLSearchParams(location.search);
let account: Account | null = null;
let households: Household[] = [];
let items: Item[] = [];
const accountListeners = new Set<Listener<Account | null>>();
const householdListeners = new Set<Listener<Household[]>>();
const itemListeners = new Set<Listener<Item[]>>();

const emit = () => {
  accountListeners.forEach((listener) => listener(account));
  householdListeners.forEach((listener) => listener(households));
  itemListeners.forEach((listener) => listener(items));
};
const watch = <T>(set: Set<Listener<T>>, listener: Listener<T>, value: T) => {
  set.add(listener); listener(value);
  return () => { set.delete(listener); };
};
const addDays = (days: number) => {
  const date = new Date(); date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

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
export async function saveMembers(id: string, memberEmails: string[]) {
  households = households.map((entry) => entry.id === id ? { ...entry, memberEmails } : entry); emit();
}
export const watchItems = (_id: string, callback: Listener<Item[]>, _onError: (error: Error) => void) => watch(itemListeners, callback, items);
export async function addItem(_id: string, input: ItemInput) { items = [...items, { ...input, id: String(Date.now()) }]; emit(); }
export async function updateItem(_h: string, id: string, input: ItemInput) { items = items.map((item) => item.id === id ? { ...input, id } : item); emit(); }
export async function changeQuantity(_h: string, id: string, delta: number) { items = items.map((item) => item.id === id ? { ...item, quantity: item.quantity + delta } : item); emit(); }
export async function deleteItem(_h: string, id: string) { items = items.filter((item) => item.id !== id); emit(); }
