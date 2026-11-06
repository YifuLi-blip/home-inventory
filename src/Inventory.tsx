import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { AppHeader, CategoryDialog, Dialog, Empty, Toast } from './Common';
import * as data from './data';
import {
  CATEGORIES, categoryLabel, expiryState, filterItems, formatExpiry, iconFor, isExpiring, isLow,
  localDate, sortItems, withUsedCategories, type ViewFilter,
} from './logic';
import type { Account, Household, Item, ItemInput } from './types';

type Editing = Item | 'new' | null;

export function Inventory({ account, household }: { account: Account; household: Household }) {
  const [items, setItems] = useState<Item[] | undefined>(undefined);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('全部');
  const [view, setView] = useState<ViewFilter>('all');
  const [editing, setEditing] = useState<Editing>(null);
  const [managing, setManaging] = useState(false);
  const [toast, setToast] = useState('');
  const today = localDate();

  useEffect(
    () => data.watchItems(household.id, setItems, () => setToast('读取库存失败，请重新打开。')),
    [household.id],
  );

  // 写入先进本地缓存，界面立即更新；只有服务器拒绝时才提示。
  const guard = (write: Promise<unknown>) => { write.catch(() => setToast('保存失败，改动已撤销。')); };

  const all = items ?? [];
  const categories = household.itemCategories ?? CATEGORIES;
  // 删除后仍有物品在用的分类继续显示；没人用的分类被删除时自动回到“全部”。
  const filterOptions = useMemo(
    () => withUsedCategories(categories, all.map((item) => item.category)),
    [categories, all],
  );
  const activeCategory = filterOptions.includes(category) ? category : '全部';
  const lowCount = all.filter(isLow).length;
  const expiringCount = all.filter((item) => isExpiring(item, today)).length;
  const locations = useMemo(() => [...new Set(all.map((item) => item.location).filter(Boolean))].sort(), [all]);
  const visible = useMemo(
    () => sortItems(filterItems(all, { query, category: activeCategory, view, today }), today),
    [all, query, activeCategory, view, today],
  );

  const toggleView = (next: ViewFilter) => setView(view === next ? 'all' : next);

  return (
    <main className="app-shell">
      <AppHeader account={account} household={household}>
        <label className="search">
          <span aria-hidden="true">⌕</span>
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索物品、位置或分类" aria-label="搜索" />
        </label>
      </AppHeader>

      <section className="content">
        <div className="stats-grid">
          <button className={`stat-card coral ${view === 'low' ? 'selected' : ''}`} aria-pressed={view === 'low'} onClick={() => toggleView('low')}>
            <span>待补货</span><strong>{lowCount}</strong>
          </button>
          <button className={`stat-card sand ${view === 'expiring' ? 'selected' : ''}`} aria-pressed={view === 'expiring'} onClick={() => toggleView('expiring')}>
            <span>临期</span><strong>{expiringCount}</strong>
          </button>
          <button className={`stat-card green ${view === 'all' ? 'selected' : ''}`} aria-pressed={view === 'all'} onClick={() => setView('all')}>
            <span>全部物品</span><strong>{all.length}</strong>
          </button>
        </div>

        <div className="chips" role="group" aria-label="按分类筛选">
          {['全部', ...filterOptions].map((name) => (
            <button key={name} className={activeCategory === name ? 'chip active' : 'chip'} aria-pressed={activeCategory === name} onClick={() => setCategory(name)}>{name === '全部' ? name : `${iconFor(name)} ${categoryLabel(name)}`}</button>
          ))}
          <button className="chip" onClick={() => setManaging(true)}>管理分类</button>
        </div>

        <div className="inventory-list">
          {items === undefined ? <Empty title="正在读取…" />
            : all.length === 0 ? <Empty title="还没有物品" hint="点右下角的 ＋，先记下手边的第一样东西。" />
            : visible.length === 0 ? <Empty title="没有找到物品" hint="换个关键词或清除筛选试试。" />
            : visible.map((item) => (
              <ItemRow
                key={item.id} item={item} today={today}
                onOpen={() => setEditing(item)}
                onChange={(delta) => guard(data.changeQuantity(household.id, item.id, delta))}
              />
            ))}
        </div>
      </section>

      <button className="fab" onClick={() => setEditing('new')} aria-label="添加物品">＋</button>

      {editing && (
        <ItemDialog
          item={editing === 'new' ? null : editing}
          locations={locations}
          categories={categories}
          onClose={() => setEditing(null)}
          onSave={(input) => {
            guard(editing === 'new' ? data.addItem(household.id, input) : data.updateItem(household.id, editing.id, input));
            setEditing(null);
          }}
          onDelete={editing === 'new' ? undefined : () => {
            guard(data.deleteItem(household.id, editing.id));
            setEditing(null);
          }}
        />
      )}
      {managing && (
        <CategoryDialog
          categories={categories}
          iconFor={iconFor}
          onChange={(next) => guard(data.saveCategories(household.id, 'itemCategories', next))}
          onClose={() => setManaging(false)}
        />
      )}
      <Toast message={toast} onClose={() => setToast('')} />
    </main>
  );
}

