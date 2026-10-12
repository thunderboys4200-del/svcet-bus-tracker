# SVCET Smart College Bus Tracking System

A full-stack, real-time campus fleet transit management and live GPS bus tracking platform developed for Sri Venkateswara College of Engineering and Technology (SVCET).

---

## 1. System Architecture

```
                  ┌────────────────────────────────────────┐
                  │             Web Frontend               │
                  │   React 19 + TypeScript + Vite         │
                  │   Leaflet + OpenStreetMap Map Engine   │
                  │   Socket.IO Client (Real-Time Events)  │
                  └───────────────────┬────────────────────┘
                                      │
               HTTP / REST API        │ WebSocket (ws://)
             (port 4000, CORS)        │ Real-time bus telemetry
                                      │
                  ┌───────────────────▼────────────────────┐
                  │            Backend API Server          │
                  │   Node.js + Express 5 + TypeScript     │
                  │   Socket.IO Server (Rooms & Broadcast) │
                  │   JWT Authentication & RBAC Middleware │
                  │   Rate Limiter & Helmet Security       │
                  └───────────────────┬────────────────────┘
                                      │
                               Mongoose 9.x
                                      │
                  ┌───────────────────▼────────────────────┐
                  │          Database Storage              │
                  │   MongoDB Atlas Cloud Database         │
                  │   Collections: users, buses, routes,   │
                  │                stops, trips            │
                  └────────────────────────────────────────┘
```

---

## 2. Key Features Implemented

### 🎓 Student Portal
- **Real-Time Live Map**: Interactive OpenStreetMap rendered with Leaflet displaying current bus location, custom bus markers, heading, and accuracy radius rings.
- **Bus & Route Selection**: Interactive selector to switch between active buses in the campus fleet.
- **Route Stop Sequence**: Complete visual timeline with stop numbers, names, and geographic coordinates.
- **Realistic ETA Engine**: Calculates realistic road travel time (~24 km/h campus/suburban speed with road tortuosity factor) and automatically handles stale GPS signals.
- **Instant WebSocket Updates**: Automatically updates coordinates via Socket.IO without manual refresh.
- **Public & Authenticated Tracking**: Secure read-only endpoints preventing leak of driver passwords or private administrative records.

### 🚌 Driver Workspace
- **Assigned Vehicle & Route**: Instantly shows driver's assigned bus (`BUS-001`) and route (`SVCET Main Gate Route`).
- **One-Click Trip Controls**: Safe "Start Trip" with duplicate prevention and "End Trip" with confirmation protection.
- **Device GPS Streaming**: Uses browser Geolocation API (`navigator.geolocation.watchPosition`) with high accuracy enabled to stream real-time driver coordinates to the backend.
- **Live Telemetry & Diagnostics**: Real-time display of speed (km/h), accuracy (±m), transmission counts, and active trip duration timer.
- **Transmission Controls**: Pause and resume GPS location sharing safely.

### 🛡️ Administrator Console
- **Fleet Statistics**: Live counts of total buses, routes, stops, authorized drivers, and currently active trips.
- **Bus Management**: Full CRUD operations for fleet vehicles, capacity management, and driver/route assignment.
- **Driver Management**: Register drivers with secure bcrypt passwords, activate/deactivate accounts, and manage assignments.
- **Route & Stop Management**: Create geographic stops with latitude/longitude and assemble sequenced routes.
- **Live Fleet Monitor**: Overview of all buses currently in service with real-time telemetry.

---

## 3. Pre-Configured Test Accounts

Seed the database anytime using `npm run seed` in `apps/api`:

| Role | College ID | Password | Access Level |
|---|---|---|---|
| **Student** | `STUDENT001` | `Student@123456` | Live bus tracking, route stops, ETA |
| **Driver** | `DRIVER001` | `Driver@123456` | Start/end trips, broadcast GPS, view assigned bus |
| **Admin** | `ADMIN001` | `Admin@123456` | Manage buses, drivers, routes, stops, fleet stats |

*The login page also provides 1-click **Quick Fill** buttons for immediate testing.*

---

## 4. Getting Started

