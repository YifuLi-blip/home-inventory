import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { AppHeader, Dialog, Empty, Toast } from './Common';
import * as data from './data';
import { ExpenseDialog } from './Ledger';
import {
  EXPENSE_CATEGORIES, categoryLabel, compactMoney, displayName, expenseIcon, expiryState,
  entriesOn, formatDay, formatExpiry, formatMoney, formatMonth, iconFor, itemsExpiringOn, localDate,
  monthDays, shiftMonth, sortExpenses, totalsByDate,
} from './logic';
import type { Account, Expense, Household, Item, JournalEntry, JournalInput } from './types';

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

export function CalendarPage({ account, household }: { account: Account; household: Household }) {
  const today = localDate();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [picked, setPicked] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<{ month: string; expenses: Expense[] } | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [journal, setJournal] = useState<{ month: string; entries: JournalEntry[] } | null>(null);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editingEntry, setEditingEntry] = useState<JournalEntry | 'new' | null>(null);
  const [toast, setToast] = useState('');

  useEffect(
    () => data.watchExpenses(
      household.id, month,
      (expenses) => setLoaded({ month, expenses }),
      () => setToast('读取账目失败，请重新打开。'),
    ),
    [household.id, month],
  );
  useEffect(
    () => data.watchJournal(
      household.id, month,
      (entries) => setJournal({ month, entries }),
      () => setToast('读取日记失败，请重新打开。'),
    ),
    [household.id, month],
  );
  useEffect(
    () => data.watchItems(household.id, setItems, () => setToast('读取库存失败，请重新打开。')),
    [household.id],
  );

  const guard = (write: Promise<unknown>) => { write.catch(() => setToast('保存失败，改动已撤销。')); };

  const expenses = useMemo(() => (loaded?.month === month ? loaded.expenses : []), [loaded, month]);
  const entries = useMemo(() => (journal?.month === month ? journal.entries : []), [journal, month]);
  const entryDates = useMemo(() => new Set(entries.map((entry) => entry.date)), [entries]);
  const totals = useMemo(() => totalsByDate(expenses), [expenses]);
  const days = useMemo(() => monthDays(month), [month]);
  const expiringDates = useMemo(() => new Set(items.map((item) => item.expiryDate)), [items]);

  // 切换月份后，当月默认选中今天，其他月份不选中。
  const selected = picked?.startsWith(month) ? picked : today.startsWith(month) ? today : null;
  const dayExpenses = useMemo(
    () => sortExpenses(expenses.filter((expense) => expense.date === selected)),
    [expenses, selected],
  );
  const dayEntries = selected ? entriesOn(entries, selected) : [];
  const dayItems = selected ? itemsExpiringOn(items, selected) : [];

  return (
    <main className="app-shell">
      <AppHeader account={account} household={household} />
      <section className="content">
        <div className="month-nav">
          <button onClick={() => setMonth(shiftMonth(month, -1))} aria-label="上个月">‹</button>
          <strong>{formatMonth(month)}</strong>
          <button onClick={() => setMonth(shiftMonth(month, 1))} aria-label="下个月">›</button>
        </div>

        <div className="weekdays" aria-hidden="true">{WEEKDAYS.map((name) => <span key={name}>{name}</span>)}</div>
        <div className="calendar-grid">
          {days.map((date, index) => {
            if (!date) return <span key={`blank-${index}`} />;
            const expiring = expiringDates.has(date);
            const label = [
              formatDay(date),
              totals[date] ? `支出 ${formatMoney(totals[date])}` : '',
              entryDates.has(date) ? '有日记' : '',
              expiring ? '有物品到期' : '',
            ].filter(Boolean).join('，');
            return (
              <button
                key={date}
                className={['day-cell', date === today && 'today', date === selected && 'selected'].filter(Boolean).join(' ')}
                aria-label={label}
                aria-pressed={date === selected}
                onClick={() => setPicked(date)}
              >
                <span>{Number(date.slice(8))}</span>
                <small>{totals[date] ? compactMoney(totals[date]) : ''}</small>
                <span className="day-dots">
                  {entryDates.has(date) && <i className="diary" />}
                  {expiring && <i className="expiring" />}
                </span>
              </button>
            );
          })}
        </div>

        {selected && (
          <>
            <div className="day-title">
              <h2>{formatDay(selected)}</h2>
              {totals[selected] > 0 && <span>支出 {formatMoney(totals[selected])}</span>}
            </div>
            {dayEntries.map((entry) => {
              const mine = entry.authorUid === account.uid;
              const body = <>
                <p>{entry.text}</p>
                <small>{displayName(entry.author)}{mine ? ' · 点按编辑' : ''}</small>
              </>;
              return mine
                ? <button className="diary-card" key={entry.id} onClick={() => setEditingEntry(entry)} aria-label={`编辑日记 ${entry.text}`}>{body}</button>
                : <article className="diary-card" key={entry.id}>{body}</article>;
            })}
            {dayEntries.length === 0 && dayExpenses.length === 0 && dayItems.length === 0 && (
              <div className="inventory-list"><Empty title="这天还是空白" hint="点右下角的 ＋，写点什么。" /></div>
            )}
            {(dayExpenses.length > 0 || dayItems.length > 0) && <div className="inventory-list">
              {dayExpenses.map((expense) => (
                <button className="expense-row" key={expense.id} onClick={() => setEditingExpense(expense)} aria-label={`编辑 ${categoryLabel(expense.category)} ${formatMoney(expense.amountCents)}`}>
                  <span className="item-emoji">{expenseIcon(expense.category)}</span>
                  <span className="item-text">
                    <strong>{expense.note || categoryLabel(expense.category)}</strong>
                    <small>{displayName(expense.paidBy)}</small>
                  </span>
                  <strong>{formatMoney(expense.amountCents)}</strong>
                </button>
              ))}
              {dayItems.map((item) => {
                const state = expiryState(item.expiryDate, today);
                return (
                  <div className="calendar-item" key={item.id}>
                    <span className="item-emoji">{iconFor(item.category)}</span>
                    <span className="item-text">
                      <strong>{item.name}</strong>
                      <small>{item.location || categoryLabel(item.category)}</small>
                    </span>
                    <span className={`status ${state.kind === 'ok' ? 'soon' : state.kind}`}>{formatExpiry(state)}</span>
                  </div>
                );
              })}
            </div>}
          </>
        )}
      </section>

      <button className="fab" onClick={() => setEditingEntry('new')} aria-label="写日记">＋</button>

      {editingEntry && (
        <JournalDialog
          entry={editingEntry === 'new' ? null : editingEntry}
          defaultDate={selected ?? today}
          onClose={() => setEditingEntry(null)}
          onSave={(input) => {
            guard(editingEntry === 'new'
              ? data.addJournal(household.id, account, input)
              : data.updateJournal(household.id, editingEntry.id, input));
            setPicked(input.date);
            setEditingEntry(null);
          }}
          onDelete={editingEntry === 'new' ? undefined : () => {
            guard(data.deleteJournal(household.id, editingEntry.id));
            setEditingEntry(null);
          }}
        />
      )}
      {editingExpense && (
        <ExpenseDialog
          expense={editingExpense}
          members={household.memberEmails}
          categories={household.ledgerCategories ?? EXPENSE_CATEGORIES}
          currentEmail={account.email}
          onClose={() => setEditingExpense(null)}
          onSave={(input) => {
            guard(data.updateExpense(household.id, editingExpense.id, input));
            setEditingExpense(null);
          }}
          onDelete={() => {
            guard(data.deleteExpense(household.id, editingExpense.id));
            setEditingExpense(null);
          }}
        />
      )}
      <Toast message={toast} onClose={() => setToast('')} />
    </main>
  );
}

function JournalDialog({ entry, defaultDate, onClose, onSave, onDelete }: {
  entry: JournalEntry | null; defaultDate: string; onClose: () => void;
  onSave: (input: JournalInput) => void; onDelete?: () => void;
}) {
  const [confirming, setConfirming] = useState(false);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onSave({ date: String(form.get('date')), text: String(form.get('text')).trim() });
  }

  return (
    <Dialog title={entry ? '编辑日记' : '写日记'} onClose={onClose}>
      <form onSubmit={submit} className="item-form">
        <label className="wide">日期<input name="date" type="date" defaultValue={entry?.date ?? defaultDate} required /></label>
        <label className="wide">内容<textarea name="text" rows={6} maxLength={2000} defaultValue={entry?.text} placeholder="今天家里发生了什么？" required autoFocus={!entry} /></label>
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
