import { internal } from "./_generated/api";
import { cronJobs } from "convex/server";

const crons = cronJobs();

crons.interval(
  "crawl-scheduler",
  { minutes: 60 }, // Run every hour
  internal.scheduler.crawlScheduler,
  {
    crawlerWorkerUrl: process.env.CRAWLER_WORKER_URL || "https://sponsorspy-crawler.workers.dev",
    youtubeApiKey: process.env.YOUTUBE_API_KEY || "",
    numDiscoveryCreators: parseInt(process.env.NUM_DISCOVERY_CREATORS || "10"),
    numCrawlsPerRun: parseInt(process.env.NUM_CRAWLS_PER_RUN || "5"),
  }
);

export default crons;
