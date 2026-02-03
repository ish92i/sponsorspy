import { v } from "convex/values";

import { query } from "./_generated/server";

const normalizeSearch = (value?: string | null) => value?.trim().toLowerCase() ?? "";

export const listSponsors = query({
  args: {
    search: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    const sponsors = await ctx.db.query("sponsors").take(limit);
    const search = normalizeSearch(args.search);
    if (!search) {
      return sponsors;
    }
    return sponsors.filter((sponsor) => sponsor.name.toLowerCase().includes(search));
  },
});

export const listCreators = query({
  args: {
    search: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    const creators = await ctx.db.query("creators").take(limit);
    const search = normalizeSearch(args.search);
    if (!search) {
      return creators;
    }
    return creators.filter((creator) => creator.channelName.toLowerCase().includes(search));
  },
});

export const getSponsorProfile = query({
  args: { id: v.id("sponsors") },
  handler: async (ctx, args) => {
    const sponsor = await ctx.db.get(args.id);
    if (!sponsor) {
      return null;
    }
    const creators = await ctx.db
      .query("creator_sponsors")
      .withIndex("by_sponsorId", (q) => q.eq("sponsorId", args.id))
      .take(50);
    return { sponsor, creators };
  },
});

export const getCreatorProfile = query({
  args: { id: v.id("creators") },
  handler: async (ctx, args) => {
    const creator = await ctx.db.get(args.id);
    if (!creator) {
      return null;
    }
    const sponsors = await ctx.db
      .query("creator_sponsors")
      .withIndex("by_creatorId", (q) => q.eq("creatorId", args.id))
      .take(50);
    const videos = await ctx.db.query("videos").withIndex("by_creatorId", (q) => q.eq("creatorId", args.id)).take(20);
    const recentVideos = [...videos].sort((a, b) => b.uploadDate - a.uploadDate).slice(0, 6);
    return { creator, sponsors, recentVideos };
  },
});
