import { runAnalyzeAllJob } from '@/lib/jobs/analyzeAllWorker';

const globalQueue = globalThis as unknown as {
  __analyzeAllQueue?: string[];
  __analyzeAllProcessing?: boolean;
};

const queue = globalQueue.__analyzeAllQueue ?? [];
globalQueue.__analyzeAllQueue = queue;

async function processQueue() {
  if (globalQueue.__analyzeAllProcessing) return;
  globalQueue.__analyzeAllProcessing = true;

  try {
    while (queue.length > 0) {
      const jobId = queue.shift();
      if (!jobId) continue;
      await runAnalyzeAllJob(jobId);
    }
  } finally {
    globalQueue.__analyzeAllProcessing = false;
  }
}

export function enqueueAnalyzeAllJob(jobId: string) {
  queue.push(jobId);
  void processQueue();
}
