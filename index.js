// indexNormal.js - Express version
import express from "express";
import { handleThreadRequest, DESUARCHIVE_BOARDS } from "./utils/threadHandler.js";

const app = express();

app.get("/", (req, res) => {
  res.redirect("https://boards.4chan.org/");
});

// Issue: can't pass hash fragment to the server. That means we can't pass #p12345678. replace # with /

app.get("/:board/thread/:id", async (req, res) => {
  const { board, id } = req.params;

  // Check if it's a bot/crawler
  const userAgent = req.get('User-Agent') || '';
  const isBotRequest = /bot|crawler|spider|facebook|twitter|discord|slack/i.test(userAgent);

  if (!isBotRequest) {
    // Check if thread exists on 4chan
    const apiUrl = `https://a.4cdn.org/${board}/thread/${id}.json`;
    try {
      const checkResponse = await fetch(apiUrl);

      if (!checkResponse.ok && DESUARCHIVE_BOARDS.includes(board)) {
        // Thread archived, redirect to Desuarchive
        return res.redirect(`https://desuarchive.org/${board}/thread/${id}/`);
      }
    } catch (err) {
      console.error('Error checking thread:', err);
    }

    // Thread exists on 4chan or board not on Desuarchive
    return res.redirect(`https://boards.4chan.org/${board}/thread/${id}`);
  }

  // Handle bot requests
  const result = await handleThreadRequest(req, {
    board,
    threadId: id,
  });

  if (result.redirect) {
    return res.redirect(result.redirect);
  }
  if (result.error) {
    return res.status(result.status).send(result.error);
  }
  res.send(result.html);
});

app.get("/:board/thread/:id/p:postId", async (req, res) => {
  const { board, id, postId } = req.params;

  // Check if it's a bot/crawler
  const userAgent = req.get('User-Agent') || '';
  const isBotRequest = /bot|crawler|spider|facebook|twitter|discord|slack/i.test(userAgent);

  if (!isBotRequest) {
    // Check if thread exists on 4chan
    const apiUrl = `https://a.4cdn.org/${board}/thread/${id}.json`;
    try {
      const checkResponse = await fetch(apiUrl);

      if (!checkResponse.ok && DESUARCHIVE_BOARDS.includes(board)) {
        // Thread archived, redirect to Desuarchive with post anchor
        return res.redirect(`https://desuarchive.org/${board}/thread/${id}/#${postId}`);
      }
    } catch (err) {
      console.error('Error checking thread:', err);
    }

    // Thread exists on 4chan or board not on Desuarchive
    return res.redirect(`https://boards.4chan.org/${board}/thread/${id}#p${postId}`);
  }

  // Handle bot requests
  const result = await handleThreadRequest(req, {
    board,
    threadId: id,
    postId,
  });

  if (result.redirect) {
    return res.redirect(result.redirect);
  }
  if (result.error) {
    return res.status(result.status).send(result.error);
  }
  res.send(result.html);
});

app.listen(3000, () => console.log("Server running on port 3000"));