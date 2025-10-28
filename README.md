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

### Accounts Management

#### Аккаунты
- `GET /api/v1/accounts` - Получить все аккаунты
- `GET /api/v1/accounts/:id` - Получить аккаунт по ID
- `POST /api/v1/accounts` - Создать аккаунт
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
CORS_ORIGIN=https://admin.test-shem.ru,https://callcentre.test-shem.ru

# Optional
NODE_ENV=production
```

## Пример создания аккаунта

```bash
curl -X POST https://api.test-shem.ru/api/v1/accounts \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Мой аккаунт Avito",
    "clientId": "YOUR_CLIENT_ID",
    "clientSecret": "YOUR_CLIENT_SECRET",
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



