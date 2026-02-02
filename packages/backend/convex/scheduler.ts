import { internalAction, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

export const queryPendingQueue = internalQuery({
  args: { limit: v.number() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("crawler_queue")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .take(args.limit);
  },
});

export const updateQueueItemFailed = internalMutation({
  args: {
    queueId: v.id("crawler_queue"),
    failureReason: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.queueId, {
      status: "failed",
      lastAttempt: Date.now(),
      failureReason: args.failureReason,
    });
  },
});

export const crawlScheduler = internalAction({
  args: {
    crawlerWorkerUrl: v.string(),
    youtubeApiKey: v.string(),
    numDiscoveryCreators: v.number(),
    numCrawlsPerRun: v.number(),
  },
  handler: async (ctx, args) => {
    const results = {
      discovered: 0,
      crawled: 0,
      failed: 0,
    };

    // 1. Run discovery job to find new creators
    try {
      console.log("Starting discovery job...");
      const discoveryResult = await ctx.runAction(internal.discovery.runDiscoveryJob, {
        youtubeApiKey: args.youtubeApiKey,
        numCreators: args.numDiscoveryCreators,
      });
      results.discovered = discoveryResult.discovered;
      console.log(`Discovery completed: ${discoveryResult.discovered} new creators found`);
    } catch (error) {
      console.error("Discovery job failed:", error);
    }

    // 2. Get pending items from queue
    console.log(`Fetching up to ${args.numCrawlsPerRun} pending crawls...`);
    const pendingItems = await ctx.runQuery(internal.scheduler.queryPendingQueue, {
      limit: args.numCrawlsPerRun,
    });

    console.log(`Found ${pendingItems.length} pending items`);

    // 3. Crawl each pending item
    for (const item of pendingItems) {
      try {
        console.log(`Crawling handle: ${item.handle}`);
        const crawlerUrl = new URL(args.crawlerWorkerUrl);
        crawlerUrl.searchParams.set("handle", item.handle);
        crawlerUrl.searchParams.set("queueId", item._id);

        const response = await fetch(crawlerUrl.toString(), {
          method: "GET",
        });

        if (response.ok) {
          results.crawled++;
          console.log(`✓ Successfully crawled ${item.handle}`);
        } else {
          results.failed++;
          const errorText = await response.text();
          console.error(`✗ Failed to crawl ${item.handle}: ${response.status} ${errorText}`);

          // Mark as failed in queue
          try {
            await ctx.runMutation(internal.scheduler.updateQueueItemFailed, {
              queueId: item._id,
              failureReason: `HTTP ${response.status}: ${errorText}`,
            });
          } catch {
            // Continue
          }
        }
      } catch (error: any) {
        results.failed++;
        console.error(`✗ Error crawling ${item.handle}:`, error.message);

        // Mark as failed in queue
        try {
          await ctx.runMutation(internal.scheduler.updateQueueItemFailed, {
            queueId: item._id,
            failureReason: error.message,
          });
        } catch {
          // Continue
        }
      }
    }

    console.log(`Scheduler complete:`, results);
    return results;
  },
});