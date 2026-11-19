import { app } from './app.js';
import { env } from './config/env.js';
import { startSequenceCron } from './cron/sequence-runner.js';

const server = app.listen(env.PORT, () => {
  console.log(`🚀 ReachFlow API running on http://localhost:${env.PORT}`);
  console.log(`📡 Health Check: http://localhost:${env.PORT}/health`);
  console.log(`🔐 Environment: ${env.NODE_ENV}`);

  // Start background sequence engine
  startSequenceCron();
});

export { server };
