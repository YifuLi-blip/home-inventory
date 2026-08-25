'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';

type Item = { id: number; name: string; category: string; location: string; quantity: number; unit: string; minimum: number; icon: string };

const starterItems: Item[] = [
  { id: 1, name: '厨房纸', category: '清洁用品', location: '厨房 · 吊柜', quantity: 2, unit: '卷', minimum: 3, icon: '🧻' },
  { id: 2, name: '意大利面', category: '食品', location: '厨房 · 食品柜', quantity: 5, unit: '袋', minimum: 2, icon: '🍝' },
  { id: 3, name: '洗衣液', category: '清洁用品', location: '阳台 · 储物架', quantity: 1, unit: '瓶', minimum: 1, icon: '🫧' },
  { id: 4, name: '电池 AA', category: '日用杂物', location: '客厅 · 抽屉', quantity: 8, unit: '节', minimum: 4, icon: '🔋' },
  { id: 5, name: '猫粮', category: '宠物用品', location: '玄关 · 储物柜', quantity: 3, unit: '袋', minimum: 2, icon: '🐈' },
  { id: 6, name: '牙膏', category: '个护用品', location: '浴室 · 镜柜', quantity: 1, unit: '支', minimum: 2, icon: '🪥' },
];

const categories = ['全部', '食品', '清洁用品', '个护用品', '宠物用品', '日用杂物'];
const categoryIcons: Record<string, string> = { 食品: '🍎', 清洁用品: '🫧', 个护用品: '🪥', 宠物用品: '🐾', 日用杂物: '📦' };

