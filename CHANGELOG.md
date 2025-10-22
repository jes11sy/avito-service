# Changelog - Avito Service

## [2.0.0] - Expansion Release

### ✨ New Features

#### Avito Accounts Management
- Added full CRUD for Avito accounts
- Account credentials management (Client ID, Client Secret, User ID)
- Connection status tracking
- Statistics synchronization (balance, ads, views, contacts)

#### Avito API Integration
- Complete Avito API client implementation
- Access token management with auto-refresh
- Account information retrieval
- Balance checking
- Ads statistics (views, contacts, favorites)
- Health check for API connectivity

#### Proxy Support
- Multi-protocol proxy support: HTTP, HTTPS, SOCKS4, SOCKS5
- Per-account proxy configuration
- Proxy authentication support
- Proxy health checks
- Separate status tracking for API and proxy

#### Eternal Online Feature
- Automatic online status maintenance
- Configurable keep-alive interval (60-3600 seconds)
- Cron-based automatic online status updates (every 5 minutes)
- Per-account enable/disable control
- Manual online status trigger
- Online status tracking in database

#### Avito Messenger API
- Direct integration with Avito Messenger API
- Get chats from Avito API
- Get chat messages
- Send messages to chats
- Mark messages as read
- Set online status manually

### 🔧 Technical Improvements

- Added `@nestjs/schedule` for cron jobs
- Added `axios` for HTTP requests
- Added `https-proxy-agent` for HTTP/HTTPS proxy
- Added `socks-proxy-agent` for SOCKS proxy
- Enhanced Prisma schema with `AvitoAccount` model
- Renamed `Avito` model to `AvitoChat` for clarity
- Added account-chat relationships
- Added comprehensive statistics fields
- Improved error handling and logging

### 📦 Database Changes

#### New Tables
- `avito_account` - Avito API accounts with credentials and settings

#### Modified Tables
- `avito` → `avito_chat` - Renamed for clarity
- Added `account_id` field to link chats with accounts
- Added `@map` directives for all fields (snake_case in DB)

### 🎯 API Endpoints

#### New Account Endpoints
- `GET /api/v1/accounts` - List all accounts
- `GET /api/v1/accounts/:id` - Get account details
- `POST /api/v1/accounts` - Create account
- `PUT /api/v1/accounts/:id` - Update account
- `DELETE /api/v1/accounts/:id` - Delete account
- `POST /api/v1/accounts/:id/check-connection` - Check API/proxy
- `POST /api/v1/accounts/:id/sync-stats` - Sync statistics

#### New Messenger Endpoints
- `GET /api/v1/messenger/accounts/:accountId/chats` - Get chats
- `GET /api/v1/messenger/accounts/:accountId/chats/:chatId/messages` - Get messages
- `POST /api/v1/messenger/accounts/:accountId/chats/:chatId/send` - Send message
- `POST /api/v1/messenger/accounts/:accountId/chats/:chatId/messages/:messageId/read` - Mark as read
- `POST /api/v1/messenger/accounts/:accountId/status/online` - Set online

#### New Eternal Online Endpoints
- `POST /api/v1/eternal-online/accounts/:accountId/enable` - Enable eternal online
- `POST /api/v1/eternal-online/accounts/:accountId/disable` - Disable eternal online
- `POST /api/v1/eternal-online/accounts/:accountId/set-online` - Manual online trigger

### 📝 Documentation

- Updated README.md with full feature list
- Added DEPLOYMENT.md with deployment guide
- Added Kubernetes manifests examples
- Added proxy configuration examples
- Added troubleshooting guide

### 🔐 Security

- JWT authentication for all endpoints
- Role-based access control (RBAC)
- Secure credential storage in database
- Proxy authentication support

---

## [1.0.0] - Initial Release

### Features
- Basic Avito chats management
- Chat messages storage
- Webhook integration for incoming messages
- Search by phone number
- Chat status management

