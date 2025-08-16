import express from "express";
import fetch from "node-fetch";
import sanitizeHtml from "sanitize-html";

const app = express();

app.get("/", (req, res) => {
  res.redirect("https://boards.4chan.org/");
});

// Issue: can't pass hash fragment to the server. That means we can't pass #p12345678. replace # with /
async function handleThread(req, res, postId = null) {
    const { board, id } = req.params;
    const userAgent = req.get('User-Agent') || '';

    // Check if it's a bot/crawler (for embeds)
    const isBotRequest = /bot|crawler|spider|facebook|twitter|discord|slack/i.test(userAgent);

    const redirectUrl = postId
        ? `https://boards.4chan.org/${board}/thread/${id}#p${postId.startsWith('p') ? postId.slice(1) : postId}`
        : `https://boards.4chan.org/${board}/thread/${id}`;

    if (!isBotRequest) {
        // Redirect real users to actual 4chan thread
        return res.redirect(redirectUrl);
    }

    const apiUrl = `https://a.4cdn.org/${board}/thread/${id}.json`;

    try {
        const response = await fetch(apiUrl);
        if (!response.ok) return res.status(404).send("Thread not found");

        const data = await response.json();

        let targetPost = data.posts[0]; // Default to OP

        if (postId) {
            // Remove 'p' prefix if it exists
            const cleanPostId = postId.startsWith('p') ? postId.slice(1) : postId;
            const foundPost = data.posts.find(post => post.no === parseInt(cleanPostId));
            if (!foundPost) return res.status(404).send("Post not found");
            targetPost = foundPost;
        }

        const mediaUrl = targetPost.tim
            ? `https://i.4cdn.org/${board}/${targetPost.tim}${targetPost.ext}`
            : null;

        // Check if the file is a video format
        const isVideo = targetPost.ext && ['.webm', '.mp4', '.mov'].includes(targetPost.ext.toLowerCase());

        const title = postId
            ? `Post #${postId.startsWith('p') ? postId.slice(1) : postId} in /${board.toUpperCase()}/ Thread #${id}`
            : (targetPost.sub || `/${board.toUpperCase()}/ Thread #${id}`);

        // Convert <br> tags to newlines before sanitizing
        const rawComment = targetPost.com || "";
        const commentWithLineBreaks = rawComment.replace(/<br\s*\/?>/gi, '\n');
        const description = sanitizeHtml(commentWithLineBreaks, {
            allowedTags: [],
            allowedAttributes: {}
        });

        // Generate appropriate meta tags based on media type
        let mediaTags = '';
        if (mediaUrl) {
            if (isVideo) {
                // Video meta tags
                mediaTags = `
                <meta property="og:video" content="${mediaUrl}">
                <meta property="og:video:type" content="video/${targetPost.ext.slice(1)}">
                <meta property="og:video:width" content="${targetPost.w || 640}">
                <meta property="og:video:height" content="${targetPost.h || 480}">
                <meta name="twitter:card" content="player">
                <meta name="twitter:player" content="${mediaUrl}">
                <meta name="twitter:player:width" content="${targetPost.w || 640}">
                <meta name="twitter:player:height" content="${targetPost.h || 480}">`;
            } else {
                // Image meta tags
                mediaTags = `
                <meta property="og:image" content="${mediaUrl}">
                <meta property="og:image:width" content="${targetPost.w || ''}">
                <meta property="og:image:height" content="${targetPost.h || ''}">
                <meta name="twitter:card" content="summary_large_image">
                <meta name="twitter:image" content="${mediaUrl}">`;
            }
        }

        res.send(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="utf-8">
                <title>${title}</title>
                <meta property="og:title" content="${title}">
                <meta property="og:description" content="${description}">
                <meta property="og:type" content="${isVideo ? 'video.other' : 'article'}">
                ${mediaTags}
            </head>
            </html>
        `);
    } catch (err) {
        console.error(err);
        res.status(500).send("Error fetching thread");
    }
}

app.get("/:board/thread/:id", (req, res) => handleThread(req, res));
app.get("/:board/thread/:id/p:postId", (req, res) => handleThread(req, res, req.params.postId));

app.listen(3000, () => console.log("Server running on port 3000"));