// indexNormal.js - Express version
import express from "express";
import { handleThreadRequest, DESUARCHIVE_BOARDS } from "./utils/threadHandler.js";

const app = express();

app.get("/", (req, res) => {
  res.redirect("https://boards.4chan.org/");
});

// Helper function to check Desuarchive using post API
async function checkDesuarchive(board, threadId) {
  if (!DESUARCHIVE_BOARDS.includes(board)) {
    return null;
  }

  try {
    const desuUrl = `https://desuarchive.org/_/api/chan/post?board=${board}&num=${threadId}`;
    const desuResponse = await fetch(desuUrl);

    if (desuResponse.ok) {
      const desuData = await desuResponse.json();
      // Check if we got valid data back
      if (desuData && desuData.thread_num) {
        return desuData.thread_num;
      }
    }
  } catch (err) {
    console.error('Error checking Desuarchive:', err);
  }

  return null;
}

// Check if it's a bot/crawler
const userAgent = req.get('User-Agent') || '';
const isBotRequest = /bot|crawler|spider|facebook|twitter|discord|slack/i.test(userAgent);

// Issue: can't pass hash fragment to the server. That means we can't pass #p12345678. replace # with /

app.get("/:board/thread/:id", async (req, res) => {
  const { board, id } = req.params;

  if (!isBotRequest) {
    // Check if thread exists on 4chan
    const apiUrl = `https://a.4cdn.org/${board}/thread/${id}.json`;
    try {
      const checkResponse = await fetch(apiUrl);

      if (!checkResponse.ok) {
        // Thread archived, redirect to Desuarchive
        const desuThreadNum = await checkDesuarchive(board, id);
        if (desuThreadNum) {
          return res.redirect(`https://desuarchive.org/${board}/thread/${desuThreadNum}/`);
        }
      }
    } catch (err) {
      console.error('Error checking thread:', err);
    }

    // Thread exists on 4chan or not found anywhere
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



  if (!isBotRequest) {
    // Check if thread exists on 4chan
    const apiUrl = `https://a.4cdn.org/${board}/thread/${id}.json`;
    try {
      const checkResponse = await fetch(apiUrl);

      if (!checkResponse.ok) {
        // Thread not on 4chan, check Desuarchive using the post ID
        const desuThreadNum = await checkDesuarchive(board, postId);
        if (desuThreadNum) {
          return res.redirect(`https://desuarchive.org/${board}/thread/${desuThreadNum}/#${postId}`);
        }
      }
    } catch (err) {
      console.error('Error checking thread:', err);
    }

    // Thread exists on 4chan or not found anywhere
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