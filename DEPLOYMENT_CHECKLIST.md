# 🚀 Checklist для деплоя OAuth

## ✅ Что уже сделано (код готов)

- ✅ OAuth модуль реализован (`src/oauth/`)
- ✅ Удалена авторизация через `client_credentials`
- ✅ Обновлен `avito-api.service.ts`
- ✅ Документация создана (README, OAUTH_MIGRATION, OAUTH_QUICKSTART)
- ✅ Kubernetes секреты обновлены (`k8s/secrets/avito-service-secrets.yaml`)
- ✅ Kubernetes deployment обновлен (`k8s/deployments/avito-service.yaml`)

---

## 📋 Что нужно сделать вручную

### 1. Регистрация приложения на Avito ⏳

**URL:** https://developers.avito.ru/applications

**Данные для регистрации:**
```
Имя приложения: Lead Schem CRM
Redirect URI: https://api.lead-shem.ru/api/v1/oauth/avito/callback
Описание: Интеграция с CRM системой для управления объявлениями и мессенджером Avito

Scopes (выберите все нужные):
☑ messenger:read - Чтение сообщений
☑ messenger:write - Отправка сообщений
☑ user:read - Информация о пользователе
☑ user_balance:read - Баланс аккаунта
☑ items:info - Информация об объявлениях
☑ stats:read - Статистика
☑ autoload:reports - Отчеты автозагрузки
☑ items:apply_vas - Применение услуг
```

**Получите:**
- `CLIENT_ID` (например: `abc123def456`)
- `CLIENT_SECRET` (например: `secret_xyz789`)

⚠️ **Важно:** Avito регистрирует только доверенные приложения. Возможно потребуется связаться с поддержкой Avito.

---

### 2. Обновить секреты в Kubernetes ⏳

Отредактируйте файл: `k8s/secrets/avito-service-secrets.yaml`

Замените:
```yaml
AVITO_OAUTH_CLIENT_ID: "your_avito_oauth_client_id_here"
AVITO_OAUTH_CLIENT_SECRET: "your_avito_oauth_client_secret_here"
```

На реальные значения:
```yaml
AVITO_OAUTH_CLIENT_ID: "abc123def456"
AVITO_OAUTH_CLIENT_SECRET: "secret_xyz789"
```

Примените секреты:
```bash
kubectl apply -f k8s/secrets/avito-service-secrets.yaml
```

---

### 3. Деплой нового образа ⏳

```bash
# Перейти в папку сервиса
cd api-services/avito-service

# Собрать образ
docker build -t jes11sy/avito-service:latest .

# Запушить в registry
docker push jes11sy/avito-service:latest

# Перезапустить deployment
kubectl rollout restart deployment/avito-service -n backend

# Дождаться завершения
kubectl rollout status deployment/avito-service -n backend
```

---

### 4. Проверить работу ⏳

```bash
# Проверить логи
kubectl logs -f deployment/avito-service -n backend

# Проверить health
curl https://api.lead-shem.ru/api/v1/accounts/health

# Проверить что OAuth переменные загрузились
kubectl exec -it deployment/avito-service -n backend -- env | grep AVITO
```

Должны увидеть:
```
AVITO_OAUTH_CLIENT_ID=abc123def456
AVITO_OAUTH_CLIENT_SECRET=secret_xyz789
AVITO_OAUTH_REDIRECT_URI=https://api.lead-shem.ru/api/v1/oauth/avito/callback
AVITO_OAUTH_SCOPES=messenger:read,messenger:write,...
```

---

### 5. Протестировать OAuth flow ⏳

**5.1. Создать тестовый аккаунт:**
```bash
curl -X POST https://api.lead-shem.ru/api/v1/accounts \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test OAuth Account",
    "userId": "12345"
  }'
```

Ответ:
```json
{
  "id": 1,
  "name": "Test OAuth Account",
  "clientId": null,
  "clientSecret": null,
  "connectionStatus": "disconnected"
}
```

**5.2. Авторизовать через OAuth:**

Откройте в браузере:
```
https://api.lead-shem.ru/api/v1/oauth/avito/authorize/1
```

Вас перенаправит на Avito → авторизуйтесь → подтвердите доступ → вернет обратно.

**5.3. Проверить что токены сохранились:**
```bash
curl https://api.lead-shem.ru/api/v1/accounts/1 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

Ответ должен содержать длинные токены:
```json
{
  "id": 1,
  "clientId": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...", // access_token
  "clientSecret": "def50200a1b2c3d4e5f6...", // refresh_token
  "connectionStatus": "connected"
}
```

**5.4. Проверить подключение:**
```bash
curl -X POST https://api.lead-shem.ru/api/v1/accounts/1/check-connection \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

