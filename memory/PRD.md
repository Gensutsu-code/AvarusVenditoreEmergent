# Магазин грузовых автозапчастей — PRD

## Проблема
Интернет-магазин грузовых автозапчастей с каталогом, корзиной, оформлением заказов, системой скидок, бонусной программой и личным кабинетом.

## Архитектура
- **Frontend**: React + Tailwind CSS + Shadcn UI
- **Backend**: FastAPI + MongoDB
- **Auth**: JWT tokens
- **Media**: Cloudinary
- **Documents**: python-docx + ReportLab

## Реализованный функционал

### v1.0–v4.0 — MVP + Расширение
- Каталог, корзина, заказы, авторизация
- Админ-панель (CRUD товаров, категорий, заказов, пользователей)
- Промо-баннер, бонусная программа, онлайн-чат, Telegram-уведомления
- Аналитика, импорт/экспорт CSV, избранное

### v4.1 — Система скидок и статусов (11.02.2026)
- Статусы клиентов: Розница, Опт, Партнёр
- Скидки по статусам + индивидуальные скидки
- Динамические цены в каталоге (перечёркнутая + скидочная)
- Запросы на повышение статуса и индивидуальную скидку
- Пороги повышения статуса (редактируемые в админке)
- Админ-уведомления в шапке (колокольчик с badge)

### v4.2 — Документы, оплата, уведомления, новости (11.02.2026)
- **Документы**: Товарная накладная и чек (WORD + PDF) в модале заказа
- **Исправление наличия**: Списание при заказе, восстановление при отмене
- **Бонусы**: Исправлено начисление баллов при доставке
- **Скидки**: Запрошенная скидка прибавляется (не заменяет)
- **Призы**: Управление в админке (одобрить/выдать/отклонить)
- **Способы оплаты**: Наличные, карта, криптовалюта с выбором на чекауте
- **Скидки по оплате**: Настройка в админке, отображение при выборе
- **Клиентские уведомления**: Колокольчик в шапке (статусы заказов, скидки, призы)
- **Активность**: Логирование действий клиентов для админа
- **Новости**: CRUD в админке + страница /news для клиентов

## Структура проекта
```
/app/backend/
├── server.py                  # Main API
├── documents.py               # Invoice/receipt generation (DOCX/PDF)
├── cloudinary_service.py
└── requirements.txt
/app/frontend/src/
├── components/
│   ├── AdminNotifications.js  # Admin bell notifications
│   ├── ClientNotifications.js # Client bell notifications
│   ├── Header.js
│   ├── ChatWidget.js
│   └── ui/
├── context/
│   ├── AuthContext.js
│   └── CartContext.js
└── pages/
    ├── AdminPage.js           # Admin panel with all tabs
    ├── AccountPage.js         # User profile + requests
    ├── CatalogPage.js         # Dynamic pricing
    ├── CheckoutPage.js        # Payment method selection
    ├── NewsPage.js            # News/articles page
    └── ...
```

## Ключевые API
- POST /api/orders — создание заказа (списание наличия)
- GET /api/admin/orders/{id}/invoice/{docx|pdf} — товарная накладная
- GET /api/admin/orders/{id}/receipt/{docx|pdf} — чек
- GET/PUT /api/payment-settings — скидки по способу оплаты
- GET/POST/PUT/DELETE /api/admin/news — CRUD новостей
- GET /api/news — публичные новости
- GET /api/my-notifications — уведомления клиента
- GET /api/admin/activities — лог активности для админа
- GET /api/admin/notifications — счётчики уведомлений

## Учётные данные
- Admin: admin@avarus.ru / admin123
- Test User (Опт): TEST@MAIL.RU / admin123

## Backlog (P0) — Следующие задачи
- Интеграция ЮKassa для оплаты картами РФ банков
- Криптоплатёжная система с автоматической проверкой (MetaMask, ETH/BSC/TRC/Base)
- Полный рефакторинг и обновление дизайна

## Backlog (P1)
- Поиск по VIN/модели
- Email-уведомления о статусах
- Уведомления о брошенных корзинах

## Backlog (P2)
- Отзывы и рейтинги
- Калькулятор доставки
- "Недавно просмотренные"
