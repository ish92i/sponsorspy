import { YouTubeProvider } from "./lib/youtube";
import { getCompanyData } from "./lib/sponsor";
import { extractFirstLink, followRedirects, isSocialLink, normalizeDomain } from "./lib/utils";
import { IngestBatchSchema } from "./lib/schemas";

async function processVideo(videoId: string, env: Env): Promise<Response> {
  try {
    const yt = new YouTubeProvider();
    const logs: string[] = [];
    
    const details = await yt.getVideoDetails(videoId);
    logs.push(`Video: "${details.title}"`);
    
    const oneYearAgo = Date.now() - (365 * 24 * 60 * 60 * 1000);
    if (details.uploadDate < oneYearAgo) {
      return new Response(JSON.stringify({ error: "Video too old", debug: logs }), { 
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const link = extractFirstLink(details.description);
    if (!link) {
      return new Response(JSON.stringify({ error: "No sponsor link found in description", debug: logs }), { 
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    logs.push(`Found link: ${link}`);

    const finalUrl = await followRedirects(link);
    logs.push(`After redirects: ${finalUrl}`);
    const domain = normalizeDomain(finalUrl);
    logs.push(`Normalized domain: ${domain}`);
    
    if (!domain) {
      return new Response(JSON.stringify({ error: "Could not normalize domain", debug: logs }), { 
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    if (isSocialLink(finalUrl)) {
      return new Response(JSON.stringify({ error: "Link is a social/redirect link", debug: logs }), { 
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const sponsorData = await getCompanyData(domain, env.LOGO_DEV_SECRET_KEY, env.LOGO_DEV_PUBLISHABLE_KEY);
    
    if (!sponsorData) {
      return new Response(JSON.stringify({ error: "Could not fetch sponsor data", debug: logs }), { 
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    logs.push(`✓ Sponsor: ${sponsorData.name}`);

    return new Response(JSON.stringify({ 
      success: true, 
      video: {
        title: details.title,
        thumbnail: details.thumbnail,
        viewCount: details.viewCount,
        likeCount: details.likeCount,
        uploadDate: details.uploadDate,
        link: details.url,
        sponsor: sponsorData
      },
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

export interface Env {
  CONVEX_DEPLOYMENT_URL: string;
  CONVEX_INTERNAL_AUTH_TOKEN: string;
  LOGO_DEV_SECRET_KEY: string;
  LOGO_DEV_PUBLISHABLE_KEY: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const handle = url.searchParams.get("handle");
    const videoId = url.searchParams.get("videoId");

    if (!handle && !videoId) {
      return new Response(JSON.stringify({ error: "Missing handle or videoId parameter" }), { 
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    if (videoId) {
      return processVideo(videoId, env);
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

      const RECENT_LIMIT = 50; 
      const limitedIds = videoIds.slice(0, RECENT_LIMIT);

      for (const id of limitedIds) {
        try {
          const details = await yt.getVideoDetails(id);
          logs.push(`Video ${id}: "${details.title}"`);
          
          const oneYearAgo = Date.now() - (365 * 24 * 60 * 60 * 1000);
          if (details.uploadDate < oneYearAgo) {
            logs.push(`  → Filtered: Too old (${new Date(details.uploadDate).toLocaleDateString()})`);
            continue;
          }

          const link = extractFirstLink(details.description);
          if (!link) {
            logs.push(`  → Filtered: No link in description`);
            continue;
          }
          logs.push(`  → Found link: ${link}`);

          const finalUrl = await followRedirects(link);
          logs.push(`  → After redirects: ${finalUrl}`);
          const domain = normalizeDomain(finalUrl);
          logs.push(`  → Normalized domain: ${domain}`);
          
          if (!domain) {
            logs.push(`  → Filtered: Could not normalize domain`);
            continue;
          }
          
          if (isSocialLink(finalUrl)) {
            logs.push(`  → Filtered: Social link`);
            continue;
          }

          const sponsorData = await getCompanyData(domain, env.LOGO_DEV_SECRET_KEY, env.LOGO_DEV_PUBLISHABLE_KEY);
          
          if (!sponsorData) {
            logs.push(`  → Filtered: No sponsor data returned`);
            continue;
          }

          logs.push(`  → ✓ Included: ${sponsorData.name}`);
          totalViews += details.viewCount;
          totalLikes += details.likeCount;
          processedVideos.push({
            ...details,
            sponsor: sponsorData,
            sponsorLink: finalUrl
          });
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
             uploadDate: v.uploadDate,
             link: v.url,
             sponsor: v.sponsor
         }))
       };

       // Debug: Log first video's like count
       if (processedVideos.length > 0) {
         logs.push(`First video likeCount: ${processedVideos[0].likeCount}`);
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

       // 6. Mark in crawler queue as crawled (if it came from queue)
       if (url.searchParams.get("queueId")) {
         const queueId = url.searchParams.get("queueId");
         const queueUpdateUrl = new URL("/markCrawled", env.CONVEX_DEPLOYMENT_URL).toString();
         await fetch(queueUpdateUrl, {
           method: "POST",
           headers: {
             "Content-Type": "application/json",
             "Authorization": `Bearer ${env.CONVEX_INTERNAL_AUTH_TOKEN}`
           },
           body: JSON.stringify({ queueId })
         });
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
