# Магазин грузовых автозапчастей - PRD

## Проблема
Создание интернет-магазина грузовых автозапчастей с каталогом, корзиной, оформлением заказов и личным кабинетом.

## Архитектура
- **Frontend**: React + Tailwind CSS + Shadcn UI
- **Backend**: FastAPI + MongoDB
- **Auth**: JWT tokens (bcrypt для паролей)

## Реализованный функционал

### v1.0 - MVP (16.01.2025)
- ✅ Главная страница с hero-секцией и 6 брендами
- ✅ Каталог товаров в виде списка с модальными окнами
- ✅ Поиск по названию и артикулу
- ✅ Регистрация и авторизация пользователей
- ✅ Корзина (добавление, изменение количества, удаление)
- ✅ Оформление заказа (ФИО, адрес, телефон)
- ✅ Личный кабинет с историей заказов
- ✅ Административная панель
- ✅ Рекламный баннер с кастомизацией

### v2.0 - Расширение функционала (17.01.2025)
- ✅ **Популярные товары** — секция на главной странице
- ✅ **Сопутствующие товары** — блок в модальном окне товара
- ✅ **Избранное** — возможность сохранять товары в список желаний
- ✅ **Расширенная статистика** — графики продаж, топ товаров, топ клиентов
- ✅ **Импорт товаров из CSV** — массовая загрузка товаров
- ✅ **Экспорт товаров в CSV** — выгрузка каталога
- ✅ **Telegram уведомления** — оповещения о новых заказах
- ✅ **Встроенный онлайн-чат** — общение клиентов с поддержкой

### v3.0 - Фаза 1 расширенного админ-функционала (26.01.2025)
- ✅ **/api/health endpoint** — для деплоя на Kubernetes
- ✅ **Полное управление пользователями** — CRUD в админке с отображением пароля
- ✅ **Полное управление заказами** — редактирование и удаление заказов без перезагрузки
- ✅ **Кросс-номера для товаров** — поле cross_articles в форме редактирования
- ✅ **Расширенный поиск** — разделение на "Точное совпадение" и "Возможные замены"

## Структура проекта
```
/app
├── backend/
│   ├── .env
│   ├── requirements.txt
│   ├── server.py          # FastAPI app, all API endpoints
│   └── uploads/           # User-uploaded images
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── ChatWidget.js      # Виджет онлайн-чата
    │   │   ├── FavoritesButton.js # Кнопка добавления в избранное
    │   │   ├── Header.js
    │   │   ├── PopularProducts.js # Секция популярных товаров
    │   │   ├── ProductCard.js
    │   │   ├── PromoBanner.js
    │   │   ├── RelatedProducts.js # Сопутствующие товары
    │   │   └── ui/
    │   ├── context/
    │   │   ├── AuthContext.js
    │   │   └── CartContext.js
    │   └── pages/
    │       ├── AccountPage.js
    │       ├── AdminPage.js       # + Статистика, Чаты, Telegram, Импорт
    │       ├── CartPage.js
    │       ├── CatalogPage.js     # + Избранное, Сопутствующие
    │       ├── CheckoutPage.js
    │       ├── FavoritesPage.js   # Страница избранного
    │       ├── HomePage.js        # + Популярные товары
    │       ├── LoginPage.js
    │       └── RegisterPage.js
```

## API Endpoints

### Аутентификация
- POST /api/auth/register
- POST /api/auth/login
- GET /api/auth/me

### Товары
- GET /api/products
- GET /api/products/popular
- GET /api/products/{id}
- GET /api/products/{id}/related
- POST /api/products (admin)
- PUT /api/products/{id} (admin)
- DELETE /api/products/{id} (admin)

### Категории
- GET /api/categories
- POST /api/categories (admin)
- PUT /api/categories/{id} (admin)
- DELETE /api/categories/{id} (admin)

### Корзина
- GET /api/cart
- POST /api/cart/add
- POST /api/cart/update
- DELETE /api/cart/{product_id}
- DELETE /api/cart

### Заказы
- GET /api/orders
- POST /api/orders
- GET /api/orders/{id}

### Избранное
- GET /api/favorites
- POST /api/favorites/add
- DELETE /api/favorites/{product_id}
- GET /api/favorites/check/{product_id}

### Чат
- GET /api/chat/messages
- POST /api/chat/send
- GET /api/chat/unread-count
- POST /api/chat/mark-read

### Администрирование
- GET /api/health — health check для K8s
- GET /api/admin/stats
- GET /api/admin/stats/extended
- **GET /api/admin/users** — список пользователей с password_plain
- **POST /api/admin/users** — создание пользователя
- **PUT /api/admin/users/{id}** — редактирование пользователя
- **DELETE /api/admin/users/{id}** — удаление пользователя
- GET /api/admin/orders
- **PUT /api/admin/orders/{id}** — редактирование заказа
- PUT /api/admin/orders/{id}/status
- **DELETE /api/admin/orders/{id}** — удаление заказа
- GET /api/admin/chats
- GET /api/admin/chats/{id}/messages
- POST /api/admin/chats/{id}/send
- GET /api/admin/telegram-settings
- PUT /api/admin/telegram-settings
- POST /api/admin/telegram-test
- POST /api/admin/products/import
- GET /api/admin/products/export

### Товары (расширено)
- **GET /api/products/search-with-alternatives** — поиск с кросс-номерами

### Прочее
- GET /api/promo-banner
- PUT /api/promo-banner (admin)
- POST /api/upload (admin)
- POST /api/seed

## Учётные данные
- **Admin**: admin@avarus.ru / admin123
- **Test User**: test_user_features@test.com / testpass123

## Backlog (P0 - Фаза 2-5)
### Фаза 2 - Админ-панель и Real-time
- Все действия в админке обновляют UI без перезагрузки
- Расширенная статистика с детальной информацией по товарам и пользователям
- Мультифото для товаров со слайдшоу

### Фаза 3 - Чат и Telegram
- Отдельный Telegram бот для чата
- Двусторонняя связь админа через Telegram
- Загрузка медиафайлов в чат, эмодзи
- Управление чатами: закрепление, метки, удаление

### Фаза 4 - Главная страница и профиль
- Редактируемый блок партнёров на главной
- Фото профиля для пользователей и админов
- Расширенная статистика заказов для пользователей

### Фаза 5 - Бонусная программа
- Прогресс-бар для накопления бонусов (5% от заказа → цель 5000₽)
- История бонусов в профиле
- Управление бонусной программой в админке

## Backlog (P1)
- Уведомления о наличии товаров
- Калькулятор доставки по регионам
- Email уведомления о заказах

## Backlog (P2)
- Интеграция с 1С
- Фильтр по марке/модели грузовика
- Отзывы о товарах
