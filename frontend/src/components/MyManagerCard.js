import { useEffect, useState } from 'react';
import axios from 'axios';
import { UserRound, Phone } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
// «Иван Петров» -> «Иван П.»
export const shortName = (full) => {
  const [first, last] = String(full || '').trim().split(/\s+/);
  return last ? `${first} ${last[0].toUpperCase()}.` : (first || '');
};

// Personal manager of the client (name + first letter of the surname, phone)
export const MyManagerCard = () => {
  const { user } = useAuth();
  const [manager, setManager] = useState(undefined);
  useEffect(() => {
    if (user?.role === 'user') axios.get(`${API}/my-conditions`).then((r) => setManager(r.data.manager || null)).catch(() => setManager(null));
  }, [user]);
  if (user?.role !== 'user' || manager === undefined) return null;
  return (
    <div className="mb-5 rounded-2xl border border-slate-200 bg-white px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-1" data-testid="my-manager-card">
      <span className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center"><UserRound className="w-5 h-5" /></span>
      <div>
        <p className="text-[11px] font-semibold uppercase text-slate-400">Ваш менеджер</p>
        {manager ? (
          <p className="font-semibold text-slate-800" data-testid="my-manager-name">{shortName(manager.name)}</p>
        ) : (
          <p className="font-semibold text-slate-500" data-testid="my-manager-none">Менеджер не назначен</p>
        )}
      </div>
      {manager?.phone && (
        <a href={`tel:${manager.phone}`} className="ml-auto flex items-center gap-1.5 text-sm font-semibold text-teal-600 hover:text-teal-700" data-testid="my-manager-phone"><Phone className="w-4 h-4" />{manager.phone}</a>
      )}
    </div>
  );
};

export default MyManagerCard;
