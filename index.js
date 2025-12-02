// indexNormal.js - Express version
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