### Prerequisites
- Node.js 20+ or 22+ LTS
- npm 10+
- Internet connection (for MongoDB Atlas and OpenStreetMap tiles)

### 1. Backend Setup
```bash
cd apps/api

# Install dependencies (if not already installed)
npm install

# Configure environment variables
# Copy .env.example to .env and configure MONGODB_URI and JWT_SECRET
cp .env.example .env

# Seed initial test records (Admin, Driver, Student, Bus, Route, Stops)
npm run seed

# Run the API server in development mode (port 4000)
npm run dev

# Run automated integration test suite (54 test assertions)
npm run test

# Build for production
npm run build
```

### 2. Frontend Setup
```bash
cd apps/web

# Install dependencies (if not already installed)
npm install

# Configure environment variables
cp .env.example .env

# Run Vite development server (port 5173)
npm run dev

# Build for production
npm run build
```

---

## 5. Environment Variables Specification

### Backend (`apps/api/.env`)
```ini
PORT=4000
CORS_ORIGINS=http://localhost:5173
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/<database>?retryWrites=true&w=majority
JWT_SECRET=your_secure_random_jwt_secret_at_least_32_characters_long
```

### Frontend (`apps/web/.env`)
```ini
VITE_API_BASE_URL=http://localhost:4000
```

---

## 6. API Endpoints Reference

### Public & Student Endpoints
- `GET /api/health` — Service health and MongoDB/Socket.IO status
- `POST /api/auth/login` — Authenticate and receive JWT token
- `POST /api/auth/register-student` — Student self-registration
- `GET /api/auth/me` — Verify token and get current user profile
- `GET /api/trips/buses` — Public fleet summary (safe, no credentials leaked)
- `GET /api/trips/routes` — Active routes with sequenced stops
- `GET /api/trips/active` — List of all currently active trips
- `GET /api/trips/bus/:busId/tracking` — Live tracking coordinates, route, and status for a bus

### Driver Endpoints (Requires `Bearer <token>` with `driver` role)
- `GET /api/trips/driver/assigned` — Driver's assigned bus and route
- `GET /api/trips/driver/active` — Driver's current active trip
- `POST /api/trips/start` — Start an assigned trip (body: `{ "busId": "..." }`)
- `POST /api/trips/:tripId/location` — Push GPS update (body: `{ latitude, longitude, accuracy, speed, heading, recordedAt }`)
- `POST /api/trips/:tripId/end` — Conclude active trip
- `GET /api/trips/history` — Historical trips

### Administrator Endpoints (Requires `Bearer <token>` with `admin` role)
- `GET /api/admin/dashboard` — Fleet statistics (buses, routes, stops, drivers, students, active trips)
- `GET /api/admin/buses` — List all buses
- `POST /api/admin/buses` — Create a bus
- `PUT /api/admin/buses/:busId` — Update bus details
- `DELETE /api/admin/buses/:busId` — Delete a bus
- `POST /api/admin/buses/:busId/assign` — Assign route and driver to bus
- `GET /api/admin/stops` — List all stops
- `POST /api/admin/stops` — Create stop with lat/lng
- `PUT /api/admin/stops/:stopId` — Update stop
- `DELETE /api/admin/stops/:stopId` — Delete stop
- `GET /api/admin/routes` — List all routes with stops
- `POST /api/admin/routes` — Create route
- `PUT /api/admin/routes/:routeId` — Update route
- `DELETE /api/admin/routes/:routeId` — Delete route
- `GET /api/admin/drivers` — List driver accounts
- `POST /api/admin/drivers` — Create driver account
- `PUT /api/admin/drivers/:driverId/status` — Toggle active status
- `DELETE /api/admin/drivers/:driverId` — Delete driver account
- `GET /api/admin/trips/active` — Real-time active trips monitor

---

## 7. Geolocation & HTTPS Production Note

Modern mobile browsers (Chrome, Safari, Firefox) restrict the Geolocation API (`navigator.geolocation`) to **secure contexts (HTTPS)**.
- For local development on desktop/emulator, `http://localhost` is treated as a trusted secure origin.
- When deploying to production for mobile drivers, ensure the frontend is served over **HTTPS** with a valid SSL/TLS certificate.
