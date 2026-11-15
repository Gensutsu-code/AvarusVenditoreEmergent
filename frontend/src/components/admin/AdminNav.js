import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ChevronDown, Search, LogOut, AlertCircle, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useFeatures } from '../../context/FeaturesContext';
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../ui/command';
import { ADMIN_PINNED, ADMIN_GROUPS, ADMIN_SEARCH_EXTRA, ATTENTION_ITEMS, sumCounts, isNavActive } from '../../lib/adminNav';
import { SITE_FEATURES } from '../../lib/siteFeatures';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const useAdminAttention = () => {
  const [counts, setCounts] = useState({});
  useEffect(() => {
    const load = () => axios.get(`${API}/admin/attention`).then((r) => setCounts(r.data || {})).catch(() => {});
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);
  return counts;
};

const Badge = ({ n, testid }) => (n > 0 ? (
  <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center tabular-nums" data-testid={testid}>
    {n > 99 ? '99+' : n}
  </span>
) : null);

const useVisibleNav = () => {
  const { isEnabled } = useFeatures();
  return useMemo(() => {
    const ok = (i) => !i.feature || isEnabled(i.feature);
    return {
      pinned: ADMIN_PINNED.filter(ok),
      groups: ADMIN_GROUPS.map((g) => ({ ...g, items: g.items.filter(ok) })).filter((g) => g.items.length),
    };
  }, [isEnabled]);
};

const AdminSearch = ({ groups, pinned }) => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { isEnabled } = useFeatures();
  useEffect(() => {
    const onKey = (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen((v) => !v); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const go = (to) => { setOpen(false); navigate(to); };
  const row = (i, prefix) => {
    const Icon = i.icon;
    return (
      <CommandItem key={`${prefix}-${i.to}-${i.label}`} value={`${i.label} ${i.keywords || ''}`} onSelect={() => go(i.to)} data-testid={`admin-search-item-${i.to}`}>
        {Icon && <Icon className="w-4 h-4 mr-2 text-slate-400" />}{i.label}
      </CommandItem>
    );
  };
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="h-9 px-3 rounded-xl border border-slate-200 bg-white/80 text-slate-400 hover:border-teal-300 hover:text-teal-600 transition-colors duration-200 flex items-center gap-2 text-sm" data-testid="admin-search-btn">
        <Search className="w-4 h-4" /><span className="hidden xl:inline">Поиск</span><kbd className="hidden xl:inline whitespace-nowrap text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-400">Ctrl K</kbd>
      </button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Раздел, страница или настройка…" data-testid="admin-search-input" />
        <CommandList>
          <CommandEmpty>Ничего не найдено</CommandEmpty>
          <CommandGroup heading="Основное">{pinned.map((i) => row(i, 'p'))}</CommandGroup>
          {groups.map((g) => <CommandGroup key={g.id} heading={g.label}>{g.items.map((i) => row(i, g.id))}</CommandGroup>)}
          <CommandGroup heading="Настройки">{ADMIN_SEARCH_EXTRA.map((i) => row(i, 'x'))}</CommandGroup>
          <CommandGroup heading="Функции сайта">
            {SITE_FEATURES.map((f) => row({ label: `${f.title}${isEnabled(f.key) ? '' : ' (отключено)'}`, to: `/admin/features?open=${f.key}`, keywords: f.short }, 'f'))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
};

const linkCls = (active) => `px-3 py-2 rounded-xl text-sm font-medium flex items-center gap-1.5 transition-colors duration-200 ${active ? 'bg-teal-50 text-teal-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`;

const GroupMenu = ({ group, counts, location }) => {
  const [open, setOpen] = useState(false);
  const active = group.items.some((i) => isNavActive(location, i.to));
  const total = group.items.reduce((s, i) => s + sumCounts(counts, i.counts), 0);
  useEffect(() => { setOpen(false); }, [location.pathname, location.search]);
  return (
    <div className="relative" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button type="button" onClick={() => setOpen((v) => !v)} className={linkCls(active)} aria-expanded={open} data-testid={`admin-nav-group-${group.id}`}>
        {group.label}
        <Badge n={total} testid={`admin-nav-group-badge-${group.id}`} />
        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-full pt-2 z-50" data-testid={`admin-nav-menu-${group.id}`}>
          <div className="w-64 p-1.5 rounded-2xl bg-white border border-slate-200 shadow-xl">
            {group.items.map((i) => {
              const Icon = i.icon;
              const on = isNavActive(location, i.to);
              return (
                <Link key={i.to} to={i.to} className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-colors duration-200 ${on ? 'bg-teal-50 text-teal-700 font-semibold' : 'text-slate-700 hover:bg-slate-50'}`} data-testid={i.testid || `admin-nav-item-${i.to}`}>
                  <Icon className="w-4 h-4 text-slate-400" />
                  <span className="flex-1">{i.label}</span>
                  <Badge n={sumCounts(counts, i.counts)} />
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export const AdminDesktopNav = ({ onLogout, notifications }) => {
  const location = useLocation();
  const counts = useAdminAttention();
  const { pinned, groups } = useVisibleNav();
  return (
    <div className="flex items-center gap-1 ml-auto" data-testid="admin-nav">
      {pinned.map((i) => {
        const Icon = i.icon;
        return (
          <Link key={i.to} to={i.to} className={linkCls(isNavActive(location, i.to))} data-testid={i.testid}>
            <Icon className="w-4 h-4" />{i.label}<Badge n={sumCounts(counts, i.counts)} testid={`${i.testid}-badge`} />
          </Link>
        );
      })}
      <span className="w-px h-6 bg-slate-200 mx-1" />
      {groups.map((g) => <GroupMenu key={g.id} group={g} counts={counts} location={location} />)}
      <span className="w-px h-6 bg-slate-200 mx-1" />
      <AdminSearch groups={groups} pinned={pinned} />
      {notifications}
      <button type="button" onClick={onLogout} className="p-2 rounded-xl text-slate-500 hover:text-red-500 hover:bg-red-100 transition-colors duration-200" data-testid="logout-button" title="Выйти">
        <LogOut className="w-4 h-4" />
      </button>
    </div>
  );
};

export const AdminMobileNav = ({ onNavigate }) => {
  const location = useLocation();
  const counts = useAdminAttention();
  const { pinned, groups } = useVisibleNav();
  const row = (i) => {
    const Icon = i.icon;
    return (
      <Link key={i.to} to={i.to} onClick={onNavigate} className={`flex items-center gap-3 p-3 rounded-xl ${isNavActive(location, i.to) ? 'bg-teal-50 text-teal-700' : 'text-slate-600 hover:bg-slate-50'}`} data-testid={`mobile-admin-nav-${i.to}`}>
        <Icon className="w-5 h-5" /><span className="flex-1">{i.label}</span><Badge n={sumCounts(counts, i.counts)} />
      </Link>
    );
  };
  return (
    <div data-testid="admin-mobile-nav">
      {pinned.map(row)}
      {groups.map((g) => (
        <div key={g.id}>
          <p className="px-3 pt-4 pb-1 text-[11px] font-bold uppercase tracking-widest text-slate-400">{g.label}</p>
          {g.items.map(row)}
        </div>
      ))}
    </div>
  );
};

export const AttentionBlock = () => {
  const counts = useAdminAttention();
  const items = ATTENTION_ITEMS.filter((i) => (counts[i.key] || 0) > 0);
  return (
    <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5" data-testid="attention-block">
      <h2 className="text-lg font-bold tracking-tight text-slate-900 flex items-center gap-2">
        <AlertCircle className={`w-5 h-5 ${items.length ? 'text-rose-500' : 'text-slate-300'}`} />Требует внимания
      </h2>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500 flex items-center gap-2" data-testid="attention-empty"><CheckCircle2 className="w-4 h-4 text-emerald-500" />Всё обработано — заявок, ждущих решения, нет.</p>
      ) : (
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {items.map((i) => (
            <Link key={i.key} to={i.to} className="group flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-200 hover:border-teal-400 transition-colors duration-200" data-testid={`attention-item-${i.key}`}>
              <span className="text-2xl font-black tabular-nums text-slate-900 w-10" data-testid={`attention-count-${i.key}`}>{counts[i.key]}</span>
              <span className="flex-1 text-sm text-slate-600">{i.label}</span>
              <ArrowRight className="w-4 h-4 text-slate-300 transition-transform duration-200 group-hover:translate-x-1 group-hover:text-teal-500" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};
