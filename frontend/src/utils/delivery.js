// Shared delivery time helpers
// delivery_days = 0 → "Сегодня"
// 1 day or "today" → green
// 2-7 days → yellow
// >7 days → red

export const getDeliveryText = (days) => {
  const d = days ?? 0;
  if (d === 0) return 'Сегодня';
  if (d === 1) return '1 день';
  if (d > 1 && d < 5) return `${d} дня`;
  return `${d} дней`;
};

export const getDeliveryColorClasses = (days) => {
  const d = days ?? 0;
  if (d <= 1) {
    return {
      text: 'text-emerald-600',
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
      pill: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    };
  }
  if (d <= 7) {
    return {
      text: 'text-amber-600',
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      pill: 'bg-amber-100 text-amber-700 border-amber-200',
    };
  }
  return {
    text: 'text-rose-600',
    bg: 'bg-rose-50',
    border: 'border-rose-200',
    pill: 'bg-rose-100 text-rose-700 border-rose-200',
  };
};
