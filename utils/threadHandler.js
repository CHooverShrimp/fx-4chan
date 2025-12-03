// utils/threadHandler.js
// Shared logic between Express and Workers versions
import * as config from "../config.js";

//Foolfuuka - Asagi Fetcher framework
export const ARCHIVES = [
    {
        archive: "Desuarchive",
        api: "desuarchive.org",
        board: ["a", "aco", "an", "c", "cgl", "co", "d", "fit", "g", "his", "int", "k", "m", "mlp", "mu", "q", "qa", "r9k", "tg", "trash", "vr", "wsg"],
    },
    {
        archive: "b4k",
        api: "arch.b4k.dev",
        board: ["v", "vg", "vm", "vmg", "vp", "vrpg", "vst"],
    },
    {
        archive: "4plebs",
        api: "archive.4plebs.org",
        board: ["adv", "f", "hr", "mlpol", "mo", "o", "pol", "s4s", "sp", "tg", "trv", "tv", "x"],
    },
    /* Warosu currently unsupported, is using fuuka rather than foolfuuka, different API, I can't find documentation anywhere
    {
        archive: "warosu",
        api: "warosu.org",
        board: ["3", "biz", "ck", "diy", "fa", "ic", "jp", "lit", "sci", "vr", "vt"],
    },
    */
    { // fallback, most unreliable, doesn't cache image, api returning stub instead of just 404, etc.
        archive: "Archived.Moe",
        api: "archived.moe",
        board: ["3", "a", "aco", "adv", "an", "asp", "b", "bant", "biz", "c", "can", "cgl", "ck", "cm", "co", "cock", "con", "d", "diy", "e", "f", "fa", "fap", "fit", "fitlit", "g", "gd", "gif", "h", "hc", "his", "hm", "hr", "i", "ic", "int", "jp", "k", "lgbt", "lit", "m", "mlp", "mlpol", "mo", "mtv", "mu", "n", "news", "o", "out", "outsoc", "p", "po", "pol", "pw", "q", "qa", "qb", "qst", "r", "r9k", "s", "s4s", "sci", "soc", "sp", "spa", "t", "tg", "toy", "trash", "trv", "tv", "u", "v", "vg", "vint", "vip", "vm", "vmg", "vp", "vr", "vrpg", "vst", "vt", "w", "wg", "wsg", "wsr", "x", "xs", "y"],
    },
]

export const NSFWBoards = ["aco", "b", "bant", "d", "e", "gif", "h", "hc", "hm", "hr", "pol", "r", "r9k", "s", "s4s", "soc", "t", "u", "y"]
const blueboardColor = "#0026ffff";
const redboardColor = "#ff0000ff";

