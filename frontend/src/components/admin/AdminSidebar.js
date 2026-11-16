import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronDown, LogOut } from 'lucide-react';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '../ui/sheet';
import { useAdminAttention, useVisibleNav } from './AdminNav';
import { sumCounts, isNavActive } from '../../lib/adminNav';

const Count = ({ n, testid }) => (n > 0 ? (
  <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center tabular-nums" data-testid={testid}>
    {n > 99 ? '99+' : n}
  </span>
) : null);

const SidebarGroup = ({ group, counts, location, prefix = 'admin-nav-item-' }) => {
  const [open, setOpen] = useState(true);
  const total = group.items.reduce((s, i) => s + sumCounts(counts, i.counts), 0);
  return (
    <div className="mb-2" data-testid={`${prefix === 'admin-nav-item-' ? 'admin-sidebar-group' : 'admin-drawer-group'}-${group.id}`}>
      <button type="button" onClick={() => setOpen((v) => !v)} className="w-full flex items-center gap-2 px-3 py-2 text-[11px] font-bold uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors duration-200" aria-expanded={open} data-testid={`${prefix === 'admin-nav-item-' ? 'admin-nav-group' : 'admin-drawer-toggle'}-${group.id}`}>
        <span className="flex-1 text-left">{group.label}</span>
        {!open && <Count n={total} />}
        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? '' : '-rotate-90'}`} />
      </button>
      {open && group.items.map((i) => {
        const Icon = i.icon;
        const on = isNavActive(location, i.to);
        return (
          <Link key={i.to} to={i.to} className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-colors duration-200 ${on ? 'bg-teal-500 text-white font-semibold shadow-sm shadow-teal-500/30' : 'text-slate-700 hover:bg-slate-100'}`} data-testid={prefix === 'admin-nav-item-' && i.testid ? i.testid : `${prefix}${i.to}`}>
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

// Same menu as the desktop sidebar, sliding in from the left on phones
export const AdminMobileDrawer = ({ open, onOpenChange, onLogout }) => {
  const location = useLocation();
  const counts = useAdminAttention();
  const { pinned, groups } = useVisibleNav();
  useEffect(() => { onOpenChange(false); }, [location.pathname, location.search, onOpenChange]);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-72 max-w-[85vw] p-3 overflow-y-auto md:hidden" data-testid="admin-mobile-drawer">
        <SheetTitle className="px-3 pt-1 pb-3 text-lg font-bold tracking-tight text-slate-900">Админ панель</SheetTitle>
        <SheetDescription className="sr-only">Разделы админ панели</SheetDescription>
        <div data-testid="admin-mobile-nav">
          <div className="mb-3 pb-3 border-b border-slate-100">
            {pinned.map((i) => {
              const Icon = i.icon;
              const on = isNavActive(location, i.to);
              return (
                <Link key={i.to} to={i.to} className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors duration-200 ${on ? 'bg-teal-500 text-white' : 'text-slate-800 hover:bg-slate-100'}`} data-testid={`mobile-admin-nav-${i.to}`}>
                  <Icon className={`w-4 h-4 ${on ? 'text-white' : 'text-slate-400'}`} />
                  <span className="flex-1">{i.label}</span>
                  <Count n={sumCounts(counts, i.counts)} />
                </Link>
              );
            })}
          </div>
          {groups.map((g) => <SidebarGroup key={g.id} group={g} counts={counts} location={location} prefix="mobile-admin-nav-" />)}
          <button type="button" onClick={onLogout} className="mt-2 w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-red-500 hover:bg-red-50 transition-colors duration-200" data-testid="mobile-admin-logout">
            <LogOut className="w-4 h-4" />Выйти
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
