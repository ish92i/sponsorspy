import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  creators: defineTable({
    youtubeHandle: v.string(),
    channelName: v.string(),
    channelUrl: v.string(),
    channelPfp: v.string(),
    subscribers: v.number(),
    avgViews: v.number(),
    avgLikes: v.number(),
    lastChecked: v.number(),
  })
    .index("by_youtubeHandle", ["youtubeHandle"])
    .index("by_channelName", ["channelName"])
    .index("by_subscribers", ["subscribers"])
    .index("by_avgViews", ["avgViews"])
    .index("by_avgLikes", ["avgLikes"]),
  videos: defineTable({
    creatorId: v.id("creators"),
    sponsorId: v.id("sponsors"),
    title: v.string(),
    thumbnail: v.string(),
    viewCount: v.number(),
    likeCount: v.number(),
    commentCount: v.number(),
    uploadDate: v.number(),
    link: v.string(),
  })
    .index("by_creatorId", ["creatorId"])
    .index("by_sponsorId", ["sponsorId"])
    .index("by_creatorId_sponsorId", ["creatorId", "sponsorId"])
    .index("by_sponsorId_creatorId", ["sponsorId", "creatorId"]),
  sponsors: defineTable({
    name: v.string(),
    description: v.string(),
    logo: v.string(),
    website: v.string(),
    firstSeen: v.number(),
    lastSeen: v.number(),
  }).index("by_website", ["website"]),
  creator_sponsors: defineTable({
    creatorId: v.id("creators"),
    sponsorId: v.id("sponsors"),
    creatorName: v.string(),
    creatorHandle: v.string(),
    creatorPfp: v.string(),
    sponsorName: v.string(),
    sponsorLogo: v.string(),
    sponsorWebsite: v.string(),
    subscribers: v.number(),
    avgViews: v.number(),
    avgLikes: v.number(),
    videoCount: v.number(),
    firstSeen: v.number(),
    lastSeen: v.number(),
  })
    .index("by_creatorId", ["creatorId"])
    .index("by_sponsorId", ["sponsorId"])
    .index("by_creatorId_sponsorId", ["creatorId", "sponsorId"])
    .index("by_subscribers", ["subscribers"])
    .index("by_avgViews", ["avgViews"])
    .index("by_avgLikes", ["avgLikes"]),
});
