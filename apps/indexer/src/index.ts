import { YouTubeProvider } from "./lib/youtube";
import { getCompanyData } from "./lib/sponsor";
import { extractFirstLink, followRedirects, isSocialLink, normalizeDomain } from "./lib/utils";
import { IngestBatchSchema } from "./lib/schemas";

export interface Env {
  CONVEX_DEPLOYMENT_URL: string;
  CONVEX_INTERNAL_AUTH_TOKEN: string;
  LOGO_DEV_KEY: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const handle = url.searchParams.get("handle");

    if (!handle) {
      return new Response(JSON.stringify({ error: "Missing handle parameter" }), { 
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    try {
      const yt = new YouTubeProvider();
      const logs: string[] = [];
      
      // 1. Get Channel & Recent Video IDs
      const { channel, videos: videoIds } = await yt.getChannelVideos(handle);
      logs.push(`Found channel ${channel.channelName} with ${videoIds.length} recent videos`);
      logs.push(`Raw Sub Text: "${channel._rawSubText}"`);
      logs.push(`Subscribers: ${channel.subscribers}`);

      const processedVideos = [];
      let totalViews = 0;
      let totalLikes = 0;

      const RECENT_LIMIT = 10; 
      const limitedIds = videoIds.slice(0, RECENT_LIMIT);

      for (const id of limitedIds) {
        try {
          const details = await yt.getVideoDetails(id);
          
          const threeMonthsAgo = Date.now() - (90 * 24 * 60 * 60 * 1000);
          if (details.uploadDate < threeMonthsAgo) continue;

          const link = extractFirstLink(details.description);
          if (link) {
             const finalUrl = await followRedirects(link);
             const domain = normalizeDomain(finalUrl);
             
             if (domain && !isSocialLink(finalUrl)) {
               const sponsorData = await getCompanyData(domain, env.LOGO_DEV_KEY);
               
               if (sponsorData) {
                 totalViews += details.viewCount;
                 totalLikes += details.likeCount;
                 processedVideos.push({
                   ...details,
                   link: finalUrl,
                   sponsor: sponsorData
                 });
               }
             }
          }
        } catch (e: any) {
          logs.push(`Error processing ${id}: ${e.message}`);
        }
      }

      // 4. Update Aggregates
      if (processedVideos.length > 0) {
        channel.avgViews = Math.floor(totalViews / processedVideos.length);
        channel.avgLikes = Math.floor(totalLikes / processedVideos.length);
      }

      // 5. Send to Convex
      const convexUrl = new URL("/ingest", env.CONVEX_DEPLOYMENT_URL).toString();
      const payload = {
        creator: {
            youtubeHandle: channel.youtubeHandle,
            channelName: channel.channelName,
            channelUrl: channel.channelUrl,
            channelPfp: channel.channelPfp,
            subscribers: channel.subscribers,
            avgViews: channel.avgViews,
            avgLikes: channel.avgLikes
        },
        videos: processedVideos.map(v => ({
            title: v.title,
            thumbnail: v.thumbnail,
            viewCount: v.viewCount,
            likeCount: v.likeCount,
            commentCount: v.commentCount,
            uploadDate: v.uploadDate,
            link: v.link,
            sponsor: v.sponsor
        }))
      };

      // Debug: Log first video's like count
      if (processedVideos.length > 0) {
        logs.push(`First video likeCount: ${processedVideos[0].likeCount}, commentCount: ${processedVideos[0].commentCount}`);
      }

      const convexRes = await fetch(convexUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${env.CONVEX_INTERNAL_AUTH_TOKEN}`
        },
        body: JSON.stringify(payload)
      });

      if (!convexRes.ok) {
        throw new Error(`Convex ingestion failed: ${await convexRes.text()}`);
      }

      return new Response(JSON.stringify({ 
        success: true, 
        processed: processedVideos.length, 
        channel: channel.channelName,
        debug: logs
      }), {
        headers: { "Content-Type": "application/json" }
      });

    } catch (e: any) {
      console.error(e);
      return new Response(JSON.stringify({ error: e.message }), { 
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }
};
