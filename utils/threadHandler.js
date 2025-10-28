// utils/threadHandler.js
// Shared logic between Express and Workers versions

// Desuarchive boards
export const DESUARCHIVE_BOARDS = ['a', 'aco', 'an', 'c', 'cgl', 'co', 'd', 'fit', 'g', 'his', 'int', 'k', 'm', 'mlp', 'mu', 'q', 'qa', 'r9k', 'tg', 'trash', 'vr', 'wsg'];

export async function handleThreadRequest(request, { board, threadId, postId = null })
{
    const userAgent = request.headers.get?.('User-Agent') || request.get?.('User-Agent') || '';

    // Check if it's a bot/crawler (for embeds)
    const isBotRequest = /bot|crawler|spider|facebook|twitter|discord|slack/i.test(userAgent);

    const redirectUrl = postId
        ? `https://boards.4chan.org/${board}/thread/${threadId}#p${postId}`
        : `https://boards.4chan.org/${board}/thread/${threadId}`;

    if (!isBotRequest) {
        // Redirect real users to actual 4chan thread
        return { redirect: redirectUrl };
    }

    const apiUrl = `https://a.4cdn.org/${board}/thread/${threadId}.json`;

    try {
        const response = await fetch(apiUrl);
        let cleanPostId, foundPost;

        let data;
        let targetPost;

        if (response.ok) {
            data = await response.json();
        }

        // Check if comment is not deleted from 4chan
        if (postId && response.ok) {
            // Remove 'p' prefix if it exists
            cleanPostId = typeof postId === 'string' && postId.startsWith('p') ? postId.slice(1) : postId;
            foundPost = data.posts.find(post => post.no === parseInt(cleanPostId));
        }

        // If 4chan is kill, Desuarchive fallback
        // or if 4chan alive, but comment dead
        if ((!response.ok && DESUARCHIVE_BOARDS.includes(board)) || (response.ok && !foundPost && DESUARCHIVE_BOARDS.includes(board))) {
            const lookupPostId = postId ? cleanPostId : threadId;

            let shouldFetchDesu = true;

            if (response.ok && (lookupPostId === threadId))
            {
                // In this case, the thread is alive, but comment cannot be found on both desu AND 4chan
                targetPost = data.posts[0]; // Return OP from 4chan
                shouldFetchDesu = false;
            }

            if (shouldFetchDesu)
            {
            const desuUrl = `https://desuarchive.org/_/api/chan/post?board=${board}&num=${lookupPostId}`;
            const desuResponse = await fetch(desuUrl);

            if (!desuResponse.ok) {
                return { error: 'Thread not found', status: 404 };
            }

            const desuData = await desuResponse.json();

            // Convert Desuarchive API format to 4chan API format
            targetPost = {
                no: parseInt(desuData.num),
                sub: desuData.title_processed || desuData.title,
                com: desuData.comment_processed || desuData.comment,
                tim: desuData.media?.media ? desuData.media.media.split('.')[0] : null,
                ext: desuData.media?.media ? '.' + desuData.media.media.split('.').pop() : null,
                w: desuData.media?.media_w ? parseInt(desuData.media.media_w) : null,
                h: desuData.media?.media_h ? parseInt(desuData.media.media_h) : null,
                // Store original media link as fallback
                desuMediaLink: desuData.media?.media_link || null
            };

            // Find the original thread ID
            threadId = desuData.thread_num;
        }

        } else if (!response.ok) {
            return { error: 'Thread not found', status: 404 };
        } else {
            targetPost = data.posts[0]; // Default to OP

            if (foundPost) {
                targetPost = foundPost;
            }
        }

        // Handle media URL - use Desuarchive link if available, otherwise construct 4chan URL
        let mediaUrl = null;
        if (targetPost.desuMediaLink) {
            mediaUrl = targetPost.desuMediaLink;
        } else if (targetPost.tim && targetPost.ext) {
            mediaUrl = `https://i.4cdn.org/${board}/${targetPost.tim}${targetPost.ext}`;
        }

        // Check if the file is a video format
        const isVideo = targetPost.ext && ['.webm', '.mp4', '.mov'].includes(targetPost.ext.toLowerCase());

        const title = postId
            ? `Post #${postId} in /${board.toUpperCase()}/ Thread #${threadId}`
            : (targetPost.sub || `/${board.toUpperCase()}/ Thread #${threadId}`);

        // Convert <br> tags to newlines before sanitizing
        const rawComment = targetPost.com || '';
        const commentWithLineBreaks = rawComment.replace(/<br\s*\/?>/gi, '\n');
        const description = sanitizeHtml(commentWithLineBreaks);

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

        const html = `
                <!DOCTYPE html>
                <html lang="en">
                <head>
                        <meta charset="utf-8">
                        <title>${escapeHtml(title)}</title>
                        <meta property="og:title" content="${escapeHtml(title)}">
                        <meta property="og:description" content="${escapeHtml(description)}">
                        <meta property="og:type" content="${isVideo ? 'video.other' : 'article'}">
                        <meta name="author" content="${escapeHtml(targetPost.name)}">
                        ${mediaTags}
                        <meta http-equiv="refresh" content="0;url=${redirectUrl}">
                </head>
                <body>
                        <p>Redirecting to <a href="${redirectUrl}">4chan thread</a>...</p>
                </body>
                </html>`;

        return { html };
    } catch (err) {
        console.error(err);
        return { error: 'Error fetching thread', status: 500 };
    }
}

function sanitizeHtml(html) {
    return html
        .replace(/<[^>]*>/g, '')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'")
        .trim()
}

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}