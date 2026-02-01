import { z } from "zod";

export const CreatorSchema = z.object({
  youtubeHandle: z.string(),
  channelName: z.string(),
  channelUrl: z.string(),
  channelPfp: z.string(),
  subscribers: z.number(),
  avgViews: z.number(),
  avgLikes: z.number(),
});

export const SponsorSchema = z.object({
  name: z.string(),
  description: z.string(),
  logo: z.string(),
  website: z.string(),
});

export const VideoSchema = z.object({
  title: z.string(),
  thumbnail: z.string(),
  viewCount: z.number(),
  likeCount: z.number(),
  commentCount: z.number(),
  uploadDate: z.number(),
  link: z.string(),
  sponsor: SponsorSchema,
});

export const IngestBatchSchema = z.object({
  creator: CreatorSchema,
  videos: z.array(VideoSchema),
});
