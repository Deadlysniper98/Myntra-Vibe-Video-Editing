import { useEffect, useState } from "react";
import { bulkUploadQueue, type BulkUploadJob } from "./bulkUploadQueue";

export function useBulkUploadQueue(): BulkUploadJob[] {
  const [jobs, setJobs] = useState<BulkUploadJob[]>(() => bulkUploadQueue.getJobs());
  useEffect(() => bulkUploadQueue.subscribe(() => setJobs(bulkUploadQueue.getJobs())), []);
  return jobs;
}

export function useBulkUploadSummary() {
  useBulkUploadQueue();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return bulkUploadQueue.getActiveSummary();
}

