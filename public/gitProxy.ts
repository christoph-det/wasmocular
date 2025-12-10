export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    const corsHeaders: Record<string, string> = {
      "Access-Control-Allow-Origin": "https://christoph-det.github.io",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "*"
    };

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
