export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    return new Response(
      JSON.stringify({
        message: "Welcome to SponsorSpy Indexer",
        path: url.pathname,
        method: request.method,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  },
};
