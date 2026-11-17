// Balance history row: state of a top-up request and the requisites issued by the administrator
export const TopupStatus = ({ tx }) => {
  if (tx.type !== 'topup' || tx.status === 'completed') return null;
  if (tx.status === 'failed') return <p className="text-xs font-semibold text-rose-500 mt-1" data-testid={`topup-status-${tx.id}`}>Заявка отклонена</p>;
  const r = tx.requisites;
  return (
    <div className="mt-1" data-testid={`topup-status-${tx.id}`}>
      <p className="text-xs font-semibold text-amber-600">
        {tx.method === 'card' && !r ? 'Ожидает выдачи реквизитов' : 'Ожидает подтверждения оплаты'}
      </p>
      {r && (
        <div className="mt-2 text-xs text-slate-600 space-y-0.5" data-testid={`topup-requisites-${tx.id}`}>
          {r.card_number && <p>Карта: <span className="font-mono font-semibold select-all">{r.card_number}</span></p>}
          {r.recipient_name && <p>Получатель: {r.recipient_name}</p>}
          {r.bank && <p>Банк: {r.bank}</p>}
          {r.comment && <p>Комментарий: {r.comment}</p>}
          {r.qr_url && <img src={r.qr_url} alt="QR-код для оплаты" className="w-28 h-28 rounded-lg border mt-1 object-cover" />}
        </div>
      )}
    </div>
  );
};
