# Executive Productivity Platform (EPP)

A full-stack MERN application for managing executive time, meeting requests, and async communication between employees and the CEO.

---

## 🚀 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite, Tailwind CSS, React Router v6 |
| State | React Context API |
| Real-time | Socket.io (client + server) |
| Calendar | FullCalendar |
| Charts | Recharts |
| Backend | Node.js, Express.js |
| Database | MongoDB + Mongoose |
| Auth | JWT + bcryptjs |

---

## 📁 Project Structure

```
executive-productivity-platform/
├── client/                  # Vite + React frontend
│   └── src/
│       ├── components/
│       │   ├── common/      # Badges, Modal, StatCard, PageHeader, LoadingSpinner
│       │   ├── messages/    # MessageThread (real-time chat)
│       │   └── notifications/ # NotificationBell (live updates)
│       ├── context/         # AuthContext (global auth state)
│       ├── layouts/         # SidebarLayout (shared dashboard shell)
│       ├── pages/
│       │   ├── auth/        # LoginPage
│       │   ├── admin/       # AdminDashboard, AdminHome, UsersPage, AnalyticsPage
│       │   ├── ceo/         # CEODashboard, CEOHome, CEORequestsPage, CEOCalendarPage, CEOMessagesPage
│       │   └── employee/    # EmployeeDashboard, EmployeeHome, NewRequestPage, MyRequestsPage, EmployeeMessagesPage
│       ├── services/        # Axios API client + all API service functions
│       └── socket/          # Socket.io client setup
│
└── server/                  # Express backend
    ├── config/              # MongoDB connection
    ├── controllers/         # auth, user, meeting, message, availability, notification
    ├── middleware/          # JWT protect, role authorize, error handler
    ├── models/              # User, MeetingRequest, Message, Notification, AvailabilityStatus
    ├── routes/              # All REST route definitions
    ├── sockets/             # Socket.io event handlers
    └── utils/               # DB seed script
```

---

## ⚙️ Setup Instructions

### Prerequisites
- Node.js 18+
- MongoDB Atlas account (or local MongoDB)

### 1. Clone / extract the project

### 2. Configure the backend

```bash
cd server
cp .env.example .env
```

Edit `.env`:
```
PORT=5000
MONGODB_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/epp
JWT_SECRET=change-this-to-a-long-random-string
JWT_EXPIRE=7d
CLIENT_URL=http://localhost:5173
NODE_ENV=development
```

### 3. Install & seed

```bash
# Install server dependencies
cd server
npm install

# Seed the admin user (run once)
node utils/seed.js

# Start the backend
npm run dev
```

### 4. Start the frontend

```bash
cd client
npm install
npm run dev
```

The app will be available at **http://localhost:5173**

---

## 🔑 Default Login

After seeding:

| Field | Value |
|---|---|
| Username | `admin` |
| Password | `admin123` |

> ⚠️ Change the admin password immediately after first login via your profile settings.

---

## 👥 User Roles & Workflow

### Admin
- Create users (CEO + Employees) — **only admins can create accounts**
- Assign roles, reset passwords, activate/deactivate accounts
- View platform analytics and meeting statistics
- Full user management with search + pagination

### CEO
- Live status switcher in the top bar:
  - **Available** — all requests accepted
  - **In Meeting** — requests queued
  - **Deep Work** — blocks non-emergency requests
  - **Emergency Only** — only emergency token requests bypass
- Review, approve, or reject meeting requests with comments
- Suggest async communication as alternative to meetings
- Mark meetings complete with summary + decision tracking
- Calendar view of all approved meetings + custom focus blocks
- Real-time thread messaging with any employee

### Employee
- Submit structured meeting requests (title, purpose, agenda, urgency, date/time)
- Track request history and approval status with live updates
- **Emergency Override Tokens** — 3 per employee, bypass CEO focus mode
- Real-time thread messaging attached to each request
- Live CEO status indicator in header

---

## ⚡ Real-Time Features (Socket.io)

| Event | Description |
|---|---|
| `new_notification` | Instant push when a request is approved/rejected |
| `new_message` | Live chat messages in meeting threads |
| `ceo_status_changed` | CEO availability broadcast to all employees |
| `user_typing` / `user_stop_typing` | Typing indicators in chat |

---

## 🗄️ MongoDB Collections

| Collection | Purpose |
|---|---|
| `users` | All platform users with roles and token counts |
| `meetingrequests` | Meeting requests with full lifecycle tracking |
| `messages` | Thread-based async messages per request |
| `notifications` | Per-user real-time notification inbox |
| `availabilitystatuses` | CEO status + focus block calendar data |

---

## 🔐 API Endpoints

### Auth
```
POST   /api/auth/login           Public — login, returns JWT
GET    /api/auth/me              Private — get current user
PUT    /api/auth/update-password Private — change own password
```

### Users (Admin only except profile)
```
GET    /api/users                List all users (admin)
POST   /api/users                Create user (admin)
GET    /api/users/:id            Get user (admin)
PUT    /api/users/:id            Update user (admin)
PUT    /api/users/:id/reset-password  Reset password (admin)
PUT    /api/users/:id/toggle-status   Activate/deactivate (admin)
DELETE /api/users/:id            Delete user (admin)
PUT    /api/users/profile        Update own profile (any)
```

### Meetings
```
POST   /api/meetings             Create request (employee)
GET    /api/meetings             All requests (ceo, admin)
GET    /api/meetings/my          Own requests (employee)
GET    /api/meetings/analytics   Stats (ceo, admin)
GET    /api/meetings/:id         Single request
PUT    /api/meetings/:id/approve Approve (ceo)
PUT    /api/meetings/:id/reject  Reject (ceo)
PUT    /api/meetings/:id/complete Mark complete with summary (ceo)
```

### Messages
```
GET    /api/messages/:requestId  Get thread messages
POST   /api/messages/:requestId  Send message
```

### Notifications
```
GET    /api/notifications        Get my notifications
PUT    /api/notifications/read-all  Mark all read
PUT    /api/notifications/:id/read  Mark one read
DELETE /api/notifications/:id    Delete notification
```

### Availability (CEO)
```
GET    /api/availability         Get CEO status
PUT    /api/availability         Update status (ceo)
POST   /api/availability/focus-block      Add focus block (ceo)
DELETE /api/availability/focus-block/:id  Remove focus block (ceo)
```

---

## 🌙 Dark Mode

Toggle via the sidebar button. Preference is saved to `localStorage`.

---

## 🚢 Production Deployment

### Backend
```bash
NODE_ENV=production npm start
```

### Frontend
```bash
npm run build
# Serve the dist/ folder with nginx or any static host
```

For Vercel / Render / Railway deployment, point:
- Backend: `server/` directory, start command `npm start`
- Frontend: `client/` directory, build command `npm run build`, output `dist/`

Set `VITE_SERVER_URL` in the client's environment variables to your backend URL.

---

## 📦 Key Dependencies

### Backend
- `express` — HTTP server
- `mongoose` — MongoDB ODM
- `jsonwebtoken` — JWT auth
- `bcryptjs` — password hashing
- `socket.io` — real-time events
- `express-validator` — input validation

### Frontend
- `react-router-dom` — client-side routing
- `axios` — HTTP client with interceptors
- `socket.io-client` — real-time connection
- `@fullcalendar/react` — calendar views
- `recharts` — analytics charts
- `react-hot-toast` — toast notifications
- `date-fns` — date formatting
- `tailwindcss` — utility CSS
