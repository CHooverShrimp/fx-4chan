// index.js - Express version

import express from "express";
import { handleThreadRequest } from "./utils/threadHandler.js";

const app = express();

app.get("/", (req, res) => {
  res.redirect("https://boards.4chan.org/");
});

// Issue: can't pass hash fragment to the server. That means we can't pass #p12345678. replace # with /

// Handling OPs
app.get("/:board/thread/:id", async (req, res) => {
  const { board, id } = req.params;

  const result = await handleThreadRequest(req, {
    board,
    threadId: id,
    baseUrl: `${config.isHTTPS ? "https" : req.protocol}://${req.get('host')}`,
  });

  if (result.redirect) {
    return res.redirect(result.redirect);
  }
  if (result.error) {
    return res.status(result.status).send(result.error);
  }
  res.send(result.html);
});

// Handling posts in a thread
app.get("/:board/thread/:id/p:postId", async (req, res) => {
  const { board, id, postId } = req.params;

  const result = await handleThreadRequest(req, {
    board,
    threadId: id,
    postId,
    baseUrl: `${config.isHTTPS ? "https" : req.protocol}://${req.get('host')}`,
  });

  if (result.redirect) {
    return res.redirect(result.redirect);
  }
  if (result.error) {
    return res.status(result.status).send(result.error);
  }
  res.send(result.html);
});

app.get('/proxy/image', async (req, res) => {
    if (!allowsImageProxy)
        return res.status(404).send('Image proxying is not enabled for the server');

    const imageUrl = req.query.url;

    if (!imageUrl) {
        return res.status(400).send('Missing url parameter');
    }

    // Validate URL is from allowed domains
    const isAllowed = imageProxySrc.some(domain => imageUrl.includes(domain));

    if (!isAllowed) {
        return res.status(403).send('Domain not allowed for proxying');
    }

    try {
        const response = await fetch(imageUrl);

        if (!response.ok) {
            return res.status(response.status).send('Failed to fetch image');
        }

        // Get content type from original response
        const contentType = response.headers.get('content-type');

        // Set appropriate headers
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', `public, max-age=${config.imageProxyAge}`);

        // Stream the image
        const buffer = await response.arrayBuffer();
        res.send(Buffer.from(buffer));

    } catch (error) {
        console.error('Proxy error:', error);
        res.status(500).send('Error proxying image');
    }
});

app.listen(config.webPort, () => console.log(`Server running on port ${config.webPort}`));