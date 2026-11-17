import express from 'express';

const router = express.Router();

// Health check endpoint - used by frontend to monitor backend connectivity
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

export default router;
