import app from './app';

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`==============================================`);
  console.log(`  Legal TimeLock Network (LTN) Backend API    `);
  console.log(`  Running on: http://localhost:${PORT}/v1     `);
  console.log(`  Uptime start: ${new Date().toISOString()}  `);
  console.log(`==============================================`);
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server...');
  server.close(() => {
    console.log('HTTP server closed.');
  });
});
