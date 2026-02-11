# План рефакторинга AVOPT.STORE

## Текущее состояние
- `server.py`: 4136 строк — требует разбиения на роутеры
- `AdminPage.js`: 4907 строк — требует разбиения на компоненты

## Бэкенд: Созданные файлы

### Готово ✅
- `/app/backend/database.py` — подключение к БД, JWT, авторизация
- `/app/backend/models.py` — все Pydantic модели
- `/app/backend/routes/__init__.py` — объединение роутеров
- `/app/backend/routes/auth.py` — аутентификация
- `/app/backend/routes/products.py` — продукты и категории
- `/app/backend/routes/orders.py` — корзина, заказы, избранное

### Требуется ⏳
- `/app/backend/routes/admin.py` — администрирование пользователей, заказов
- `/app/backend/routes/chat.py` — чат и сообщения
- `/app/backend/routes/bonus.py` — бонусная программа
- `/app/backend/routes/payments.py` — платежи (ЮKassa, крипто)
- `/app/backend/routes/settings.py` — настройки (баннер, скидки, telegram)
- `/app/backend/routes/news.py` — новости
- `/app/backend/routes/import_export.py` — импорт/экспорт товаров
- `/app/backend/routes/statistics.py` — аналитика

## Фронтенд: Созданные файлы

### Готово ✅
- Все страницы в `/app/frontend/src/pages/`
- Компоненты в `/app/frontend/src/components/`

### Требуется ⏳ (для AdminPage.js)
- `/app/frontend/src/components/admin/ProductsTab.js`
- `/app/frontend/src/components/admin/CategoriesTab.js`
- `/app/frontend/src/components/admin/OrdersTab.js`
- `/app/frontend/src/components/admin/UsersTab.js`
- `/app/frontend/src/components/admin/ChatTab.js`
- `/app/frontend/src/components/admin/BonusTab.js`
- `/app/frontend/src/components/admin/DiscountsTab.js`
- `/app/frontend/src/components/admin/NewsTab.js`
- `/app/frontend/src/components/admin/ImportTab.js`
- `/app/frontend/src/components/admin/StatisticsTab.js`
- `/app/frontend/src/components/admin/TelegramTab.js`
- `/app/frontend/src/components/admin/PartnersTab.js`

## Приоритеты

1. **P0 (Критично)**: Бэкенд роутеры для основных функций (admin, chat, bonus)
2. **P1 (Важно)**: Фронтенд компоненты для админки
3. **P2 (Желательно)**: Оптимизация, документация, тесты

## Примечания

- Рефакторинг должен быть постепенным, чтобы не сломать работающую систему
- Каждый новый файл должен быть протестирован перед коммитом
- Старый код в server.py и AdminPage.js остаётся рабочим как fallback
