import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { useAdminAttention, useVisibleNav } from './AdminNav';
import { sumCounts, isNavActive } from '../../lib/adminNav';

const Count = ({ n, testid }) => (n > 0 ? (
  <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center tabular-nums" data-testid={testid}>
    {n > 99 ? '99+' : n}
  </span>
) : null);

const SidebarGroup = ({ group, counts, location }) => {
  const [open, setOpen] = useState(true);
  const total = group.items.reduce((s, i) => s + sumCounts(counts, i.counts), 0);
  return (
    <div className="mb-2" data-testid={`admin-sidebar-group-${group.id}`}>
      <button type="button" onClick={() => setOpen((v) => !v)} className="w-full flex items-center gap-2 px-3 py-2 text-[11px] font-bold uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors duration-200" aria-expanded={open} data-testid={`admin-nav-group-${group.id}`}>
        <span className="flex-1 text-left">{group.label}</span>
        {!open && <Count n={total} testid={`admin-nav-group-badge-${group.id}`} />}
        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? '' : '-rotate-90'}`} />
      </button>
      {open && group.items.map((i) => {
        const Icon = i.icon;
        const on = isNavActive(location, i.to);
        return (
          <Link key={i.to} to={i.to} className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-colors duration-200 ${on ? 'bg-teal-500 text-white font-semibold shadow-sm shadow-teal-500/30' : 'text-slate-700 hover:bg-slate-100'}`} data-testid={i.testid || `admin-nav-item-${i.to}`}>
            <Icon className={`w-4 h-4 ${on ? 'text-white' : 'text-slate-400'}`} />
            <span className="flex-1 min-w-0 truncate">{i.label}</span>
            <Count n={sumCounts(counts, i.counts)} />
          </Link>
        );
      })}
    </div>
  );
};

export const AdminSidebar = () => {
  const location = useLocation();
  const counts = useAdminAttention();
  const { groups } = useVisibleNav();
  return (
    <aside className="hidden md:block w-60 flex-shrink-0 border-r border-slate-200 bg-white/80 backdrop-blur-xl" data-testid="admin-sidebar">
      <nav className="sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto p-3">
        <p className="px-3 pt-1 pb-3 text-lg font-bold tracking-tight text-slate-900">Админ панель</p>
        {groups.map((g) => <SidebarGroup key={g.id} group={g} counts={counts} location={location} />)}
      </nav>
    </aside>
  );
};
