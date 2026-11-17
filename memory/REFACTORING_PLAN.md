# План рефакторинга AVOPT.STORE

## Текущее состояние
- `server.py`: 4136 строк — основные роутеры вынесены
- `AdminPage.js`: 4907 строк — создана базовая структура компонентов

## Бэкенд: Созданные файлы

### Готово ✅
- `/app/backend/database.py` — подключение к БД, JWT, авторизация (~55 строк)
- `/app/backend/models.py` — все Pydantic модели (~280 строк)
- `/app/backend/routes/__init__.py` — объединение роутеров (~25 строк)
- `/app/backend/routes/auth.py` — аутентификация (~160 строк)
- `/app/backend/routes/products.py` — продукты и категории (~175 строк)
- `/app/backend/routes/orders.py` — корзина, заказы, избранное (~310 строк)
- `/app/backend/routes/admin.py` — администрирование пользователей/заказов (~280 строк)
- `/app/backend/routes/settings.py` — настройки скидок, платежей, баннера (~160 строк)
- `/app/backend/routes/news.py` — новости CRUD (~65 строк)
- `/app/backend/routes/chat.py` — чат и сообщения (~200 строк)
- `/app/backend/routes/bonus.py` — бонусная программа (~320 строк)

### Требуется ⏳
- Интеграция новых роутеров в server.py и удаление дублирующего кода
- `/app/backend/routes/payments.py` — крипто
- `/app/backend/routes/import_export.py` — импорт/экспорт товаров

## Фронтенд: Созданные файлы

### Готово ✅
- `/app/frontend/src/components/admin/ProductsTab.js` — вкладка товаров (~90 строк)
- `/app/frontend/src/components/admin/CategoriesTab.js` — вкладка категорий (~60 строк)
- `/app/frontend/src/components/admin/OrdersTab.js` — вкладка заказов (~160 строк)
- `/app/frontend/src/components/admin/UsersTab.js` — вкладка пользователей (~140 строк)
- `/app/frontend/src/components/admin/NewsTab.js` — вкладка новостей (~180 строк)
- `/app/frontend/src/components/admin/index.js` — экспорт компонентов

### Требуется ⏳
- `/app/frontend/src/components/admin/ChatTab.js`
- `/app/frontend/src/components/admin/BonusTab.js`
- `/app/frontend/src/components/admin/DiscountsTab.js`
- `/app/frontend/src/components/admin/ImportTab.js`
- `/app/frontend/src/components/admin/StatisticsTab.js`
- `/app/frontend/src/components/admin/TelegramTab.js`
- `/app/frontend/src/components/admin/PartnersTab.js`
- Интеграция компонентов в AdminPage.js

## Прогресс рефакторинга

### Бэкенд: ~70% готово
Созданы все основные роутеры. Осталось:
1. Роутер платежей (крипто)
2. Роутер импорта/экспорта
3. Интеграция в server.py

### Фронтенд: ~40% готово
Созданы компоненты для 5 из 13 вкладок. Осталось:
1. Создать оставшиеся 8 компонентов
2. Интегрировать в AdminPage.js

## Примечания
- Новые файлы роутеров готовы к использованию
- Старый код в server.py и AdminPage.js остаётся рабочим
- API протестировано и работает
