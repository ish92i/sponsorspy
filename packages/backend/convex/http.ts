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

export default http;