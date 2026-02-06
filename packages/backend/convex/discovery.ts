import { internalQuery, internalAction, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

// Helper to fetch from external YouTube API
async function discoverRelatedChannels(
  creatorHandle: string,
  apiKey: string,
): Promise<string[]> {
  try {
    const YOUTUBE_API_URL = "https://www.googleapis.com/youtube/v3";

    // Get channel ID from handle
    const channelSearchRes = await fetch(
      `${YOUTUBE_API_URL}/search?part=id&q=${encodeURIComponent(
        creatorHandle.startsWith("@") ? creatorHandle : `@${creatorHandle}`,
      )}&type=channel&maxResults=1&key=${apiKey}`,
    );

    if (!channelSearchRes.ok) {
      console.log(`Failed to find channel for ${creatorHandle}`);
      return [];
    }

    const channelData = (await channelSearchRes.json()) as any;
    const channelId = channelData.items?.[0]?.id?.channelId;

    if (!channelId) {
      console.log(`No channel ID found for ${creatorHandle}`);
      return [];
    }

    // Get recent videos
    const videosRes = await fetch(
      `${YOUTUBE_API_URL}/search?part=id&channelId=${channelId}&type=video&maxResults=5&key=${apiKey}`,
    );

    if (!videosRes.ok) {
      return [];
    }

    const videosData = (await videosRes.json()) as any;
    const videoIds = videosData.items?.map((item: any) => item.id.videoId) || [];

    if (videoIds.length === 0) {
      return [];
    }

    // Find related channels
    const relatedChannels = new Set<string>();

    for (const videoId of videoIds.slice(0, 3)) {
      try {
        const relatedRes = await fetch(
          `${YOUTUBE_API_URL}/search?part=snippet&relatedToVideoId=${videoId}&type=channel&maxResults=10&key=${apiKey}`,
        );

        if (!relatedRes.ok) continue;

        const relatedData = (await relatedRes.json()) as any;
        const channels = relatedData.items?.map((item: any) => item.snippet?.channelId) || [];

        for (const ch of channels) {
          if (ch && ch !== channelId) {
            relatedChannels.add(ch);
          }
        }

        if (relatedChannels.size >= 10) {
          break;
        }
      } catch {
        // Continue
      }
    }

    // Convert channel IDs to handles
    const handles: string[] = [];
    for (const chId of Array.from(relatedChannels).slice(0, 10)) {
      try {
        const chRes = await fetch(
          `${YOUTUBE_API_URL}/channels?part=snippet&id=${chId}&key=${apiKey}`,
        );

        if (!chRes.ok) continue;

        const chData = (await chRes.json()) as any;
        const channel = chData.items?.[0];

        if (channel?.snippet?.customUrl) {
          handles.push(channel.snippet.customUrl);
        }
      } catch {
        // Continue
      }
    }

    return handles;
  } catch (error) {
    console.error("Error discovering channels:", error);
    return [];
  }
}

export const queryCreatorsSample = internalQuery({
  args: { limit: v.number() },
  handler: async (ctx, args) => {
    return await ctx.db.query("creators").take(args.limit);
  },
});

export const queryCreatorByHandle = internalQuery({
  args: { handle: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("creators")
      .withIndex("by_youtubeHandle", (q) => q.eq("youtubeHandle", args.handle))
      .unique();
  },
});

export const queryQueueByHandle = internalQuery({
  args: { handle: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("crawler_queue")
      .withIndex("by_handle", (q) => q.eq("handle", args.handle))
      .unique();
  },
});

export const insertQueueItem = internalMutation({
  args: {
    handle: v.string(),
    discoveredFrom: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("crawler_queue", {
      handle: args.handle,
      status: "pending",
      discoveredFrom: args.discoveredFrom,
      addedAt: Date.now(),
    });
  },
});

export const runDiscoveryJob = internalAction({
  args: {
    youtubeApiKey: v.string(),
    numCreators: v.number(),
  },
  handler: async (ctx, args) => {
    // Get random crawled creators inline
    const creators = await ctx.runQuery(internal.discovery.queryCreatorsSample, { limit: args.numCreators });

    const results = {
      processed: 0,
      discovered: 0,
      errors: 0,
    };

    for (const creator of creators) {
      try {
        // Get related channels
        const relatedHandles = await discoverRelatedChannels(creator.youtubeHandle, args.youtubeApiKey);

        // Add to queue
        for (const handle of relatedHandles) {
          const inCreators = await ctx.runQuery(internal.discovery.queryCreatorByHandle, { handle });

          const inQueue = await ctx.runQuery(internal.discovery.queryQueueByHandle, { handle });

          if (!inCreators && !inQueue) {
            await ctx.runMutation(internal.discovery.insertQueueItem, {
              handle,
              discoveredFrom: creator.youtubeHandle,
            });

            results.discovered++;
          }
        }

        results.processed++;
      } catch (error) {
        console.error(`Error processing ${creator.youtubeHandle}:`, error);
        results.errors++;
      }
    }

    return results;
  },
});

export const getRandomCrawledCreators = internalQuery({
  args: { limit: v.number() },
  handler: async (ctx, args) => {
    const creators = await ctx.db.query("creators").take(args.limit);
    return creators;
  },
});

export const checkHandleExists = internalQuery({
  args: { handle: v.string() },
  handler: async (ctx, args) => {
    const inCreators = await ctx.db
      .query("creators")
      .withIndex("by_youtubeHandle", (q) => q.eq("youtubeHandle", args.handle))
      .unique();

    const inQueue = await ctx.db
      .query("crawler_queue")
      .withIndex("by_handle", (q) => q.eq("handle", args.handle))
      .unique();

    return inCreators || inQueue;
  },
});

export const addToQueue = internalMutation(
  {
    args: {
      handle: v.string(),
      discoveredFrom: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
      return await ctx.db.insert("crawler_queue", {
        handle: args.handle,
        status: "pending",
        discoveredFrom: args.discoveredFrom,
        addedAt: Date.now(),
      });
    },
  },
);

export const getPendingHandle = internalQuery({
  handler: async (ctx) => {
    return await ctx.db
      .query("crawler_queue")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .first();
  },
});

export const markCrawled = internalMutation(
  {
    args: { queueId: v.id("crawler_queue") },
    handler: async (ctx, args) => {
      await ctx.db.patch(args.queueId, {
        status: "crawled",
        lastAttempt: Date.now(),
      });
    },
  },
);

export const markFailed = internalMutation(
  {
    args: { queueId: v.id("crawler_queue"), reason: v.string() },
    handler: async (ctx, args) => {
      await ctx.db.patch(args.queueId, {
        status: "failed",
        lastAttempt: Date.now(),
        failureReason: args.reason,
      });
    },
  },
);