export default function Home() {
  const [items, setItems] = useState<Item[]>(starterItems);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('全部');
  const [lowOnly, setLowOnly] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('home-stock-items');
    if (saved) { try { setItems(JSON.parse(saved)); } catch { /* keep starter data */ } }
    setLoaded(true);
  }, []);
  useEffect(() => { if (loaded) localStorage.setItem('home-stock-items', JSON.stringify(items)); }, [items, loaded]);

  const lowCount = items.filter((item) => item.quantity <= item.minimum).length;
  const locations = new Set(items.map((item) => item.location.split(' · ')[0])).size;
  const filtered = useMemo(() => items.filter((item) => {
    const matchesQuery = `${item.name}${item.category}${item.location}`.includes(query.trim());
    return matchesQuery && (category === '全部' || item.category === category) && (!lowOnly || item.quantity <= item.minimum);
  }), [items, query, category, lowOnly]);

  function changeQuantity(id: number, delta: number) {
    setItems((current) => current.map((item) => item.id === id ? { ...item, quantity: Math.max(0, item.quantity + delta) } : item));
  }

  function addItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const nextCategory = String(data.get('category'));
    setItems((current) => [{
      id: Date.now(), name: String(data.get('name')), category: nextCategory,
      location: String(data.get('location')), quantity: Number(data.get('quantity')),
      unit: String(data.get('unit')) || '件', minimum: Number(data.get('minimum')),
      icon: categoryIcons[nextCategory] || '📦',
    }, ...current]);
    setShowAdd(false);
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">存</span><span>家里有数</span></div>
        <label className="search"><span aria-hidden="true">⌕</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索物品、位置或分类" /></label>
        <div className="top-actions"><button className="icon-button" aria-label="通知">◌<span className="notification-dot" /></button><div className="avatar">N</div></div>
      </header>

      <div className="page-grid">
        <aside className="sidebar">
          <nav aria-label="主导航">
            <p className="nav-label">管理</p>
            <button className="nav-item active" onClick={() => { setCategory('全部'); setLowOnly(false); }}><span>▦</span>全部库存</button>
            <button className="nav-item" onClick={() => setLowOnly(!lowOnly)}><span>◒</span>待补货{lowCount > 0 && <b>{lowCount}</b>}</button>
            <p className="nav-label category-label">分类</p>
            {categories.slice(1).map((name) => <button className="nav-item" key={name} onClick={() => setCategory(name)}><span>{categoryIcons[name]}</span>{name}</button>)}
          </nav>
          <div className="sidebar-note"><span>☼</span><div><strong>一个小提示</strong><p>用完随手减一，库存会一直准确。</p></div></div>
        </aside>

        <section className="content">
          <div className="welcome-row">
            <div><p className="eyebrow">2026年8月23日 · 星期日</p><h1>家里的东西，<em>心里有数。</em></h1><p className="intro">早上好，Noah。这里是你家的物品概览。</p></div>
            <button className="primary-button" onClick={() => setShowAdd(true)}><span>＋</span> 添加物品</button>
          </div>

          <div className="stats-grid">
            <article className="stat-card green"><div className="stat-icon">▦</div><div><span>库存物品</span><strong>{items.length}</strong><small>种物品</small></div><i>记录得很好</i></article>
            <article className="stat-card coral"><div className="stat-icon">!</div><div><span>需要补货</span><strong>{lowCount}</strong><small>种物品</small></div><button onClick={() => setLowOnly(true)}>查看清单 →</button></article>
            <article className="stat-card sand"><div className="stat-icon">⌂</div><div><span>收纳区域</span><strong>{locations}</strong><small>个位置</small></div><i>井井有条</i></article>
          </div>

          <div className="section-header">
            <div><h2>{lowOnly ? '待补货清单' : '最近库存'}</h2><p>{lowOnly ? '这些物品已经不多了' : '所有物品的最新数量'}</p></div>
            <div className="filters"><select aria-label="筛选分类" value={category} onChange={(e) => setCategory(e.target.value)}>{categories.map((name) => <option key={name}>{name}</option>)}</select>{(category !== '全部' || lowOnly) && <button className="clear-filter" onClick={() => { setCategory('全部'); setLowOnly(false); }}>清除筛选</button>}</div>
          </div>

          <div className="inventory-list">
            <div className="table-head"><span>物品</span><span>存放位置</span><span>状态</span><span>当前数量</span></div>
            {filtered.length === 0 ? <div className="empty-state"><span>⌕</span><h3>没有找到物品</h3><p>换个关键词或清除筛选试试。</p></div> : filtered.map((item) => {
              const isLow = item.quantity <= item.minimum;
              return <article className="inventory-row" key={item.id}>
                <div className="item-main"><span className="item-emoji">{item.icon}</span><div><strong>{item.name}</strong><small>{item.category}</small></div></div>
                <div className="location"><span>⌂</span>{item.location}</div>
                <div><span className={`status ${isLow ? 'low' : 'enough'}`}>{isLow ? '需要补货' : '库存充足'}</span></div>
                <div className="quantity"><button onClick={() => changeQuantity(item.id, -1)} aria-label={`${item.name} 减少一个`}>−</button><strong>{item.quantity}<small>{item.unit}</small></strong><button onClick={() => changeQuantity(item.id, 1)} aria-label={`${item.name} 增加一个`}>＋</button></div>
              </article>;
            })}
          </div>
        </section>
      </div>

      {showAdd && <div className="modal-backdrop" onMouseDown={() => setShowAdd(false)}>
        <section className="modal" role="dialog" aria-modal="true" aria-labelledby="add-title" onMouseDown={(e) => e.stopPropagation()}>
          <div className="modal-header"><div><p className="eyebrow">新库存记录</p><h2 id="add-title">添加一件家中物品</h2></div><button onClick={() => setShowAdd(false)} aria-label="关闭">×</button></div>
          <form onSubmit={addItem}>
            <label className="wide">物品名称<input name="name" placeholder="例如：洗手液" required autoFocus /></label>
            <label>分类<select name="category">{categories.slice(1).map((name) => <option key={name}>{name}</option>)}</select></label>
            <label>存放位置<input name="location" placeholder="例如：浴室 · 镜柜" required /></label>
            <label>当前数量<input name="quantity" type="number" min="0" defaultValue="1" required /></label>
            <label>单位<input name="unit" placeholder="瓶 / 包 / 件" defaultValue="件" required /></label>
            <label className="wide">最低库存提醒<input name="minimum" type="number" min="0" defaultValue="1" required /></label>
            <div className="form-actions wide"><button type="button" onClick={() => setShowAdd(false)}>取消</button><button className="primary-button" type="submit">添加到库存</button></div>
          </form>
        </section>
      </div>}
    </main>
  );
}
