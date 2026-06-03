export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    const allowedOrigins = [
      "https://christoph-det.github.io",
      "http://localhost:4173",
      "http://localhost:5173"
    ];

    const origin = request.headers.get("Origin");

    const corsHeaders = {
      "Access-Control-Allow-Origin":
        origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0],
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "*"
    };

    // optional Cloudflare Rate Limiter logic
    /*const { success } = await env.MY_RATE_LIMITER.limit({ key: url })
    if (!success) {
      return new Response(`429 Failure – rate limit exceeded for ${url}`, { status: 429, headers: corsHeaders })
    }*/

    // Handle Preflight
    if (request.method === "OPTIONS")
      return new Response(null, { headers: corsHeaders });

    const targetHost = "github.com";
    const cleanPath = url.pathname.replace(/^\/git-proxy/, "");
    const targetUrl = `https://${targetHost}${cleanPath}${url.search}`;

    const newRequest = new Request(targetUrl, request);

    // Override specific headers required by Git providers
    newRequest.headers.set("Host", targetHost);
    newRequest.headers.set("User-Agent", "git/2.0");

    const response = await fetch(newRequest);
    const newResponse = new Response(response.body, response);

    Object.keys(corsHeaders).forEach((key) =>
      newResponse.headers.set(key, corsHeaders[key])
    );

    return newResponse;
  }
};
