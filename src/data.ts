import { initializeApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword, getAuth, onAuthStateChanged, reload,
  sendEmailVerification, sendPasswordResetEmail, signInWithEmailAndPassword, signOut,
  type User,
} from 'firebase/auth';
import {
  addDoc, collection, deleteDoc, doc, increment, initializeFirestore, onSnapshot,
  persistentLocalCache, persistentMultipleTabManager, query, serverTimestamp,
  setDoc, updateDoc, where,
} from 'firebase/firestore';
import type { Account, Expense, ExpenseInput, Household, Item, ItemInput } from './types';

const app = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
});

const auth = getAuth(app);
auth.languageCode = 'zh-CN';

// 持久缓存让地下室没信号时也能查看和修改，联网后自动同步。
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

const toAccount = (user: User): Account => ({
  uid: user.uid, email: user.email ?? '', verified: user.emailVerified,
});

const itemsRef = (householdId: string) => collection(db, 'households', householdId, 'items');
const expensesRef = (householdId: string) => collection(db, 'households', householdId, 'expenses');
const audit = () => ({ updatedAt: serverTimestamp(), updatedBy: auth.currentUser?.uid });

export function watchAccount(callback: (account: Account | null) => void) {
  return onAuthStateChanged(auth, (user) => callback(user ? toAccount(user) : null));
}

export const signIn = (email: string, password: string) =>
  signInWithEmailAndPassword(auth, email, password).then(() => undefined);

export async function signUp(email: string, password: string) {
  const { user } = await createUserWithEmailAndPassword(auth, email, password);
  await sendEmailVerification(user);
}

export const resetPassword = (email: string) => sendPasswordResetEmail(auth, email);
export const logOut = () => signOut(auth);

export async function resendVerification() {
  if (auth.currentUser) await sendEmailVerification(auth.currentUser);
}

/** 验证后必须强制刷新 token，Security Rules 才能看到 email_verified。 */
export async function refreshAccount(): Promise<Account | null> {
  const user = auth.currentUser;
  if (!user) return null;
  await reload(user);
  await user.getIdToken(true);
  return toAccount(user);
}

export function watchHouseholds(
  email: string,
  callback: (households: Household[]) => void,
  onError: (error: Error) => void,
) {
  const memberOf = query(collection(db, 'households'), where('memberEmails', 'array-contains', email));
  return onSnapshot(memberOf, (snapshot) => {
    callback(snapshot.docs.map((entry) => {
      const { name, ownerEmail, memberEmails } = entry.data();
      return { id: entry.id, name, ownerEmail, memberEmails };
    }).sort((a, b) => a.id.localeCompare(b.id)));
  }, onError);
}

export async function createHousehold(name: string, account: Account) {
  await setDoc(doc(collection(db, 'households')), {
    name,
    ownerUid: account.uid,
    ownerEmail: account.email,
    memberEmails: [account.email],
    createdAt: serverTimestamp(),
  });
}

export const saveMembers = (householdId: string, memberEmails: string[]) =>
  updateDoc(doc(db, 'households', householdId), { memberEmails });

export function watchItems(
  householdId: string,
  callback: (items: Item[]) => void,
  onError: (error: Error) => void,
) {
  return onSnapshot(itemsRef(householdId), (snapshot) => {
    callback(snapshot.docs.map((entry) => {
      const { name, category, location, quantity, unit, minimum, expiryDate } = entry.data();
      return { id: entry.id, name, category, location, quantity, unit, minimum, expiryDate };
    }));
  }, onError);
}

// 下面的写操作离线时要等联网才 resolve，所以 UI 不要 await 它们再关弹窗。
export const addItem = (householdId: string, item: ItemInput) =>
  addDoc(itemsRef(householdId), { ...item, ...audit() }).then(() => undefined);

export const updateItem = (householdId: string, id: string, item: ItemInput) =>
  setDoc(doc(itemsRef(householdId), id), { ...item, ...audit() });

export const changeQuantity = (householdId: string, id: string, delta: number) =>
  updateDoc(doc(itemsRef(householdId), id), { quantity: increment(delta), ...audit() });

export const deleteItem = (householdId: string, id: string) =>
  deleteDoc(doc(itemsRef(householdId), id));

/** month 为 YYYY-MM，日期是零填充字符串，可以直接按字典序筛选。 */
export function watchExpenses(
  householdId: string,
  month: string,
  callback: (expenses: Expense[]) => void,
  onError: (error: Error) => void,
) {
  const inMonth = query(
    expensesRef(householdId),
    where('date', '>=', `${month}-01`),
    where('date', '<=', `${month}-31`),
  );
  return onSnapshot(inMonth, (snapshot) => {
    callback(snapshot.docs.map((entry) => {
      const { amountCents, category, note, date, paidBy } = entry.data();
      return { id: entry.id, amountCents, category, note, date, paidBy };
    }));
  }, onError);
}

export const addExpense = (householdId: string, expense: ExpenseInput) =>
  addDoc(expensesRef(householdId), { ...expense, ...audit() }).then(() => undefined);

export const updateExpense = (householdId: string, id: string, expense: ExpenseInput) =>
  setDoc(doc(expensesRef(householdId), id), { ...expense, ...audit() });

export const deleteExpense = (householdId: string, id: string) =>
  deleteDoc(doc(expensesRef(householdId), id));
