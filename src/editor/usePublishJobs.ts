import { useEffect, useState } from "react";
import { publishJobQueue, type PublishJob } from "./publishJobQueue";

export function usePublishJobs(): PublishJob[] {
  const [jobs, setJobs] = useState<PublishJob[]>(() => publishJobQueue.getJobs());
  useEffect(() => publishJobQueue.subscribe(() => setJobs(publishJobQueue.getJobs())), []);
  return jobs;
}

export function useProjectPublishJob(projectId: string): PublishJob | undefined {
  const jobs = usePublishJobs();
  const forProject = jobs.filter((j) => j.projectId === projectId);
  return forProject.find((j) => j.status === "running") ?? forProject[0];
}
