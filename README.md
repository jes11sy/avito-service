# Avito Service

Микросервис для полной интеграции с Avito API и Avito Messenger.

## Функционал

### 1. **Avito Accounts Management**
- CRUD операции для аккаунтов Avito
- Управление credentials (Client ID, Client Secret)
- Настройка прокси (HTTP/HTTPS/SOCKS4/SOCKS5)
- Проверка подключения к API и прокси
- Синхронизация статистики аккаунтов

### 2. **Avito API Integration**
- Получение access token
- Информация об аккаунте
- Баланс аккаунта
- Статистика объявлений (просмотры, контакты)
- Health check

### 3. **Avito Messenger**
- Получение списка чатов через API
- Получение истории сообщений
- Отправка сообщений в чаты
- Отметка сообщений как прочитанные
- Установка статуса "онлайн"

### 4. **Eternal Online ("Вечный онлайн")**
- Автоматическое поддержание онлайн статуса
- Настраиваемый интервал проверки (60-3600 секунд)
- Cron задачи для всех активных аккаунтов
- Мониторинг статуса онлайн

### 5. **Avito Chats Database**
- Хранение чатов и сообщений в БД
- Фильтрация по статусам, городам, телефонам
- Связь чатов с аккаунтами
- История переписки

### 6. **Webhook Integration**
- Прием вебхуков от Avito Messenger
- Автоматическое сохранение новых чатов
- Сохранение истории сообщений
- Обработка событий `chat.new` и `message.new`

## API Endpoints

### OAuth Authorization

- `GET /api/v1/auth/avito/authorize/:accountId` - Начать OAuth авторизацию (редирект на Avito)
- `GET /api/v1/auth/avito/callback` - Callback от Avito (автоматически обрабатывается)
- `GET /api/v1/auth/avito/refresh/:accountId` - Обновить токен вручную

### Accounts Management

#### Аккаунты
- `GET /api/v1/accounts` - Получить все аккаунты
- `GET /api/v1/accounts/:id` - Получить аккаунт по ID
- `POST /api/v1/accounts` - Создать аккаунт (без токенов, OAuth потом)
- `PUT /api/v1/accounts/:id` - Обновить аккаунт
- `DELETE /api/v1/accounts/:id` - Удалить аккаунт

#### Проверки
- `POST /api/v1/accounts/:id/check-connection` - Проверить API и прокси
- `POST /api/v1/accounts/:id/sync-stats` - Синхронизировать статистику

### Avito Messenger API

#### Чаты через API
- `GET /api/v1/messenger/accounts/:accountId/chats` - Получить чаты
- `GET /api/v1/messenger/accounts/:accountId/chats/:chatId/messages` - Сообщения чата
- `POST /api/v1/messenger/accounts/:accountId/chats/:chatId/send` - Отправить сообщение
- `POST /api/v1/messenger/accounts/:accountId/chats/:chatId/messages/:messageId/read` - Отметить как прочитанное
- `POST /api/v1/messenger/accounts/:accountId/status/online` - Установить онлайн

### Eternal Online

- `POST /api/v1/eternal-online/accounts/:accountId/enable` - Включить "вечный онлайн"
- `POST /api/v1/eternal-online/accounts/:accountId/disable` - Выключить "вечный онлайн"
- `POST /api/v1/eternal-online/accounts/:accountId/set-online` - Установить онлайн вручную

### Avito Chats (Database)

- `GET /api/v1/avito/chats` - Получить все чаты из БД
- `GET /api/v1/avito/chats/:chatId` - Получить чат с сообщениями
- `GET /api/v1/avito/chats/:chatId/messages` - Получить сообщения чата
- `GET /api/v1/avito/chats/by-phone/:phone` - Чаты по номеру телефона
- `POST /api/v1/avito/chats` - Создать чат вручную
- `PUT /api/v1/avito/chats/:chatId` - Обновить чат

### Webhook

- `POST /api/v1/webhooks/avito` - Вебхук от Avito Messenger (основной)
- Совместимость: `POST /api/v1/webhook/avito` также принимается (alias)

## Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:pass@host:port/db

# Auth
JWT_SECRET=your-secret-key

