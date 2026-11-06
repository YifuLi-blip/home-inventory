import { useEffect, useState } from 'react';
import * as data from './data';
import { AuthScreen, HouseholdSetup, VerifyEmail } from './AuthScreens';
import { Inventory } from './Inventory';
import { Ledger } from './Ledger';
import type { Account, Household } from './types';

export function App() {
  const [account, setAccount] = useState<Account | null | undefined>(undefined);
  useEffect(() => data.watchAccount(setAccount), []);

  if (account === undefined) return <Splash />;
  if (!account) return <AuthScreen />;
  if (!account.verified) return <VerifyEmail account={account} onVerified={setAccount} />;
  return <HouseholdGate key={account.uid} account={account} />;
}

function HouseholdGate({ account }: { account: Account }) {
  const [households, setHouseholds] = useState<Household[] | undefined>(undefined);
  const [error, setError] = useState('');

  useEffect(
    () => data.watchHouseholds(account.email, setHouseholds, () => setError('读取家庭失败，请稍后重试。')),
    [account.email],
  );

  if (error) return <Splash message={error} />;
  if (!households) return <Splash />;
  if (households.length === 0) return <HouseholdSetup account={account} />;
  return <Home account={account} household={households[0]} />;
}

function Home({ account, household }: { account: Account; household: Household }) {
  const [tab, setTab] = useState<'inventory' | 'ledger'>('inventory');
  return (
    <>
      {tab === 'inventory'
        ? <Inventory account={account} household={household} />
        : <Ledger account={account} household={household} />}
      <nav className="tabbar" aria-label="主导航">
        <button className={tab === 'inventory' ? 'active' : ''} aria-current={tab === 'inventory' ? 'page' : undefined} onClick={() => setTab('inventory')}><span aria-hidden="true">▦</span>库存</button>
        <button className={tab === 'ledger' ? 'active' : ''} aria-current={tab === 'ledger' ? 'page' : undefined} onClick={() => setTab('ledger')}><span aria-hidden="true">$</span>记账</button>
      </nav>
    </>
  );
}

function Splash({ message = '正在打开…' }: { message?: string }) {
  return <main className="center-screen"><span className="brand-mark">存</span><p>{message}</p></main>;
}
