import { useEffect, useState } from 'react';
import * as data from './data';
import { AuthScreen, HouseholdSetup, VerifyEmail } from './AuthScreens';
import { Inventory } from './Inventory';
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
  return <Inventory account={account} household={households[0]} />;
}

function Splash({ message = '正在打开…' }: { message?: string }) {
  return <main className="center-screen"><span className="brand-mark">存</span><p>{message}</p></main>;
}
