# Kubernetes Deployment - OAuth Update

## 🚀 Деплой обновленного сервиса с OAuth

### Шаг 1: Обновить секреты

Отредактируйте `k8s/secrets/avito-service-secrets.yaml`:

```yaml
AVITO_OAUTH_CLIENT_ID: "ваш_client_id_от_avito"
AVITO_OAUTH_CLIENT_SECRET: "ваш_client_secret_от_avito"
AVITO_OAUTH_REDIRECT_URI: "https://api.lead-shem.ru/api/v1/oauth/avito/callback"
AVITO_OAUTH_SCOPES: "messenger:read,messenger:write,user:read,items:info,stats:read,user_balance:read"
```

Примените секреты:

```bash
kubectl apply -f k8s/secrets/avito-service-secrets.yaml
```

### Шаг 2: Обновить deployment (уже готово)

Deployment уже обновлен и подтягивает OAuth переменные из секретов.

### Шаг 3: Пересобрать и задеплоить образ

```bash
cd api-services/avito-service

# Собрать новый образ
docker build -t jes11sy/avito-service:latest .

# Запушить в registry
docker push jes11sy/avito-service:latest

# Перезапустить deployment
kubectl rollout restart deployment/avito-service -n backend

# Проверить статус
kubectl rollout status deployment/avito-service -n backend

# Проверить логи
kubectl logs -f deployment/avito-service -n backend
```

### Шаг 4: Проверить работу

```bash
# Проверить что поды запустились
kubectl get pods -n backend | grep avito

# Проверить переменные окружения
kubectl exec -it deployment/avito-service -n backend -- env | grep AVITO

# Проверить health
curl https://api.lead-shem.ru/api/v1/accounts/health
```

### Шаг 5: Протестировать OAuth

1. Создайте тестовый аккаунт:
```bash
curl -X POST https://api.lead-shem.ru/api/v1/accounts \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test OAuth", "userId": "12345"}'
```

2. Откройте в браузере:
```
https://api.lead-shem.ru/api/v1/oauth/avito/authorize/1
```

3. Подтвердите доступ на Avito

4. Проверьте что токены сохранились:
```bash
curl https://api.lead-shem.ru/api/v1/accounts/1 \
  -H "Authorization: Bearer YOUR_JWT"
```

Должны увидеть длинные токены в `clientId` и `clientSecret`.

---

## 🔧 Troubleshooting

### Проблема: Pods не запускаются

```bash
# Проверить события
kubectl describe pod -l app=avito-service -n backend

# Проверить логи
kubectl logs -l app=avito-service -n backend --tail=100
```

### Проблема: OAuth configuration missing

```bash
# Проверить что секреты применены
kubectl get secret avito-service-secrets -n backend -o yaml

# Проверить переменные в поде
kubectl exec -it deployment/avito-service -n backend -- env | grep AVITO
```

### Проблема: Invalid redirect_uri

Убедитесь что в настройках приложения на Avito указан правильный Redirect URI:
```
https://api.lead-shem.ru/api/v1/oauth/avito/callback
```

---

## 📋 Checklist

- [ ] Зарегистрировано приложение на https://developers.avito.ru/applications
- [ ] Получены CLIENT_ID и CLIENT_SECRET
- [ ] Обновлен `k8s/secrets/avito-service-secrets.yaml`
- [ ] Применены секреты: `kubectl apply -f k8s/secrets/avito-service-secrets.yaml`
- [ ] Собран новый Docker образ
- [ ] Запушен в registry
- [ ] Перезапущен deployment: `kubectl rollout restart deployment/avito-service -n backend`
- [ ] Проверены логи
- [ ] Протестирован OAuth flow
- [ ] Мигрированы существующие аккаунты

---

## 🎯 Быстрый деплой (одной командой)

```bash
# Из корня проекта
cd api-services/avito-service && \
docker build -t jes11sy/avito-service:latest . && \
docker push jes11sy/avito-service:latest && \
cd ../.. && \
kubectl apply -f k8s/secrets/avito-service-secrets.yaml && \
kubectl rollout restart deployment/avito-service -n backend && \
kubectl rollout status deployment/avito-service -n backend && \
echo "✅ Deployment completed!"
```

---

## 📊 Мониторинг

```bash
# Логи в реальном времени
kubectl logs -f deployment/avito-service -n backend

# Статус подов
watch kubectl get pods -n backend | grep avito

# Метрики
kubectl top pod -l app=avito-service -n backend
```

---

**Готово! 🎉**

