// Cloudflare Workers version - no Express needed
import { handleThreadRequest } from "./utils/threadHandler.js";

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