// Discount and delivery helpers for products

/**
 * Compute the active discount for a product.
 * Returns { active, percent, amount, finalPrice, label, description, until } or null.
 */
export function computeDiscount(product) {
  if (!product || !product.discount_active) return null;
  // Check expiry
  if (product.discount_until) {
    const until = new Date(product.discount_until);
    if (isNaN(until.getTime()) || until.getTime() <= Date.now()) return null;
  }
  const dtype = product.discount_type;
  const dval = Number(product.discount_value) || 0;
  if (dval <= 0) return null;

  const price = Number(product.price) || 0;
  let finalPrice = price;
  let percent = 0;
  let amount = 0;

  if (dtype === 'percent') {
    percent = Math.min(99, Math.max(0, dval));
    amount = (price * percent) / 100;
    finalPrice = Math.max(0, price - amount);
  } else if (dtype === 'amount') {
    amount = Math.max(0, dval);
    finalPrice = Math.max(0, price - amount);
    percent = price > 0 ? (amount / price) * 100 : 0;
  } else {
    return null;
  }

  return {
    active: true,
    type: dtype,
    percent: Math.round(percent * 10) / 10,
    amount: Math.round(amount * 100) / 100,
    finalPrice: Math.round(finalPrice * 100) / 100,
    label: product.discount_label || '',
    description: product.discount_description || '',
    until: product.discount_until || null,
  };
}

/**
 * Format discount badge text.
 * "−15%" for percent, "−500 ₽" for amount.
 */
export function formatDiscountBadge(discount) {
  if (!discount) return '';
  if (discount.type === 'percent') {
    return `−${Math.round(discount.percent)}%`;
  }
  return `−${new Intl.NumberFormat('ru-RU').format(discount.amount)} ₽`;
}

/**
 * Format until date for tooltip (DD.MM.YYYY).
 */
export function formatUntilDate(until) {
  if (!until) return null;
  try {
    return new Date(until).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return null;
  }
}

/**
 * Get delivery badge info: { label, colorClasses, dotColor } based on delivery_days.
 *  0          → "Сегодня"           green
 *  1          → "1 день"            green
 *  2..7       → "N дн."             yellow
 *  >7         → "N дн."             red
 */
export function getDeliveryBadge(deliveryDays) {
  const d = Number(deliveryDays);
  if (isNaN(d) || d < 0) {
    return {
      label: '—',
      classes: 'bg-slate-100 text-slate-500 border-slate-200',
    };
  }
  if (d === 0) {
    return {
      label: 'Сегодня',
      classes: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    };
  }
  if (d === 1) {
    return {
      label: '1 день',
      classes: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    };
  }
  if (d <= 7) {
    return {
      label: `${d} дн.`,
      classes: 'bg-amber-100 text-amber-700 border-amber-200',
    };
  }
  return {
    label: `${d} дн.`,
    classes: 'bg-rose-100 text-rose-700 border-rose-200',
  };
}
