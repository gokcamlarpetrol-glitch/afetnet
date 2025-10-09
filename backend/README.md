# AfetNet Backend API

Professional, scalable backend for AfetNet disaster management application.

## 🚀 Features

- ✅ **RESTful API** - Express.js + TypeScript
- ✅ **Real-time Communication** - Socket.IO for live updates
- ✅ **Database** - PostgreSQL + Prisma ORM
- ✅ **Authentication** - JWT + AFN-ID system
- ✅ **Push Notifications** - Firebase Cloud Messaging
- ✅ **Payment Processing** - Stripe integration
- ✅ **Earthquake Monitoring** - AFAD + USGS APIs
- ✅ **BLE Mesh Relay** - Offline message relay
- ✅ **Docker Support** - Easy deployment

## 📋 Prerequisites

- Node.js 20+
- PostgreSQL 16+
- npm or yarn

## 🛠️ Installation

### 1. Clone and Install

```bash
cd backend
npm install
```

### 2. Environment Setup

```bash
cp .env.example .env
# Edit .env with your configuration
```

### 3. Database Setup

```bash
# Generate Prisma client
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# (Optional) Open Prisma Studio
npm run prisma:studio
```

### 4. Start Development Server

```bash
npm run dev
```

Server will start on `http://localhost:3000`

## 🐳 Docker Deployment

### Using Docker Compose

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Using Docker only

```bash
# Build image
docker build -t afetnet-backend .

# Run container
docker run -p 3000:3000 \
  -e DATABASE_URL="your_database_url" \
  -e JWT_SECRET="your_jwt_secret" \
  afetnet-backend
```

## 📡 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `POST /api/auth/fcm-token` - Register FCM token

### Users
- `GET /api/users/me` - Get current user
- `PUT /api/users/me` - Update user profile

### Family
- `GET /api/family` - Get family members
- `POST /api/family` - Add family member
- `DELETE /api/family/:id` - Remove family member

### Messages
- `GET /api/messages` - Get messages
- `POST /api/messages` - Send message

### SOS
- `GET /api/sos` - Get active SOS alerts
- `POST /api/sos` - Create SOS alert
- `PUT /api/sos/:id/resolve` - Resolve SOS alert

### Earthquakes
- `GET /api/earthquakes` - Get earthquakes
- `GET /api/earthquakes/:id` - Get earthquake details

### Payments
- `POST /api/payments/create-payment-intent` - Create payment
- `POST /api/payments/webhook` - Stripe webhook

### Mesh
- `POST /api/mesh/relay` - Relay mesh message
- `GET /api/mesh/messages` - Get mesh messages

## 🔌 WebSocket Events

### Client → Server
- `location:update` - Update user location
- `message:send` - Send message
- `sos:send` - Send SOS alert
- `mesh:relay` - Relay mesh message
- `typing:start` - Start typing indicator
- `typing:stop` - Stop typing indicator

### Server → Client
- `family:location` - Family member location update
- `message:received` - New message received
- `message:sent` - Message sent confirmation
- `sos:alert` - New SOS alert
- `mesh:message` - Mesh message received
- `typing:indicator` - Typing indicator

## 🔧 Configuration

### Environment Variables

```env
# Server
PORT=3000
NODE_ENV=development

# Database
DATABASE_URL="postgresql://user:password@localhost:5432/afetnet"

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d

# Firebase (Push Notifications)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-client-email
FIREBASE_PRIVATE_KEY="your-private-key"

# Stripe
STRIPE_SECRET_KEY=sk_test_your_key
STRIPE_WEBHOOK_SECRET=whsec_your_secret

# APIs
AFAD_API_URL=https://deprem.afad.gov.tr/EventService/GetEventsByFilter
USGS_API_URL=https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson

# CORS
CORS_ORIGIN=*
```

## 📊 Database Schema

The database includes the following models:
- User
- FcmToken
- FamilyMember
- Message
- SosAlert
- LocationHistory
- Earthquake
- Payment
- MeshMessage
- Analytics

See `prisma/schema.prisma` for full schema.

## 🔄 Background Jobs

- **Earthquake Monitoring** - Runs every 1 minute
- **Mesh Message Cleanup** - Runs every 5 minutes

## 🚀 Deployment

### Railway

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Deploy
railway up
```

### Render

1. Connect GitHub repository
2. Set environment variables
3. Deploy

### Heroku

```bash
# Login
heroku login

# Create app
heroku create afetnet-backend

# Add PostgreSQL
heroku addons:create heroku-postgresql:mini

# Deploy
git push heroku main
```

## 📝 License

MIT

## 👥 Support

For issues and questions, please open an issue on GitHub.

