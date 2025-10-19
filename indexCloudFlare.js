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
        // Check if thread exists on 4chan
        const apiUrl = `https://a.4cdn.org/${board}/thread/${threadId}.json`;
        try {
          const checkResponse = await fetch(apiUrl);

          if (!checkResponse.ok) {
            // Thread archived, redirect to Desuarchive
            const desuThreadNum = await checkDesuarchive(board, postId || threadId);
            if (desuThreadNum) {
              const desuUrl = postId
                ? `https://desuarchive.org/${board}/thread/${desuThreadNum}/#${postId}`
                : `https://desuarchive.org/${board}/thread/${desuThreadNum}/`;
              return Response.redirect(desuUrl, 302);
            }
          }
        } catch (err) {
          console.error('Error checking thread:', err);
        }

        // Thread exists on 4chan or not found anywhere
        const redirectUrl = postId
          ? `https://boards.4chan.org/${board}/thread/${threadId}#p${postId}`
          : `https://boards.4chan.org/${board}/thread/${threadId}`;
        return Response.redirect(redirectUrl, 302);
      }

      // Handle bot requests
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