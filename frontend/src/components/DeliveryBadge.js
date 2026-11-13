import { Truck } from 'lucide-react';
import { useRegion } from '../context/RegionContext';

// Region-based delivery badge. stockRegions = list of regions where the product is in stock.
export const DeliveryBadge = ({ stockRegions, productId, size = 'sm', showDate = true }) => {
  const { computeDelivery } = useRegion();
  const info = computeDelivery(stockRegions);
  const pad = size === 'lg' ? 'px-3 py-1.5 text-sm' : 'px-2 py-0.5 text-[11px]';
  return (
    <span
      className={`inline-flex items-center gap-1.5 font-semibold rounded-md border ${pad}`}
      style={{ color: info.color, borderColor: info.color + '55', backgroundColor: info.color + '14' }}
      data-testid={productId ? `delivery-badge-${productId}` : 'delivery-badge'}
      title={`${info.label}${showDate && info.dateText ? ` · ${info.dateText}` : ''}`}
    >
      <Truck className={size === 'lg' ? 'w-4 h-4' : 'w-3 h-3'} />
      <span>{info.label}</span>
      {showDate && info.dateText && <span className="opacity-80 font-bold">· {info.dateText}</span>}
    </span>
  );
};

export default DeliveryBadge;
