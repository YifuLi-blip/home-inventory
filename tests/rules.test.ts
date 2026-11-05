// 运行方式：npm run test:rules（需要 Java，会启动官方 Firestore emulator）
import { readFileSync } from 'node:fs';
import {
  assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection, deleteDoc, doc, getDoc, getDocs, increment, query, serverTimestamp,
  setDoc, updateDoc, where,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

let env: RulesTestEnvironment;
const HOME = 'home';
const noahEmail = 'noah@example.com';
const amyEmail = 'amy@example.com';

const as = (uid: string, email: string, verified = true) =>
  env.authenticatedContext(uid, { email, email_verified: verified }).firestore();
const noah = () => as('noah', noahEmail);
const amy = () => as('amy', amyEmail);
const stranger = () => as('eve', 'eve@example.com');

const itemData = (uid: string, over = {}) => ({
  name: '牛奶', category: '食品', location: '冰箱', quantity: 2, unit: '盒', minimum: 1,
  expiryDate: '2026-12-01', updatedAt: serverTimestamp(), updatedBy: uid, ...over,
});

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-jiali',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});
afterAll(() => env.cleanup());
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'households', HOME), {
      name: '我们的家', ownerUid: 'noah', ownerEmail: noahEmail,
      memberEmails: [noahEmail, amyEmail], createdAt: new Date(),
    });
    await setDoc(doc(db, 'households', HOME, 'items', 'milk'), {
      name: '牛奶', category: '食品', location: '冰箱', quantity: 2, unit: '盒', minimum: 1,
      expiryDate: null, updatedAt: new Date(), updatedBy: 'noah',
    });
  });
});

const householdRef = (db: ReturnType<typeof noah>) => doc(db, 'households', HOME);
const milkRef = (db: ReturnType<typeof noah>) => doc(db, 'households', HOME, 'items', 'milk');
const newItemRef = (db: ReturnType<typeof noah>) => doc(db, 'households', HOME, 'items', 'new');

describe('访问控制', () => {
  it('未登录不能读', () => assertFails(getDoc(milkRef(env.unauthenticatedContext().firestore()))));
  it('外人不能读家庭和物品', async () => {
    await assertFails(getDoc(householdRef(stranger())));
    await assertFails(getDoc(milkRef(stranger())));
  });
  it('邮箱未验证的账号不能冒充成员', async () => {
    const fake = as('fake', amyEmail, false);
    await assertFails(getDoc(householdRef(fake)));
    await assertFails(getDoc(milkRef(fake)));
    await assertFails(setDoc(newItemRef(fake), itemData('fake')));
  });
  it('成员可以读，也能按邮箱查到家庭', async () => {
    await assertSucceeds(getDoc(milkRef(amy())));
    const db = amy();
    await assertSucceeds(getDocs(query(collection(db, 'households'), where('memberEmails', 'array-contains', amyEmail))));
  });
  it('不能查询别人的家庭或全部家庭', async () => {
    const db = stranger();
    await assertFails(getDocs(query(collection(db, 'households'), where('memberEmails', 'array-contains', amyEmail))));
    await assertFails(getDocs(collection(db, 'households')));
  });
});

describe('家庭', () => {
  const household = (over = {}) => ({
    name: '新家', ownerUid: 'eve', ownerEmail: 'eve@example.com',
    memberEmails: ['eve@example.com'], createdAt: serverTimestamp(), ...over,
  });
  it('已验证用户可以创建自己的家庭', () =>
    assertSucceeds(setDoc(doc(stranger(), 'households', 'h2'), household())));
  it('不能以别人名义创建家庭', () =>
    assertFails(setDoc(doc(stranger(), 'households', 'h2'), household({ ownerUid: 'noah' }))));
  it('外人不能把自己加进家庭', () =>
    assertFails(updateDoc(householdRef(stranger()), { memberEmails: [noahEmail, amyEmail, 'eve@example.com'] })));
  it('成员可以增减其他成员', () =>
    assertSucceeds(updateDoc(householdRef(amy()), { memberEmails: [noahEmail, amyEmail, 'mom@example.com'] })));
  it('不能移除所有者或改所有者', async () => {
    await assertFails(updateDoc(householdRef(amy()), { memberEmails: [amyEmail] }));
    await assertFails(updateDoc(householdRef(amy()), { ownerUid: 'amy' }));
  });
  it('成员可以修改两类分类，外人不行', async () => {
    await assertSucceeds(updateDoc(householdRef(amy()), { ledgerCategories: ['買菜', '🐾寵物'] }));
    await assertSucceeds(updateDoc(householdRef(amy()), { itemCategories: ['食品', '🐾寵物'] }));
    await assertFails(updateDoc(householdRef(stranger()), { ledgerCategories: ['黑客'] }));
  });
  it('分类必须是 1 到 30 项的列表', async () => {
    for (const field of ['ledgerCategories', 'itemCategories']) {
      await assertFails(updateDoc(householdRef(amy()), { [field]: 'x' }));
      await assertFails(updateDoc(householdRef(amy()), { [field]: [] }));
      await assertFails(updateDoc(householdRef(amy()), { [field]: Array(31).fill('x') }));
    }
  });
  it('已有旧分类字段的家庭仍可更新', async () => {
    await env.withSecurityRulesDisabled((context) =>
      updateDoc(doc(context.firestore(), 'households', HOME), { expenseCategories: ['买菜'] }));
    await assertSucceeds(updateDoc(householdRef(amy()), { ledgerCategories: ['買菜'] }));
    await assertFails(updateDoc(householdRef(amy()), { expenseCategories: ['x'] }));
  });
  it('客户端不能删除家庭', () => assertFails(deleteDoc(householdRef(noah()))));
});

