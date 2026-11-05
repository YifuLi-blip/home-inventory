import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { AppHeader, CategoryDialog, Dialog, Empty, Toast } from './Common';
import * as data from './data';
import {
  EXPENSE_CATEGORIES, categoryLabel, centsToInput, displayName, expenseIcon, formatMoney, formatMonth,
  localDate, parseAmount, shiftMonth, sortExpenses, summarizeExpenses, withUsedCategories,
} from './logic';
import type { Account, Expense, ExpenseInput, Household } from './types';

type Editing = Expense | 'new' | null;

export function Ledger({ account, household }: { account: Account; household: Household }) {
  const thisMonth = localDate().slice(0, 7);
  const [month, setMonth] = useState(thisMonth);
  const [loaded, setLoaded] = useState<{ month: string; expenses: Expense[] } | null>(null);
  const [editing, setEditing] = useState<Editing>(null);
  const [managing, setManaging] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(
    () => data.watchExpenses(
      household.id, month,
      (expenses) => setLoaded({ month, expenses }),
      () => setToast('读取账目失败，请重新打开。'),
    ),
    [household.id, month],
  );

  const guard = (write: Promise<unknown>) => { write.catch(() => setToast('保存失败，改动已撤销。')); };

  // 切换月份时不显示上个月的旧数据。
  const expenses = useMemo(() => (loaded?.month === month ? loaded.expenses : undefined), [loaded, month]);
  const list = useMemo(() => sortExpenses(expenses ?? []), [expenses]);
  const summary = useMemo(() => summarizeExpenses(expenses ?? []), [expenses]);
  const categories = household.ledgerCategories ?? EXPENSE_CATEGORIES;
  const largest = summary.byCategory[0]?.cents ?? 1;

  return (
    <main className="app-shell">
      <AppHeader account={account} household={household} />
      <section className="content">
        <div className="month-nav">
          <button onClick={() => setMonth(shiftMonth(month, -1))} aria-label="上个月">‹</button>
          <strong>{formatMonth(month)}</strong>
          <button onClick={() => setMonth(shiftMonth(month, 1))} disabled={month >= thisMonth} aria-label="下个月">›</button>
        </div>

        <div className="ledger-total">
          <span>{formatMonth(month)}支出</span>
          <strong>{formatMoney(summary.total)}</strong>
          {summary.byPayer.length > 0 && (
            <div className="payers">
              {summary.byPayer.map(({ name, cents }) => <span key={name}>{displayName(name)} 付了 {formatMoney(cents)}</span>)}
            </div>
          )}
        </div>

        {summary.byCategory.length > 0 && (
          <div className="breakdown" aria-label="分类汇总">
            {summary.byCategory.map(({ name, cents }) => (
              <div className="breakdown-row" key={name}>
                <span>{expenseIcon(name)} {categoryLabel(name)}</span>
                <strong>{formatMoney(cents)}</strong>
                <div className="bar"><i style={{ width: `${(cents / largest) * 100}%` }} /></div>
              </div>
            ))}
          </div>
        )}

        <div className="ledger-actions"><button onClick={() => setManaging(true)}>管理分类</button></div>

        <div className="inventory-list">
          {expenses === undefined ? <Empty title="正在读取…" />
            : list.length === 0 ? <Empty title="这个月还没有账目" hint="点右下角的 ＋，记下第一笔。" />
            : list.map((expense) => (
              <button className="expense-row" key={expense.id} onClick={() => setEditing(expense)} aria-label={`编辑 ${categoryLabel(expense.category)} ${formatMoney(expense.amountCents)}`}>
                <span className="item-emoji">{expenseIcon(expense.category)}</span>
                <span className="item-text">
                  <strong>{expense.note || categoryLabel(expense.category)}</strong>
                  <small>{expense.date.slice(5).replace('-', '/')} · {displayName(expense.paidBy)}</small>
                </span>
                <strong>{formatMoney(expense.amountCents)}</strong>
              </button>
            ))}
        </div>
      </section>

      <button className="fab" onClick={() => setEditing('new')} aria-label="记一笔">＋</button>

      {editing && (
        <ExpenseDialog
          expense={editing === 'new' ? null : editing}
          members={household.memberEmails}
          categories={categories}
          currentEmail={account.email}
          onClose={() => setEditing(null)}
          onSave={(input) => {
            guard(editing === 'new' ? data.addExpense(household.id, input) : data.updateExpense(household.id, editing.id, input));
            setEditing(null);
          }}
          onDelete={editing === 'new' ? undefined : () => {
            guard(data.deleteExpense(household.id, editing.id));
            setEditing(null);
          }}
        />
      )}
      {managing && (
        <CategoryDialog
          categories={categories}
          iconFor={expenseIcon}
          onChange={(next) => guard(data.saveCategories(household.id, 'ledgerCategories', next))}
          onClose={() => setManaging(false)}
        />
      )}
      <Toast message={toast} onClose={() => setToast('')} />
    </main>
  );
}

function ExpenseDialog({ expense, members, categories, currentEmail, onClose, onSave, onDelete }: {
  expense: Expense | null; members: string[]; categories: string[]; currentEmail: string; onClose: () => void;
  onSave: (input: ExpenseInput) => void; onDelete?: () => void;
}) {
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  // 已被移除的成员也要留在选项里，否则编辑旧账目时付款人会被改掉。
  const categoryOptions = withUsedCategories(categories, expense ? [expense.category] : []);
  const payers = expense && !members.includes(expense.paidBy) ? [...members, expense.paidBy] : members;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const amountCents = parseAmount(String(form.get('amount')));
    if (amountCents === null) { setError('请输入大于 0 的金额，最多两位小数。'); return; }
    onSave({
      amountCents,
      category: String(form.get('category')),
      note: String(form.get('note')).trim(),
      date: String(form.get('date')),
      paidBy: String(form.get('paidBy')),
    });
  }

  return (
    <Dialog title={expense ? '编辑账目' : '记一笔'} onClose={onClose}>
      <form onSubmit={submit} className="item-form">
        <label className="wide">金额（CAD）<input name="amount" inputMode="decimal" defaultValue={expense ? centsToInput(expense.amountCents) : ''} placeholder="0.00" required autoFocus={!expense} /></label>
        <label>分类<select name="category" defaultValue={expense?.category ?? categoryOptions[0]}>{categoryOptions.map((name) => <option key={name} value={name}>{expenseIcon(name)} {categoryLabel(name)}</option>)}</select></label>
        <label>日期<input name="date" type="date" defaultValue={expense?.date ?? localDate()} required /></label>
        <label className="wide">谁付的<select name="paidBy" defaultValue={expense?.paidBy ?? currentEmail}>{payers.map((email) => <option key={email} value={email}>{displayName(email)}</option>)}</select></label>
        <label className="wide">备注（可不填）<input name="note" defaultValue={expense?.note} maxLength={100} placeholder="例如：Costco" /></label>
        {error && <p className="form-error wide" role="alert">{error}</p>}
        <div className="form-actions wide">
          {onDelete && (confirming
            ? <button type="button" className="danger" onClick={onDelete}>确认删除</button>
            : <button type="button" className="text-danger" onClick={() => setConfirming(true)}>删除</button>)}
          <button className="primary-button" type="submit">保存</button>
        </div>
      </form>
    </Dialog>
  );
}
