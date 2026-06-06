# Вариант 2: SPA — Single Page Application с REST API

## Структура файлов
```
spa-template/
├── index.html             ← Единая точка входа (чистый HTML)
├── css/
│   └── style.css          ← Тёмный премиальный дизайн, CSS-переменные :root
├── js/
│   └── app.js             ← Вся клиентская логика (роутинг, CRUD, валидация)
└── api/                   ← PHP-бэкенд (только JSON API)
    ├── db.php             ← PDO + CSRF + session + JSON-утилиты
    ├── auth.php           ← POST → логин
    ├── register.php       ← POST → регистрация
    ├── get_user_info.php  ← GET → данные сессии + CSRF-токен
    ├── services.php       ← GET → список услуг из БД
    ├── requests.php       ← GET/POST/PUT → CRUD заявок
    └── logout.php         ← GET → выход
```

## Концепция
Лендинг-страница с формами входа/регистрации. После авторизации — переход на дашборд с боковым меню, статистикой и CRUD заявок. Ни одна страница **не перезагружается** — всё через JS.

## Развертывание (XAMPP)
1. Запустите Apache + MySQL.
2. Создайте БД `exam_project`, импортируйте `schema.sql` из корня.
3. Откройте `http://localhost/шаблон/spa-template/`.

## Тестовые аккаунты
| Роль     | Логин   | Пароль    |
|----------|---------|-----------|
| Админ    | admin   | Admin123  |
| Клиент   | client1 | Client123 |

<<<<<<< HEAD
Данные администратора меняются в `schema.sql` в блоке `INSERT INTO users`: первая строка с ролью `admin`.

=======
>>>>>>> a955f3f563dc387e0cc0a2d11eacf79ce229a404
## Безопасность
| Вектор | Защита |
|--------|--------|
| SQL Injection | PDO `prepare()` на 100% запросов |
| XSS | `sanitize()` в JS экранирует весь вывод из БД |
| CSRF | Токен через заголовок `X-CSRF-Token`, проверка `csrf_api_check()` |
| Сессии | `HttpOnly`, `SameSite=Strict`, `session_regenerate_id()` при логине |
| Пароли | `password_hash()` / `password_verify()`, валидация мин. 8 символов + буквы + цифры |

## Масштабирование
1. Измените записи в таблицах `categories`/`services` в phpMyAdmin.
2. Смените палитру в `:root` переменных `css/style.css`.
3. Для новых полей: добавьте `<input>` в `index.html` → обработайте в `js/app.js` → добавьте в `api/requests.php`.