export async function handleThreadRequest(request, { board, threadId, postId = null, baseUrl})
{
    const isRedboard = NSFWBoards.includes(board);


    if (!config.allowNSFWBoards && isRedboard || config.blacklistedBoards.includes(board)){
        return { error: 'This board is not supported', status: 403 };
    }
    const userAgent = request.headers.get?.('User-Agent') || request.get?.('User-Agent') || '';

    // Check if it's a bot/crawler (for embeds)
    const isBotRequest = /bot|crawler|spider|facebook|twitter|discord|slack/i.test(userAgent);

    const apiUrl = `https://a.4cdn.org/${board}/thread/${threadId}.json`;

    let source = "4chan";

    try {
        const response = await fetch(apiUrl);
        let cleanPostId, foundPost;

        let data;
        let targetPost;
        let redirectUrl;

        let archiveName, apiDomain;

        // Checking 4chan API if it's still alive
        if (response.ok) {
            data = await response.json();
        }

        // Remove 'p' prefix if it exists on the comment ID
        if (postId) {
            cleanPostId = typeof postId === 'string'
                ? postId.replace(/^[pq]/, '')
                : postId;
        }

        // Check if comment is not deleted from 4chan
        if (postId && response.ok) {
            foundPost = data.posts.find(post => post.no === parseInt(cleanPostId));
        }

        // If thread is still alive, returns a redirect
        if (response.ok) {
            redirectUrl = foundPost
                ? `https://boards.4chan.org/${board}/thread/${threadId}#p${cleanPostId}`
                : `https://boards.4chan.org/${board}/thread/${threadId}`;
            // Redirect real users to actual 4chan thread
            if (!isBotRequest)
                return { redirect: redirectUrl };
        }

        // Checks if the board is foolfuuka compliant
        const matchedArchive = ARCHIVES.find(archive => archive.board.includes(board));
        if (matchedArchive) {
            archiveName = matchedArchive.archive;
            apiDomain = matchedArchive.api;
        }

        // If 4chan is kill, foolfuuka fallback
        // or if 4chan alive, but comment dead
        if ((!response.ok && matchedArchive) || (response.ok && !foundPost && matchedArchive)) {
            const lookupPostId = postId ? cleanPostId : threadId;

            let shouldFetchArchive = true;

            if (response.ok && (lookupPostId === threadId))
            {
                // In this case, the thread is alive, but comment cannot be found on both the archives AND 4chan
                targetPost = data.posts[0]; // Return OP from 4chan
                shouldFetchArchive = false;

                // Passing only OP
                redirectUrl = `https://boards.4chan.org/${board}/thread/${threadId}`

                // Passing redirect if a real user
                if(!isBotRequest) {
                    return { redirect: redirectUrl };
                }
            }

            if (shouldFetchArchive)
            {
                const apiURL = `https://${apiDomain}/_/api/chan/post?board=${board}&num=${lookupPostId}`;
                const apiResponse = await fetch(apiURL, {
                    headers: {
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0 Safari/537.36",
                        "Accept": "application/json, text/plain, */*",
                        "Accept-Language": "en-US,en;q=0.9",
                        "Referer": `https://${apiDomain}/${board}/`,
                        "Sec-Fetch-Site": "same-origin",
                        "Sec-Fetch-Mode": "cors",
                        "Sec-Fetch-Dest": "empty",
                        "Sec-Ch-Ua": `"Chromium";v="123", "Not.A/Brand";v="24"`,
                        "Sec-Ch-Ua-Mobile": "?0",
                        "Sec-Ch-Ua-Platform": "\"Windows\"",
                    }
                });

                if (!apiResponse.ok) {
                    console.log(apiURL + " failed to response", apiResponse.status, apiResponse.statusText )
                    return { error: 'Thread not found', status: 404 };
                }

                redirectUrl = foundPost
                    ? `https://${apiDomain}/${board}/thread/${lookupPostId}/#q${cleanPostId}`
                    : `https://${apiDomain}/${board}/thread/${lookupPostId}`;

                const apiData = await apiResponse.json();

                // Edge case - when the API returns 200, but passing an error as API instead
                if (apiData.error) {
                    console.log(apiURL + " responded with " + apiData.error, apiResponse.status, apiResponse.statusText )
                    return { error: 'Thread not found', status: 404 };
                }

                // Passing redirect if a real user
                if(!isBotRequest) {
                    if (cleanPostId === threadId)
                        return { redirect: redirectUrl };
                    return { redirect: redirectUrl };
                }

                // Convert Foolfuuka API format to 4chan API format
                targetPost = {
                    no: parseInt(apiData.num),
                    sub: apiData.title_processed || apiData.title,
                    com: apiData.comment_processed || apiData.comment,
                    tim: apiData.media?.media ? apiData.media.media.split('.')[0] : null,
                    ext: apiData.media?.media ? '.' + apiData.media.media.split('.').pop() : null,
                    w: apiData.media?.media_w ? parseInt(apiData.media.media_w) : null,
                    h: apiData.media?.media_h ? parseInt(apiData.media.media_h) : null,
                    // Store original media link as fallback
                    apiMediaLink: apiData.media?.media_link || apiData.media?.thumb_link|| null
                };

                // Find the original thread ID
                threadId = apiData.thread_num;
                source = archiveName;
            }

        } else if (!response.ok) {
            console.log(apiURL + " failed to response", apiResponse.status, apiResponse.statusText )
            return { error: 'Thread not found', status: 404 };
        } else {
            targetPost = data.posts[0]; // Default to OP

            if (foundPost) {
                targetPost = foundPost;
            }
        }



        // Handle media URL - use archive link if available, otherwise construct 4chan URL
        let mediaUrl = null;
        if (targetPost.apiMediaLink) {
            mediaUrl = targetPost.apiMediaLink;

            // If it's from b4k archive, proxy it through our server
            if(config.allowsImageProxy) {
                const needsProxy = config.imageProxySrc.some(domain => mediaUrl.includes(domain));
                if (needsProxy) {
                    mediaUrl = `${baseUrl}/proxy/image?url=${encodeURIComponent(mediaUrl)}`;
                }
            }

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
        let commentWithLineBreaks;

        if(archiveName) { // If what we're parsing is from an archive, then only remove <br/>, no need for replacement
            commentWithLineBreaks = rawComment.replace(/<br\s*\/?>/gi, '');
        }
        else {
            commentWithLineBreaks = rawComment.replace(/<br\s*\/?>/gi, '\n');
        }
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
                        <title>${title}</title>
                        <meta property="og:title" content="${title}">
                        <meta property="og:description" content="${description}">
                        <meta property="og:type" content="${isVideo ? 'video.other' : 'article'}">
                        <meta property="og:site_name" content="${source}">
                        ${mediaTags}
                        <meta http-equiv="refresh" content="0;url=${redirectUrl}">
                        <meta property="theme-color" content=${isRedboard ? redboardColor : blueboardColor} />
                </head>
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