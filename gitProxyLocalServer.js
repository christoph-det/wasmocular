/**
 * Local CORS Proxy for GitHub
 * Requirements: Node.js v18.0.0+
 * Run: node gitProxyLocalServer.js
 */
const PORT = 3000;

const http = require("http");

http
  .createServer(async (req, res) => {
    const corsHeaders = {
      "Access-Control-Allow-Origin": req.headers.origin ?? "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Expose-Headers": "*"
    };

    if (req.method === "OPTIONS") {
      res.writeHead(204, corsHeaders);
      return res.end();
    }

    try {
      const targetUrl = `https://github.com${req.url.replace("/git-proxy", "")}`;

      const response = await fetch(targetUrl, {
        method: req.method,
        headers: {
          ...req.headers,
          host: "github.com",
          "user-agent": "git/2.0"
        },
        body: req.method !== "GET" && req.method !== "HEAD" ? req : undefined,
        duplex: "half"
      });

      res.writeHead(response.status, {
        ...Object.fromEntries(response.headers),
        ...corsHeaders
      });

      // Directly route the web stream to the node response
      const reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
      res.end();
    } catch (err) {
      console.error("Proxy Error:", err);
      res.writeHead(500, corsHeaders);
      res.end("Proxy Error");
    }
  })
  .listen(PORT, () => console.log(`Proxy on http://localhost:${PORT}`));