describe('物品', () => {
  it('成员可以增删改', async () => {
    await assertSucceeds(setDoc(newItemRef(amy()), itemData('amy')));
    await assertSucceeds(setDoc(milkRef(amy()), itemData('amy', { quantity: 9 })));
    await assertSucceeds(deleteDoc(milkRef(noah())));
  });
  it('外人不能写', async () => {
    await assertFails(setDoc(newItemRef(stranger()), itemData('eve')));
    await assertFails(deleteDoc(milkRef(stranger())));
  });
  it('App 的加减写法能通过', () =>
    assertSucceeds(updateDoc(milkRef(amy()), { quantity: increment(-1), updatedAt: serverTimestamp(), updatedBy: 'amy' })));
  it('数量不能减到负数', () =>
    assertFails(updateDoc(milkRef(amy()), { quantity: increment(-3), updatedAt: serverTimestamp(), updatedBy: 'amy' })));
  it('拒绝错误字段、错误日期和冒名修改', async () => {
    await assertFails(setDoc(newItemRef(amy()), itemData('amy', { hacked: true })));
    await assertFails(setDoc(newItemRef(amy()), itemData('amy', { expiryDate: 'tomorrow' })));
    await assertFails(setDoc(newItemRef(amy()), itemData('noah')));
    await assertFails(setDoc(newItemRef(amy()), itemData('amy', { name: '' })));
  });
});

describe('账目', () => {
  const expenseData = (uid: string, over = {}) => ({
    amountCents: 1234, category: '买菜', note: 'Costco', date: '2026-11-03',
    paidBy: amyEmail, updatedAt: serverTimestamp(), updatedBy: uid, ...over,
  });
  const expenseRef = (db: ReturnType<typeof noah>) => doc(db, 'households', HOME, 'expenses', 'e1');

  it('成员可以增删改，并能按月查询', async () => {
    await assertSucceeds(setDoc(expenseRef(amy()), expenseData('amy')));
    await assertSucceeds(setDoc(expenseRef(noah()), expenseData('noah', { amountCents: 999 })));
    const db = noah();
    await assertSucceeds(getDocs(query(
      collection(db, 'households', HOME, 'expenses'),
      where('date', '>=', '2026-11-01'), where('date', '<=', '2026-11-31'),
    )));
    await assertSucceeds(deleteDoc(expenseRef(noah())));
  });
  it('外人和未验证账号不能读写', async () => {
    await assertFails(setDoc(expenseRef(stranger()), expenseData('eve')));
    await assertFails(getDocs(collection(stranger(), 'households', HOME, 'expenses')));
    await assertFails(setDoc(expenseRef(as('fake', amyEmail, false)), expenseData('fake')));
  });
  it('拒绝非法金额、日期和冒名修改', async () => {
    await assertFails(setDoc(expenseRef(amy()), expenseData('amy', { amountCents: 0 })));
    await assertFails(setDoc(expenseRef(amy()), expenseData('amy', { amountCents: -5 })));
    await assertFails(setDoc(expenseRef(amy()), expenseData('amy', { amountCents: 12.5 })));
    await assertFails(setDoc(expenseRef(amy()), expenseData('amy', { date: 'today' })));
    await assertFails(setDoc(expenseRef(amy()), expenseData('noah')));
    await assertFails(setDoc(expenseRef(amy()), expenseData('amy', { extra: true })));
  });
});