# Server
PORT=5004
CORS_ORIGIN=https://test-shem.ru,https://callcentre.test-shem.ru

# Avito OAuth (required)
AVITO_OAUTH_CLIENT_ID=
AVITO_OAUTH_CLIENT_SECRET=
AVITO_OAUTH_REDIRECT_URI=
AVITO_OAUTH_SCOPES=messenger:read,messenger:write,user:read,items:info,stats:read

# Optional
NODE_ENV=production
```

## OAuth Авторизация (обязательно)

### Шаг 1: Регистрация приложения на Avito

1. Перейдите на https://developers.avito.ru/applications
2. Зарегистрируйте приложение:
   - **Имя приложения**: Ваше название
   - **Redirect URI**: `https://api.lead-shem.ru/api/v1/auth/avito/callback`
   - **Scopes**: `messenger:read,messenger:write,user:read,items:info,stats:read,user_balance:read`
   - **Описание**: Для чего используется приложение
3. Получите `CLIENT_ID` и `CLIENT_SECRET`
4. Добавьте их в `.env`:

```env
AVITO_OAUTH_CLIENT_ID=your_client_id
AVITO_OAUTH_CLIENT_SECRET=your_client_secret
AVITO_OAUTH_REDIRECT_URI=https://api.lead-shem.ru/api/v1/oauth/avito/callback
```

### Шаг 2: Создание аккаунта

Создайте аккаунт **без** `clientId` и `clientSecret` (они заполнятся после OAuth):

```bash
curl -X POST https://api.lead-shem.ru/api/v1/accounts \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Мой аккаунт Avito",
    "userId": "12345",
    "proxyType": "http",
    "proxyHost": "proxy.example.com",
    "proxyPort": 8080,
    "proxyLogin": "user",
    "proxyPassword": "pass",
    "eternalOnlineEnabled": true,
    "onlineKeepAliveInterval": 300
  }'
```

**Ответ:**
```json
{
  "id": 1,
  "name": "Мой аккаунт Avito",
  "clientId": null,
  "clientSecret": null,
  ...
}
```

### Шаг 3: OAuth авторизация

Перейдите по ссылке для авторизации аккаунта:

```
https://api.lead-shem.ru/api/v1/auth/avito/authorize/1
```

Где `1` - это ID созданного аккаунта.

**Что происходит:**
1. Вы будете перенаправлены на Avito
2. Авторизуетесь и подтверждаете доступ
3. Avito перенаправит обратно на ваш сервер
4. Токены автоматически сохранятся в аккаунт
5. Вы будете перенаправлены на фронтенд с результатом

### Шаг 4: Проверка

После OAuth аккаунт будет содержать токены:

```json
{
  "id": 1,
  "name": "Мой аккаунт Avito",
  "clientId": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...", // access_token
  "clientSecret": "def50200a1b2c3d4e5f6...", // refresh_token
  "connectionStatus": "connected"
}
```

### Обновление токена

Токены автоматически обновляются при запросах к API. Для ручного обновления:

```bash
curl https://api.lead-shem.ru/api/v1/auth/avito/refresh/1
```

## Proxy Configuration

Поддерживаемые типы прокси:
- `http` - HTTP прокси
- `https` - HTTPS прокси
- `socks4` - SOCKS4 прокси
- `socks5` - SOCKS5 прокси

Прокси настраивается для каждого аккаунта отдельно.

## Eternal Online

"Вечный онлайн" работает через Cron задачи:
- Запускается каждые 5 минут
- Проверяет все аккаунты с `eternalOnlineEnabled: true`
- Устанавливает статус "онлайн" через Avito API
- Учитывает `onlineKeepAliveInterval` для каждого аккаунта

## Avito Webhook Configuration

**URL для вебхуков:** `https://api.test-shem.ru/api/v1/webhook/avito`

**Поддерживаемые события:**
- `chat.new` - новый чат
- `message.new` - новое сообщение

## Docker

```bash
docker build -t avito-service .
docker run -p 5004:5004 \
  -e DATABASE_URL="postgresql://..." \
  -e JWT_SECRET="your-secret" \
  avito-service
```

## Swagger Documentation

После запуска сервиса документация доступна по адресу:
`http://localhost:5004/api/docs`



