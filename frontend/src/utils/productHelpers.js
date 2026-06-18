// Discount and delivery helpers for products

/**
 * Compute the active discount for a product, considering quantity tiers.
 * Returns { active, percent, amount, finalPrice, label, description, until, type } or null.
 */
export function computeDiscount(product, quantity = 1) {
  if (!product || !product.discount_active) return null;
  // Check expiry
  if (product.discount_until) {
    const until = new Date(product.discount_until);
    if (isNaN(until.getTime()) || until.getTime() <= Date.now()) return null;
  }

  let dtype = product.discount_type;
  let dval = Number(product.discount_value) || 0;

  // Tier lookup
  if (Array.isArray(product.discount_tiers) && product.discount_tiers.length) {
    const sorted = [...product.discount_tiers]
      .filter(t => t && t.min_qty != null)
      .sort((a, b) => Number(a.min_qty) - Number(b.min_qty));
    let best = null;
    for (const t of sorted) {
      if (Number(t.min_qty) <= quantity) best = t;
    }
    if (best) {
      dtype = best.type || dtype;
      dval = Number(best.value) || 0;
    }
  }

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
    has_tiers: Array.isArray(product.discount_tiers) && product.discount_tiers.length > 0,
  };
}

/**
 * Return normalized, sorted quantity-discount tiers for client preview.
 * Each tier: { minQty, type, value, percent, amount, finalPrice }.
 * Returns [] when no active tiers (respects discount_active + expiry).
 */
export function getQuantityTiers(product) {
  if (!product || !product.discount_active) return [];
  if (product.discount_until) {
    const until = new Date(product.discount_until);
    if (isNaN(until.getTime()) || until.getTime() <= Date.now()) return [];
  }
  const tiers = Array.isArray(product.discount_tiers) ? product.discount_tiers : [];
  if (!tiers.length) return [];

  const price = Number(product.price) || 0;
  return tiers
    .filter(t => t && t.min_qty != null && Number(t.value) > 0)
    .map(t => {
      const minQty = Number(t.min_qty);
      const type = t.type || 'percent';
      const val = Number(t.value) || 0;
      let percent = 0;
      let amount = 0;
      let finalPrice = price;
      if (type === 'percent') {
        percent = Math.min(99, Math.max(0, val));
        amount = (price * percent) / 100;
        finalPrice = Math.max(0, price - amount);
      } else {
        amount = Math.max(0, val);
        finalPrice = Math.max(0, price - amount);
        percent = price > 0 ? (amount / price) * 100 : 0;
      }
      return {
        minQty,
        type,
        value: val,
        percent: Math.round(percent * 10) / 10,
        amount: Math.round(amount * 100) / 100,
        finalPrice: Math.round(finalPrice * 100) / 100,
      };
    })
    .sort((a, b) => a.minQty - b.minQty);
}

/**
 * Given sorted tiers and a quantity, return the active tier (or null).
 */
export function getActiveTier(tiers, quantity) {
  if (!Array.isArray(tiers) || !tiers.length) return null;
  let best = null;
  for (const t of tiers) {
    if (t.minQty <= quantity) best = t;
  }
  return best;
}

/**
 * Cart/checkout upsell: given a cart item (from GET /api/cart), find the nearest
 * not-yet-reached quantity tier whose projected per-unit price is strictly CHEAPER
 * than what the user currently pays (item.price). Projection uses the user's real
 * base price (individual_price ?? original_price) so it matches backend pricing
 * (tiers stack on top of the individual/base price, never the raw catalog price).
 * Returns { minQty, need, type, value, percent, unitPrice } or null.
 */
export function getCartUpsell(item) {
  if (!item || !item.discount_active) return null;
  if (item.discount_until) {
    const until = new Date(item.discount_until);
    if (isNaN(until.getTime()) || until.getTime() <= Date.now()) return null;
  }
  const tiers = (Array.isArray(item.discount_tiers) ? item.discount_tiers : [])
    .filter(t => t && t.min_qty != null && Number(t.value) > 0)
    .sort((a, b) => Number(a.min_qty) - Number(b.min_qty));
  if (!tiers.length) return null;

  const base = item.individual_price != null ? Number(item.individual_price) : Number(item.original_price) || 0;
  const qty = Number(item.quantity) || 0;
  const current = Number(item.price) || 0;

  const apply = (b, type, val) => {
    val = Number(val) || 0;
    if (val <= 0) return b;
    if (type === 'percent') return Math.max(0, b * (1 - Math.min(99, val) / 100));
    if (type === 'amount') return Math.max(0, b - val);
    return b;
  };

  for (const t of tiers) {
    if (Number(t.min_qty) <= qty) continue;
    const unit = apply(base, t.type, t.value);
    if (unit < current - 0.01) {
      const minQty = Number(t.min_qty);
      const percent = t.type === 'percent'
        ? Math.round(Number(t.value))
        : (base > 0 ? Math.round(((base - unit) / base) * 100) : 0);
      return {
        minQty,
        need: minQty - qty,
        type: t.type,
        value: Number(t.value),
        percent,
        unitPrice: Math.round(unit * 100) / 100,
      };
    }
  }
  return null;
}

/**
 * Compute whether the "Новинки" badge should be shown.
 * Returns { active, until } or null.
 */
export function computeNewBadge(product) {
  if (!product || product.is_new !== true) return null;
  if (product.new_until) {
    const until = new Date(product.new_until);
    if (isNaN(until.getTime()) || until.getTime() <= Date.now()) return null;
    return { active: true, until: product.new_until };
  }
  return { active: true, until: null };
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
