import {
  ClipboardList, MessageCircle, ShoppingCart, RefreshCw, CreditCard, Wallet, Package, Warehouse, Upload, Users, UserCog, Gift,
  Tag, Megaphone, Newspaper, Mail, Image, LayoutDashboard, ToggleRight, Settings, ScrollText, User, Truck, Bell, Power, FileText,
} from 'lucide-react';

// counts: keys of GET /api/admin/attention summed into the badge; feature: hidden while that site function is off
export const ADMIN_PINNED = [
  { label: 'Заказы', to: '/admin/orders', icon: ClipboardList, counts: ['orders'], testid: 'admin-orders-link' },
  { label: 'Чаты', to: '/admin/chats', icon: MessageCircle, counts: ['chats', 'price_requests', 'product_requests'], feature: 'chat', testid: 'admin-chats-link', keywords: 'сообщения запросы скидки товара' },
];

export const ADMIN_GROUPS = [
  { id: 'sales', label: 'Продажи', items: [
    { label: 'Корзины клиентов', to: '/admin/carts', icon: ShoppingCart, feature: 'admin_carts' },
    { label: 'Возвраты', to: '/admin/returns', icon: RefreshCw, counts: ['returns'], feature: 'returns', keywords: 'гарантия' },
    { label: 'Отсрочка', to: '/admin/credit', icon: CreditCard, counts: ['credit_requests'], feature: 'credit', keywords: 'кредит лимит долг' },
    { label: 'Платежи', to: '/admin?tab=payments', icon: Wallet, keywords: 'оплата предоплата крипто способы' },
  ] },
  { id: 'catalog', label: 'Каталог', items: [
    { label: 'Товары и категории', to: '/admin?tab=products', icon: Package, keywords: 'каталог цены' },
    { label: 'Склад', to: '/admin?tab=warehouse', icon: Warehouse, keywords: 'остатки приход регионы' },
    { label: 'Импорт товаров', to: '/admin?tab=settings&sub=import', icon: Upload, keywords: 'csv загрузка прайс' },
  ] },
  { id: 'clients', label: 'Клиенты', items: [
    { label: 'Клиенты (CRM)', to: '/admin?tab=crm', icon: Users, keywords: 'пользователи статусы' },
    { label: 'Сотрудники', to: '/admin/staff', icon: UserCog, counts: ['conditions_requests'], feature: 'managers', keywords: 'менеджеры комиссия выплаты' },
    { label: 'Бонусы', to: '/admin?tab=bonus', icon: Gift, counts: ['cashback_withdrawals', 'prize_redemptions'], feature: 'rewards', keywords: 'баллы кэшбэк ozon сертификаты призы' },
  ] },
  { id: 'marketing', label: 'Маркетинг', items: [
    { label: 'Скидки и акции', to: '/admin?tab=promotions', icon: Tag, counts: ['cart_discounts'], keywords: 'промокоды баннер' },
    { label: 'Новости', to: '/admin?tab=marketing&sub=news', icon: Newspaper, feature: 'news' },
    { label: 'Рассылки', to: '/admin?tab=marketing&sub=newsletters', icon: Mail, keywords: 'email письма' },
    { label: 'Акции и баннер', to: '/admin?tab=marketing&sub=promo', icon: Megaphone },
    { label: 'Партнёры', to: '/admin?tab=settings&sub=partners', icon: Image, keywords: 'логотипы' },
  ] },
  { id: 'system', label: 'Система', items: [
    { label: 'Обзор', to: '/admin?tab=overview', icon: LayoutDashboard, keywords: 'статистика аналитика требует внимания' },
    { label: 'Функционал сайта', to: '/admin/features', icon: ToggleRight, testid: 'admin-features-link', keywords: 'включить отключить функции' },
    { label: 'Настройки', to: '/admin?tab=settings', icon: Settings },
    { label: 'Логи', to: '/admin?tab=logs', icon: ScrollText, keywords: 'журнал действий' },
    { label: 'Профиль', to: '/admin/profile', icon: User, testid: 'admin-profile-link' },
  ] },
];

// extra destinations reachable only through the search
export const ADMIN_SEARCH_EXTRA = [
  { label: 'Настройки · Доставка', to: '/admin?tab=settings&sub=delivery', icon: Truck },
  { label: 'Настройки · Telegram', to: '/admin?tab=settings&sub=telegram', icon: Settings },
  { label: 'Настройки · Уведомления', to: '/admin?tab=settings&sub=notifications', icon: Bell },
  { label: 'Настройки · Техработы', to: '/admin?tab=settings&sub=maintenance', icon: Power },
  { label: 'Настройки · Футер', to: '/admin?tab=settings&sub=footer', icon: Settings },
  { label: 'Настройки · Правила', to: '/admin?tab=settings&sub=terms', icon: FileText },
  { label: 'Настройки · Реквизиты счёта', to: '/admin?tab=settings&sub=invoice', icon: FileText },
  { label: 'Настройки · Условия по статусам', to: '/admin?tab=settings&sub=conditions', icon: FileText, keywords: 'розница опт' },
  { label: 'Настройки · Подбор запчастей', to: '/admin?tab=settings&sub=parts_finder', icon: Settings },
  { label: 'Уведомления администратора', to: '/admin/notifications', icon: Bell },
];

export const ATTENTION_ITEMS = [
  { key: 'orders', label: 'Новые заказы', to: '/admin/orders' },
  { key: 'chats', label: 'Чаты без ответа', to: '/admin/chats' },
  { key: 'returns', label: 'Заявки на возврат', to: '/admin/returns' },
  { key: 'price_requests', label: 'Запросы индивидуальной цены', to: '/admin/chats' },
  { key: 'product_requests', label: 'Запросы товара', to: '/admin/chats' },
  { key: 'cart_discounts', label: 'Запросы скидки на корзину', to: '/admin?tab=promotions' },
  { key: 'credit_requests', label: 'Заявки на отсрочку', to: '/admin/credit' },
  { key: 'conditions_requests', label: 'Заявки на смену условий', to: '/admin/staff' },
  { key: 'cashback_withdrawals', label: 'Вывод кэшбэка', to: '/admin?tab=bonus' },
  { key: 'prize_redemptions', label: 'Заявки на призы', to: '/admin?tab=bonus' },
];

export const sumCounts = (counts, keys = []) => keys.reduce((s, k) => s + (counts?.[k] || 0), 0);

export const isNavActive = (location, to) => {
  const [path, query] = to.split('?');
  if (location.pathname !== path) return false;
  if (!query) return path !== '/admin' || !new URLSearchParams(location.search).get('tab');
  const want = new URLSearchParams(query);
  const have = new URLSearchParams(location.search);
  if ((have.get('tab') || 'overview') !== want.get('tab')) return false;
  return !want.get('sub') || have.get('sub') === want.get('sub');
};
