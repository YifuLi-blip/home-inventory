import { useState, type FormEvent } from 'react';
import * as data from './data';
import { normalizeEmail } from './logic';
import type { Account } from './types';

function authMessage(error: unknown) {
  const code = (error as { code?: string }).code ?? '';
  const messages: Record<string, string> = {
    'auth/invalid-credential': '邮箱或密码不正确。',
    'auth/invalid-email': '邮箱格式不正确。',
    'auth/email-already-in-use': '这个邮箱已经注册，请直接登录。',
    'auth/weak-password': '密码至少需要 6 位。',
    'auth/too-many-requests': '尝试次数太多，请稍后再试。',
    'auth/network-request-failed': '网络连接失败，请检查网络。',
  };
  return messages[code] ?? '操作失败，请稍后重试。';
}

export function AuthScreen() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError(''); setNotice('');
    try {
      if (mode === 'signin') await data.signIn(normalizeEmail(email), password);
      else await data.signUp(normalizeEmail(email), password);
    } catch (caught) { setError(authMessage(caught)); }
    setBusy(false);
  }

  async function reset() {
    setError(''); setNotice('');
    if (!email) { setError('请先填写邮箱。'); return; }
    try {
      await data.resetPassword(normalizeEmail(email));
      setNotice('如果这个邮箱已注册，重置邮件很快就到。');
    } catch (caught) { setError(authMessage(caught)); }
  }

  return (
    <main className="center-screen">
      <section className="panel">
        <div className="brand"><span className="brand-mark">存</span><span>家里有数</span></div>
        <h1>家里的东西，<em>心里有数。</em></h1>
        <form onSubmit={submit} className="stack">
          <label>邮箱<input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
          <label>密码<input type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          {notice && <p className="form-notice">{notice}</p>}
          <button className="primary-button" disabled={busy}>{mode === 'signin' ? '登录' : '注册'}</button>
        </form>
        <div className="panel-links">
          <button onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); }}>{mode === 'signin' ? '第一次使用？注册账号' : '已有账号？去登录'}</button>
          {mode === 'signin' && <button onClick={reset}>忘记密码</button>}
        </div>
      </section>
    </main>
  );
}

export function VerifyEmail({ account, onVerified }: { account: Account; onVerified: (account: Account) => void }) {
  const [message, setMessage] = useState('');

  async function check() {
    setMessage('');
    try {
      const next = await data.refreshAccount();
      if (next?.verified) onVerified(next);
      else setMessage('还没有验证成功，请先点开邮件里的链接。');
    } catch { setMessage('网络连接失败，请稍后重试。'); }
  }

  async function resend() {
    try { await data.resendVerification(); setMessage('已重新发送，也看看垃圾邮件。'); }
    catch { setMessage('发送太频繁，请稍后再试。'); }
  }

  return (
    <main className="center-screen">
      <section className="panel">
        <h2>验证你的邮箱</h2>
        <p className="muted">验证链接已发到 {account.email}。点开后回到这里继续。</p>
        <div className="stack">
          <button className="primary-button" onClick={check}>我已经验证</button>
          {message && <p className="form-notice">{message}</p>}
        </div>
        <div className="panel-links"><button onClick={resend}>重新发送</button><button onClick={data.logOut}>退出登录</button></div>
      </section>
    </main>
  );
}

export function HouseholdSetup({ account }: { account: Account }) {
  const [name, setName] = useState('我们的家');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError('');
    try { await data.createHousehold(name.trim(), account); }
    catch { setError('创建失败，请检查网络后重试。'); setBusy(false); }
  }

  return (
    <main className="center-screen">
      <section className="panel">
        <h2>创建你的家</h2>
        <p className="muted">如果家人已经创建过，请让他在“成员”里添加 {account.email}，这里会自动进入，不用再创建。</p>
        <form onSubmit={submit} className="stack">
          <label>家庭名称<input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} required /></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="primary-button" disabled={busy}>创建</button>
        </form>
        <div className="panel-links"><button onClick={data.logOut}>退出登录</button></div>
      </section>
    </main>
  );
}
