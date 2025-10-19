// Cloudflare Workers version
import { handleThreadRequest, DESUARCHIVE_BOARDS } from "./utils/threadHandler.js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    if (pathname === '/') {
      return Response.redirect('https://boards.4chan.org/', 302);
    }

    const threadMatch = pathname.match(/^\/([^\/]+)\/thread\/(\d+)(?:\/p(\d+))?$/);

    if (threadMatch) {
      const [, board, threadId, postId] = threadMatch;

      // Check if it's a bot/crawler
      const userAgent = request.headers.get('User-Agent') || '';
      const isBotRequest = /bot|crawler|spider|facebook|twitter|discord|slack/i.test(userAgent);

      if (!isBotRequest) {
        // Pre-fetch desuarchive fallback URL
        let desuUrl = null;
        let trueThreadID = null;

        if (DESUARCHIVE_BOARDS.includes(board)) {
          const desuThreadNum = await checkDesuarchive(board, (postId ? postId : threadId));
          if (desuThreadNum) {
            trueThreadID = desuThreadNum;
            desuUrl = postId
              ? `https://desuarchive.org/${board}/thread/${desuThreadNum}/#${postId}`
              : `https://desuarchive.org/${board}/thread/${desuThreadNum}/`;
          }
        }

        // For real users, return HTML that checks 4chan API client-side
        const chanUrl = postId
          ? `https://boards.4chan.org/${board}/thread/${trueThreadID ? trueThreadID : threadId}#p${postId}`
          : `https://boards.4chan.org/${board}/thread/${trueThreadID ? trueThreadID : threadId}`;



        const html = `
          <!DOCTYPE html>
          <html lang="en">
          <head>
            <meta charset="utf-8">
            <title>Redirecting...</title>
            <script>
              (async function() {
                const apiUrl = 'https://a.4cdn.org/${board}/thread/${threadId}.json';
                const chanUrl = '${chanUrl}';
                const desuUrl = ${desuUrl ? `'${desuUrl}'` : 'null'};

                try {
                  const response = await fetch(apiUrl);
                  if (response.ok) {
                    // Thread exists on 4chan, redirect there
                    window.location.href = chanUrl;
                  } else {
                    // Thread doesn't exist, try desuarchive
                    if (desuUrl) {
                      window.location.href = desuUrl;
                    } else {
                      // No desuarchive fallback available
                      // window.location.href = chanUrl;
                    }
                  }
                } catch (err) {
                  // If fetch fails, try 4chan anyway
                  window.location.href = chanUrl;
                }
              })();
            </script>
          </head>
          <body>
            <p>Redirecting...</p>
          </body>
          </html>`;

        return new Response(html, {
          headers: { 'Content-Type': 'text/html;charset=UTF-8' },
        });
      }

      // Handle bot requests (for embeds)
      const result = await handleThreadRequest(request, { board, threadId, postId });

      if (result.redirect) {
        return Response.redirect(result.redirect, 302);
      }
      if (result.error) {
        return new Response(result.error, { status: result.status });
      }
      return new Response(result.html, {
        headers: { 'Content-Type': 'text/html;charset=UTF-8' },
      });
    }

    return new Response('Not Found', { status: 404 });
  }
};

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