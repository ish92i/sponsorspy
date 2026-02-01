import { v } from "convex/values";
import { internalMutation, MutationCtx } from "./_generated/server";

async function upsertCreator(ctx: MutationCtx, args: any) {
  const existing = await ctx.db
    .query("creators")
    .withIndex("by_youtubeHandle", (q) => q.eq("youtubeHandle", args.youtubeHandle))
    .unique();

  const now = Date.now();
  if (existing) {
    await ctx.db.patch(existing._id, { ...args, lastChecked: now });
    return existing._id;
  }
  return await ctx.db.insert("creators", { ...args, lastChecked: now });
}

async function upsertSponsor(ctx: MutationCtx, args: any) {
  const existing = await ctx.db
    .query("sponsors")
    .withIndex("by_website", (q) => q.eq("website", args.website))
    .unique();

  const { uploadDate, ...sponsorData } = args;

  if (existing) {
    await ctx.db.patch(existing._id, { lastSeen: uploadDate });
    return existing._id;
  }
  return await ctx.db.insert("sponsors", { ...sponsorData, firstSeen: uploadDate, lastSeen: uploadDate });
}

async function recordVideo(ctx: MutationCtx, args: any) {
  const existing = await ctx.db
    .query("videos")
    .withIndex("by_creatorId_sponsorId", (q) => 
      q.eq("creatorId", args.creatorId).eq("sponsorId", args.sponsorId)
    )
    .filter((q) => q.eq(q.field("link"), args.link))
    .first();

  if (!existing) {
    console.log(`[Convex] Inserting new video: ${args.title}`);
    await ctx.db.insert("videos", {
      creatorId: args.creatorId,
      sponsorId: args.sponsorId,
      title: args.title,
      thumbnail: args.thumbnail,
      viewCount: args.viewCount,
      likeCount: args.likeCount,
      uploadDate: args.uploadDate,
      link: args.link,
    });
  } else {
    console.log(`[Convex] Patching existing video: ${args.title} (likes: ${args.likeCount})`);
    await ctx.db.patch(existing._id, {
      viewCount: args.viewCount,
      likeCount: args.likeCount,
    });
  }

  const relation = await ctx.db
    .query("creator_sponsors")
    .withIndex("by_creatorId_sponsorId", (q) =>
      q.eq("creatorId", args.creatorId).eq("sponsorId", args.sponsorId)
    )
    .unique();

  if (relation) {
    await ctx.db.patch(relation._id, {
      videoCount: relation.videoCount + (existing ? 0 : 1),
      lastSeen: args.uploadDate,
      subscribers: args.creatorData.subscribers,
      avgViews: args.creatorData.avgViews,
      avgLikes: args.creatorData.avgLikes,
      lastVideoTitle: args.title,
      lastVideoThumbnail: args.thumbnail,
      lastVideoLink: args.link,
    });
  } else {
    await ctx.db.insert("creator_sponsors", {
      creatorId: args.creatorId,
      sponsorId: args.sponsorId,
      creatorName: args.creatorData.name,
      creatorHandle: args.creatorData.handle,
      creatorPfp: args.creatorData.pfp,
      sponsorName: args.sponsorData.name,
      sponsorLogo: args.sponsorData.logo,
      sponsorWebsite: args.sponsorData.website,
      subscribers: args.creatorData.subscribers,
      avgViews: args.creatorData.avgViews,
      avgLikes: args.creatorData.avgLikes,
      videoCount: 1,
      firstSeen: args.uploadDate,
      lastSeen: args.uploadDate,
      firstVideoTitle: args.title,
      firstVideoThumbnail: args.thumbnail,
      firstVideoLink: args.link,
      lastVideoTitle: args.title,
      lastVideoThumbnail: args.thumbnail,
      lastVideoLink: args.link,
    });
  }
}

export const processBatch = internalMutation({
  args: {
    creator: v.object({
      youtubeHandle: v.string(),
      channelName: v.string(),
      channelUrl: v.string(),
      channelPfp: v.string(),
      subscribers: v.number(),
      avgViews: v.number(),
      avgLikes: v.number(),
    }),
    videos: v.array(v.object({
      title: v.string(),
      thumbnail: v.string(),
      viewCount: v.number(),
      likeCount: v.number(),
      uploadDate: v.number(),
      link: v.string(),
      sponsor: v.object({
        name: v.string(),
        logo: v.string(),
        website: v.string(),
      }),
    })),
  },
  handler: async (ctx, args) => {
    const creatorId = await upsertCreator(ctx, args.creator);
    
    for (const video of args.videos) {
       const sponsorId = await upsertSponsor(ctx, { ...video.sponsor, uploadDate: video.uploadDate });
       await recordVideo(ctx, {
        creatorId,
        sponsorId,
        ...video,
        creatorData: {
            name: args.creator.channelName,
            handle: args.creator.youtubeHandle,
            pfp: args.creator.channelPfp,
            subscribers: args.creator.subscribers,
            avgViews: args.creator.avgViews,
            avgLikes: args.creator.avgLikes
        },
        sponsorData: {
            name: video.sponsor.name,
            logo: video.sponsor.logo,
            website: video.sponsor.website
        }
      });
    }
    return { success: true, creatorId, count: args.videos.length };
  },
});
