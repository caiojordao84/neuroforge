import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { router } from './api/routes';
import { setupWebSocket } from './api/websocket';

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

// Routes
app.use('/api', router);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Setup WebSocket
setupWebSocket(httpServer);

// Start server
httpServer.listen(PORT, () => {
  console.log(`✅ NeuroForge Backend running on http://localhost:${PORT}`);
  console.log(`📡 WebSocket server ready`);
  console.log(`🔧 API available at http://localhost:${PORT}/api`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  httpServer.close(() => {
    console.log('HTTP server closed');
  });
});
