# OAuth Quick Start Guide

## 🚀 Быстрый старт за 5 минут

### 1️⃣ Регистрация приложения (один раз)

Перейдите на https://developers.avito.ru/applications и зарегистрируйте приложение:

```
Имя: Lead Schem CRM
Redirect URI: https://api.lead-shem.ru/api/v1/oauth/avito/callback
Scopes: messenger:read,messenger:write,user:read,items:info,stats:read,user_balance:read
```

Получите `CLIENT_ID` и `CLIENT_SECRET`.

### 2️⃣ Настройка сервера

Добавьте в `.env`:

```env
AVITO_OAUTH_CLIENT_ID=ваш_client_id
AVITO_OAUTH_CLIENT_SECRET=ваш_client_secret
AVITO_OAUTH_REDIRECT_URI=https://api.lead-shem.ru/api/v1/oauth/avito/callback
AVITO_OAUTH_SCOPES=messenger:read,messenger:write,user:read,items:info,stats:read
```

Перезапустите сервис:

```bash
docker-compose restart avito-service
# или
kubectl rollout restart deployment/avito-service
```

### 3️⃣ Создание аккаунта

```bash
curl -X POST https://api.lead-shem.ru/api/v1/accounts \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d '{"name": "Мой Avito", "userId": "12345"}'
```

Ответ: `{ "id": 1, ... }`

### 4️⃣ OAuth авторизация

Откройте в браузере:

```
https://api.lead-shem.ru/api/v1/oauth/avito/authorize/1
```

Подтвердите доступ на Avito → готово! ✅

### 5️⃣ Проверка

```bash
curl -X POST https://api.lead-shem.ru/api/v1/accounts/1/check-connection \
  -H "Authorization: Bearer YOUR_JWT"
```

Ожидаемый результат: `"connectionStatus": "connected"`

---

## 📋 Redirect URI для разных окружений

### Production
```
https://api.lead-shem.ru/api/v1/oauth/avito/callback
```

### Staging
```
https://api.test-shem.ru/api/v1/oauth/avito/callback
```

### Local (для тестирования)
```
http://localhost:5004/api/v1/oauth/avito/callback
```

⚠️ **Важно:** Avito требует HTTPS для production. Для локальной разработки можно использовать ngrok:

```bash
ngrok http 5004
# Используйте https://xxx.ngrok.io/api/v1/oauth/avito/callback
```

---

## 🔄 Обновление токена

Автоматически при каждом запросе к API.

Вручную (для тестирования):

```bash
curl https://api.lead-shem.ru/api/v1/oauth/avito/refresh/1
```

---

## 🎨 Интеграция с фронтендом

### React/Vue/Angular

```javascript
// Кнопка подключения
<button onClick={() => {
  window.location.href = `https://api.lead-shem.ru/api/v1/oauth/avito/authorize/${accountId}`;
}}>
  Подключить Avito
</button>

// Проверка результата после редиректа
const params = new URLSearchParams(window.location.search);
if (params.get('oauth') === 'success') {
  alert('Аккаунт подключен!');
}
```

---

## ❓ FAQ

**Q: Где хранятся токены?**  
A: В БД, в полях `clientId` (access_token) и `clientSecret` (refresh_token)

**Q: Как часто обновлять токены?**  
A: Автоматически! Сервис сам обновляет при необходимости.

**Q: Что делать если токен истек?**  
A: Заново пройти OAuth: `/oauth/avito/authorize/:accountId`

**Q: Можно ли использовать старые API ключи?**  
A: Нет, только OAuth.

---

## 🚨 Troubleshooting

| Ошибка | Решение |
|--------|---------|
| `OAuth configuration missing` | Проверьте `.env`, добавьте `AVITO_OAUTH_*` переменные |
| `Invalid redirect_uri` | Проверьте настройки приложения на Avito |
| `Access token not found` | Пройдите OAuth авторизацию |
| `Refresh token expired` | Заново пройдите OAuth (раз в год) |

---

## 📚 Полная документация

- **Миграция:** `OAUTH_MIGRATION.md`
- **API Reference:** `README.md`
- **Deployment:** `DEPLOYMENT.md`
- **Swagger:** `https://api.lead-shem.ru/api/docs`

---

**Готово! 🎉 Теперь ваш сервис работает с OAuth.**

