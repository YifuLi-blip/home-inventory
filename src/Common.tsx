import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import * as data from './data';
import { addCategory, categoryLabel, normalizeEmail } from './logic';
import type { Account, Household } from './types';

export function AppHeader({ account, household, children }: { account: Account; household: Household; children?: ReactNode }) {
  const [showMembers, setShowMembers] = useState(false);
  const online = useOnline();
  return (
    <>
      <header className="topbar">
        <div className="topbar-row">
          <div className="brand"><span className="brand-mark">存</span><span>{household.name}</span></div>
          <button className="avatar" onClick={() => setShowMembers(true)} aria-label="成员与账号">
            {account.email.charAt(0).toUpperCase()}
          </button>
        </div>
        {children}
      </header>
      {!online && <p className="offline">离线中，改动会在联网后自动同步</p>}
      {showMembers && <MembersDialog account={account} household={household} onClose={() => setShowMembers(false)} />}
    </>
  );
}

function MembersDialog({ account, household, onClose }: { account: Account; household: Household; onClose: () => void }) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  async function save(memberEmails: string[]) {
    setError('');
    try { await data.saveMembers(household.id, memberEmails); }
    catch { setError('保存失败，成员管理需要联网。'); }
  }

  function add(event: FormEvent) {
    event.preventDefault();
    const next = normalizeEmail(email);
    if (household.memberEmails.includes(next)) { setError('这个邮箱已经是成员。'); return; }
    setEmail('');
    void save([...household.memberEmails, next]);
  }

  return (
    <Dialog title="家庭成员" onClose={onClose}>
      <ul className="members">
        {household.memberEmails.map((member) => (
          <li key={member}>
            <span>{member}{member === account.email && ' （我）'}</span>
            {member !== household.ownerEmail && <button onClick={() => void save(household.memberEmails.filter((entry) => entry !== member))} aria-label={`移除 ${member}`}>移除</button>}
          </li>
        ))}
      </ul>
      <form onSubmit={add} className="inline-form">
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="家人的邮箱" aria-label="家人的邮箱" required />
        <button className="primary-button">添加</button>
      </form>
      {error && <p className="form-error" role="alert">{error}</p>}
      <p className="muted small">家人用这个邮箱注册并完成验证后，就会自动进入这个家。</p>
      <div className="panel-links"><button onClick={data.logOut}>退出登录（{account.email}）</button></div>
    </Dialog>
  );
}

export function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section className="modal" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-header"><h2>{title}</h2><button onClick={onClose} aria-label="关闭">×</button></div>
        {children}
      </section>
    </div>
  );
}

export function CategoryDialog({ categories, iconFor, onChange, onClose }: {
  categories: string[]; iconFor: (category: string) => string; onChange: (categories: string[]) => void; onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  function add(event: FormEvent) {
    event.preventDefault();
    const result = addCategory(categories, name);
    if ('error' in result) { setError(result.error); return; }
    setError(''); setName('');
    onChange(result.categories);
  }

  return (
    <Dialog title="管理分类" onClose={onClose}>
      <ul className="members">
        {categories.map((category) => (
          <li key={category}>
            <span>{iconFor(category)} {categoryLabel(category)}</span>
            {categories.length > 1 && <button onClick={() => onChange(categories.filter((entry) => entry !== category))} aria-label={`删除分类 ${category}`}>删除</button>}
          </li>
        ))}
      </ul>
      <form onSubmit={add} className="inline-form">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="新分类名称" aria-label="新分类名称" />
        <button className="primary-button">添加</button>
      </form>
      {error && <p className="form-error" role="alert">{error}</p>}
      <p className="muted small">分类全家共用。名称前可以加 emoji，例如 🐾寵物。删除分类不会影响已有记录。</p>
    </Dialog>
  );
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return <div className="empty-state"><h3>{title}</h3>{hint && <p>{hint}</p>}</div>;
}

export function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  return message ? <button className="toast" onClick={onClose}>{message}</button> : null;
}

function useOnline() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);
  return online;
}