Ожидаемый результат:
```json
{
  "connectionStatus": "connected",
  "accountInfo": {
    "id": 12345,
    "name": "Иван Иванов",
    "email": "ivan@example.com"
  }
}
```

✅ **Если все работает - OAuth настроен правильно!**

---

### 6. Мигрировать существующие аккаунты ⏳

Для каждого существующего аккаунта:

**Вариант А: Обновить существующий аккаунт**
```bash
# 1. Очистить старые ключи
curl -X PUT https://api.lead-shem.ru/api/v1/accounts/{id} \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d '{"clientId": null, "clientSecret": null}'

# 2. Авторизовать через OAuth
# Откройте в браузере:
https://api.lead-shem.ru/api/v1/oauth/avito/authorize/{id}
```

**Вариант Б: Создать новые аккаунты**

Если аккаунтов мало, проще создать новые и удалить старые.

---

### 7. Обновить фронтенд (опционально) ⏳

Если нужно, добавьте кнопку "Подключить Avito" на фронтенде:

```typescript
// React пример
function ConnectAvitoButton({ accountId }: { accountId: number }) {
  const handleConnect = () => {
    window.location.href = `https://api.lead-shem.ru/api/v1/oauth/avito/authorize/${accountId}`;
  };

  return (
    <button onClick={handleConnect}>
      🔗 Подключить Avito
    </button>
  );
}

// Обработка результата после редиректа
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const oauth = params.get('oauth');
  
  if (oauth === 'success') {
    toast.success('Аккаунт успешно подключен!');
  } else if (oauth === 'error') {
    const message = params.get('message');
    toast.error(`Ошибка: ${message}`);
  }
}, []);
```

---

## 📊 Итоговый Checklist

### Подготовка
- [ ] Зарегистрировано приложение на https://developers.avito.ru/applications
- [ ] Получены CLIENT_ID и CLIENT_SECRET от Avito
- [ ] Обновлен файл `k8s/secrets/avito-service-secrets.yaml`
- [ ] Применены секреты: `kubectl apply -f k8s/secrets/avito-service-secrets.yaml`

### Деплой
- [ ] Собран Docker образ: `docker build -t jes11sy/avito-service:latest .`
- [ ] Запушен в registry: `docker push jes11sy/avito-service:latest`
- [ ] Перезапущен deployment: `kubectl rollout restart deployment/avito-service -n backend`
- [ ] Проверены логи: `kubectl logs -f deployment/avito-service -n backend`
- [ ] Проверен health: `curl https://api.lead-shem.ru/api/v1/accounts/health`

### Тестирование
- [ ] Создан тестовый аккаунт
- [ ] Пройден OAuth flow (авторизация через Avito)
- [ ] Проверено что токены сохранились
- [ ] Проверено подключение к Avito API
- [ ] Проверена работа мессенджера

### Миграция
- [ ] Мигрированы все существующие аккаунты
- [ ] Проверена работа всех аккаунтов
- [ ] Удалены старые аккаунты (если создавали новые)

### Фронтенд (опционально)
- [ ] Добавлена кнопка "Подключить Avito"
- [ ] Добавлена обработка результата OAuth
- [ ] Протестирован UI flow

---

## 🎯 Быстрые команды

### Деплой одной командой
```bash
cd api-services/avito-service && \
docker build -t jes11sy/avito-service:latest . && \
docker push jes11sy/avito-service:latest && \
cd ../.. && \
kubectl apply -f k8s/secrets/avito-service-secrets.yaml && \
kubectl rollout restart deployment/avito-service -n backend && \
kubectl rollout status deployment/avito-service -n backend
```

### Проверка статуса
```bash
kubectl get pods -n backend | grep avito && \
kubectl logs -f deployment/avito-service -n backend --tail=50
```

### Проверка переменных
```bash
kubectl exec -it deployment/avito-service -n backend -- env | grep AVITO
```

---

## 📞 Поддержка

**Документация:**
- `README.md` - Основная документация
- `OAUTH_MIGRATION.md` - Детальное руководство по миграции
- `OAUTH_QUICKSTART.md` - Быстрый старт
- `KUBERNETES_DEPLOY.md` - Инструкции по деплою в K8s

**Swagger:** https://api.lead-shem.ru/api/docs

**Логи:** `kubectl logs -f deployment/avito-service -n backend`

---

## ✅ Статус

- [x] Код готов
- [x] Документация готова
- [x] Kubernetes манифесты обновлены
- [ ] Приложение зарегистрировано на Avito
- [ ] Секреты обновлены с реальными credentials
- [ ] Сервис задеплоен
- [ ] OAuth протестирован
- [ ] Аккаунты мигрированы

**Следующий шаг:** Зарегистрировать приложение на https://developers.avito.ru/applications 🚀

