import cron from 'node-cron';
import { processDueEnrollments } from '../services/sequence-engine.js';

let cronTask: cron.ScheduledTask | null = null;

export function startSequenceCron() {
  if (cronTask) return;

  // Run every 30 seconds for responsive sequence delivery during demos
  cronTask = cron.schedule('*/30 * * * * *', async () => {
    try {
      const result = await processDueEnrollments();
      if (result.sent > 0 || result.completed > 0) {
        console.log(`[Sequence Cron] Processed ${result.processed} enrollments: ${result.sent} sent, ${result.completed} completed`);
      }
    } catch (error) {
      console.error('[Sequence Cron] Error processing due enrollments:', error);
    }
  });

  console.log('⏰ Sequence Engine cron job started (runs every 30s)');
}

export function stopSequenceCron() {
  if (cronTask) {
    cronTask.stop();
    cronTask = null;
  }
}
