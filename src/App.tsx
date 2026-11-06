import { useEffect, useState } from 'react';
import * as data from './data';
import { CalendarPage } from './CalendarPage';
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

type Tab = 'ledger' | 'calendar' | 'inventory';

function Home({ account, household }: { account: Account; household: Household }) {
  const [tab, setTab] = useState<Tab>('ledger');
  return (
    <>
      {tab === 'ledger' && <Ledger account={account} household={household} />}
      {tab === 'calendar' && <CalendarPage account={account} household={household} />}
      {tab === 'inventory' && <Inventory account={account} household={household} />}
      <nav className="tabbar" aria-label="主导航">
        <button className={tab === 'ledger' ? 'active' : ''} aria-current={tab === 'ledger' ? 'page' : undefined} onClick={() => setTab('ledger')}><span aria-hidden="true">$</span>记账</button>
        <button className={tab === 'calendar' ? 'tab-circle active' : 'tab-circle'} aria-label="日历" aria-current={tab === 'calendar' ? 'page' : undefined} onClick={() => setTab('calendar')}>
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15.5" rx="3" /><path d="M3.5 10h17M8 3v4M16 3v4" /></svg>
        </button>
        <button className={tab === 'inventory' ? 'active' : ''} aria-current={tab === 'inventory' ? 'page' : undefined} onClick={() => setTab('inventory')}><span aria-hidden="true">▦</span>库存</button>
      </nav>
    </>
  );
}

function Splash({ message = '正在打开…' }: { message?: string }) {
  return <main className="center-screen"><span className="brand-mark">存</span><p>{message}</p></main>;
}
