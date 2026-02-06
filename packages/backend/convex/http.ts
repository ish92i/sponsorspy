import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { authComponent, createAuth } from "./auth";

const http = httpRouter();

authComponent.registerRoutes(http, createAuth);

http.route({
  path: "/ingest",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    // 1. Check Auth
    const authHeader = request.headers.get("Authorization");
    const expectedSecret = process.env.CONVEX_INTERNAL_AUTH_TOKEN;
    
    if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
      return new Response("Unauthorized", { status: 401 });
    }

    // 2. Parse Body
    const body = await request.json();
    console.log(`Received ingest request for ${body.creator?.channelName} with ${body.videos?.length} videos`);

    // 3. Call Internal Mutation
    try {
      // @ts-ignore
      const result = await ctx.runMutation(internal.ingest.processBatch, body);
      console.log("Mutation result:", result);
      return new Response("OK", { status: 200 });
    } catch (e: any) {
      console.error("Mutation Error:", e.message);
      return new Response(e.message, { status: 500 });
    }
  }),
});

http.route({
  path: "/markCrawled",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const authHeader = request.headers.get("Authorization");
    const expectedSecret = process.env.CONVEX_INTERNAL_AUTH_TOKEN;
    
    if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
      return new Response("Unauthorized", { status: 401 });
    }

    const body = await request.json();
    try {
      // @ts-ignore
      await ctx.runMutation(internal.discovery.markCrawled, { queueId: body.queueId });
      return new Response("OK", { status: 200 });
    } catch (e: any) {
      console.error("Error marking crawled:", e.message);
      return new Response(e.message, { status: 500 });
    }
  }),
});

http.route({
  path: "/getPendingCrawl",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const authHeader = request.headers.get("Authorization");
    const expectedSecret = process.env.CONVEX_INTERNAL_AUTH_TOKEN;
    
    if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
      return new Response("Unauthorized", { status: 401 });
    }

    try {
      // @ts-ignore
      const item = await ctx.runQuery(internal.discovery.getPendingHandle);
      if (!item) {
        return new Response(JSON.stringify({ handle: null }), { 
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      return new Response(JSON.stringify({ handle: item.handle, queueId: item._id }), { 
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    } catch (e: any) {
      console.error("Error getting pending crawl:", e.message);
      return new Response(e.message, { status: 500 });
    }
  }),
});

http.route({
  path: "/runScheduler",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const authHeader = request.headers.get("Authorization");
    const expectedSecret = process.env.CONVEX_INTERNAL_AUTH_TOKEN;
    
    if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
      return new Response("Unauthorized", { status: 401 });
    }

    const body = await request.json();
    try {
      // @ts-ignore
      const result = await ctx.runAction(internal.scheduler.crawlScheduler, {
        crawlerWorkerUrl: body.crawlerWorkerUrl || process.env.CRAWLER_WORKER_URL || "https://sponsorspy-crawler.workers.dev",
        youtubeApiKey: body.youtubeApiKey || process.env.YOUTUBE_API_KEY || "",
        numDiscoveryCreators: body.numDiscoveryCreators || parseInt(process.env.NUM_DISCOVERY_CREATORS || "10"),
        numCrawlsPerRun: body.numCrawlsPerRun || parseInt(process.env.NUM_CRAWLS_PER_RUN || "5"),
      });
      return new Response(JSON.stringify(result), { 
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    } catch (e: any) {
      console.error("Error running scheduler:", e.message);
      return new Response(e.message, { status: 500 });
    }
  }),
});

export default http;