function ItemRow({ item, today, onOpen, onChange }: { item: Item; today: string; onOpen: () => void; onChange: (delta: number) => void }) {
  const expiry = expiryState(item.expiryDate, today);
  const expiryUrgent = expiry.kind === 'soon' || expiry.kind === 'expired';
  return (
    <article className="inventory-row">
      <button className="item-main" onClick={onOpen} aria-label={`编辑 ${item.name}`}>
        <span className="item-emoji">{iconFor(item.category)}</span>
        <span className="item-text">
          <strong>{item.name}</strong>
          <small>{item.location || categoryLabel(item.category)}</small>
          {(isLow(item) || expiryUrgent) && (
            <span className="badges">
              {isLow(item) && <span className="status low">需要补货</span>}
              {expiryUrgent && <span className={`status ${expiry.kind}`}>{formatExpiry(expiry)}</span>}
            </span>
          )}
        </span>
      </button>
      <div className="quantity">
        <button onClick={() => onChange(-1)} disabled={item.quantity < 1} aria-label={`${item.name} 减少一个`}>−</button>
        <strong>{item.quantity}<small>{item.unit}</small></strong>
        <button onClick={() => onChange(1)} aria-label={`${item.name} 增加一个`}>＋</button>
      </div>
    </article>
  );
}

function ItemDialog({ item, locations, categories, onClose, onSave, onDelete }: {
  item: Item | null; locations: string[]; categories: string[]; onClose: () => void;
  onSave: (input: ItemInput) => void; onDelete?: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const categoryOptions = withUsedCategories(categories, item ? [item.category] : []);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onSave({
      name: String(form.get('name')).trim(),
      category: String(form.get('category')),
      location: String(form.get('location')).trim(),
      quantity: Number(form.get('quantity')),
      unit: String(form.get('unit')).trim() || '件',
      minimum: Number(form.get('minimum')),
      expiryDate: String(form.get('expiryDate')) || null,
    });
  }

  return (
    <Dialog title={item ? '编辑物品' : '添加物品'} onClose={onClose}>
      <form onSubmit={submit} className="item-form">
        <label className="wide">物品名称<input name="name" defaultValue={item?.name} maxLength={80} placeholder="例如：洗手液" required autoFocus={!item} /></label>
        <label>分类<select name="category" defaultValue={item?.category ?? categoryOptions[0]}>{categoryOptions.map((name) => <option key={name} value={name}>{iconFor(name)} {categoryLabel(name)}</option>)}</select></label>
        <label>存放位置
          <input name="location" list="known-locations" defaultValue={item?.location} maxLength={80} placeholder="例如：浴室镜柜" />
          <datalist id="known-locations">{locations.map((name) => <option key={name} value={name} />)}</datalist>
        </label>
        <label>当前数量<input name="quantity" type="number" inputMode="decimal" min="0" step="any" defaultValue={item?.quantity ?? 1} required /></label>
        <label>单位<input name="unit" defaultValue={item?.unit ?? '件'} maxLength={12} /></label>
        <label>剩多少时提醒<input name="minimum" type="number" inputMode="decimal" min="0" step="any" defaultValue={item?.minimum ?? 1} required /></label>
        <label>保质期（可不填）<input name="expiryDate" type="date" defaultValue={item?.expiryDate ?? ''} /></label>
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
