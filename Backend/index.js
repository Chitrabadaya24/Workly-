const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
require('dotenv').config();

const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');
const setupSocket = require('./sockets/socketHandler');
const { ensureUploadDirs } = require('./config/uploads');
const { startScheduler } = require('./jobs/scheduler');

// Route imports
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const meetingRoutes = require('./routes/meetings');
const messageRoutes = require('./routes/messages');
const availabilityRoutes = require('./routes/availability');
const notificationRoutes = require('./routes/notifications');
const meetRoutes = require('./routes/meet');
const codeoRoutes = require('./routes/codeo');
const taskRoutes = require('./routes/tasks');
const auditRoutes = require('./routes/audit');
const teamRoutes = require('./routes/teams');
const chatRoutes = require('./routes/chat');

const app = express();
const server = http.createServer(app);

// Socket.io setup
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Make io accessible to route handlers
app.set('io', io);

// Connect to MongoDB
connectDB();
ensureUploadDirs();

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Executive Productivity Platform API is running 🚀' });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/availability', availabilityRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/meet', meetRoutes);
app.use('/api/codeo', codeoRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/chat', chatRoutes);


// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Error handler (must be last)
app.use(errorHandler);

// Setup Socket.io
setupSocket(io);
startScheduler(app);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
});
