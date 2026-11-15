import { useState } from 'react';
import { format, parseISO, isValid } from 'date-fns';
import { ru } from 'date-fns/locale';
import { CalendarDays, X } from 'lucide-react';
import { Calendar } from './ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';

// Date field with a popup calendar. value / onChange use 'YYYY-MM-DD' strings ('' = no date).
export const DatePicker = ({ value, onChange, placeholder = 'Выберите дату', isDark = false, disablePast = true, 'data-testid': testId }) => {
  const [open, setOpen] = useState(false);
  const parsed = value ? parseISO(String(value).slice(0, 10)) : null;
  const date = parsed && isValid(parsed) ? parsed : undefined;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className="relative mt-1.5">
        <PopoverTrigger asChild>
          <button
            type="button"
            className={`w-full h-10 rounded-md border pl-9 pr-8 text-sm text-left transition-colors focus:outline-none focus:border-teal-500 ${isDark ? 'bg-zinc-800 border-zinc-700 text-white hover:border-zinc-500' : 'bg-white border-slate-200 hover:border-teal-300'} ${date ? '' : 'text-slate-400'}`}
            data-testid={testId}
            data-value={date ? format(date, 'yyyy-MM-dd') : ''}
          >
            <CalendarDays className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-teal-500" />
            {date ? format(date, 'd MMMM yyyy', { locale: ru }) : placeholder}
          </button>
        </PopoverTrigger>
        {date && (
          <button type="button" onClick={() => onChange('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-slate-400 hover:text-rose-500" title="Убрать дату" data-testid={testId ? `${testId}-clear` : undefined}>
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <PopoverContent align="start" className="w-auto p-0 rounded-2xl border-slate-200 shadow-xl" data-testid={testId ? `${testId}-calendar` : undefined}>
        <Calendar
          mode="single"
          locale={ru}
          weekStartsOn={1}
          selected={date}
          defaultMonth={date || today}
          disabled={disablePast ? { before: today } : undefined}
          onSelect={(d) => { if (d) { onChange(format(d, 'yyyy-MM-dd')); setOpen(false); } }}
          classNames={{
            day_selected: 'bg-teal-500 text-white hover:bg-teal-600 hover:text-white focus:bg-teal-500 focus:text-white rounded-lg',
            day_today: 'border border-teal-400 text-teal-700 rounded-lg',
            caption_label: 'text-sm font-semibold capitalize',
          }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
};

export default DatePicker;
