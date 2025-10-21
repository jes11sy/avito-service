# Avito Service

Микросервис для управления чатами Avito и интеграции с Avito Messenger.

## Функционал

### Avito Chats Management
- CRUD операции для чатов
- История сообщений
- Фильтрация по статусам, городам
- Поиск по номеру телефона

### Avito Webhook Integration
- Прием вебхуков от Avito Messenger
- Автоматическое сохранение новых чатов
- Сохранение истории сообщений
- Обработка входящих и исходящих сообщений

## API Endpoints

### Avito Chats
- `GET /api/v1/avito/chats` - Получить все чаты
- `GET /api/v1/avito/chats/:chatId` - Получить чат с сообщениями
- `GET /api/v1/avito/chats/:chatId/messages` - Получить сообщения чата
- `GET /api/v1/avito/chats/by-phone/:phone` - Чаты по номеру
- `POST /api/v1/avito/chats` - Создать чат вручную
- `PUT /api/v1/avito/chats/:chatId` - Обновить чат

### Webhook
- `POST /api/v1/webhook/avito` - Вебхук от Avito Messenger

## Environment Variables

```env
DATABASE_URL=postgresql://user:pass@host:port/db
JWT_SECRET=your-secret
PORT=5004
```

## Avito Webhook Configuration

**URL для вебхуков:** `https://api.test-shem.ru/api/v1/webhook/avito`

**Поддерживаемые события:**
- `chat.new` - новый чат
- `message.new` - новое сообщение

## Docker

```bash
docker build -t avito-service .
docker run -p 5004:5004 avito-service
```

