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

// Detect Discord's bot user agent specifically
// Discord uses its own UA when fetching embeds, distinct from generic bots
function isDiscordBot(userAgent) {
    return /Discordbot/i.test(userAgent);
}

// Build a Mastodon API v1-compatible status JSON object.
// Discord fetches this when it sees the Link: <url>; rel="alternate" header
// pointing to a Mastodon instance. This is what allows video + text together.
export function buildActivityStatus({ board, threadId, postId, targetPost, mediaUrl, source, isArchive, baseUrl }) {
    const isVideo = targetPost.ext && ['.webm', '.mp4', '.mov'].includes(targetPost.ext.toLowerCase());
    const isRedboard = NSFWBoards.includes(board);

    const rawComment = targetPost.com || '';
    const commentText = isArchive
        ? rawComment.replace(/<br\s*\/?>/gi, '')
        : rawComment.replace(/<br\s*\/?>/gi, '\n');
    const description = sanitizeHtml(commentText);

    const title = postId
        ? `Post #${postId} in /${board.toLowerCase()}/ Thread #${threadId}`
        : (targetPost.sub || `/${board.toLowerCase()}/ Thread #${threadId}`);

    const sourceEmbed = `${source} - /${board.toLowerCase()}/`;
    const author = (targetPost.name || 'Anonymous') + (targetPost.trip ? ' - ' + targetPost.trip : '');

    // Build the content field — Mastodon uses HTML here, Discord renders it as the post body
    const contentHtml = `<p><strong>${escapeHtml(title)}</strong></p>` +
        (description ? `<p>${escapeHtml(description)}</p>` : '');

    // Build media_attachments array in Mastodon format
    const mediaAttachments = [];
    if (mediaUrl) {
        // For videos, use thumbnail as preview_url — must be a JPEG, not the video URL itself.
        // 4chan stores thumbnails at {tim}s.jpg for live threads.
        // Discord uses preview_url as the thumbnail image and url as the playable source.
        const thumbUrl = (!targetPost.apiMediaLink && targetPost.tim)
            ? `https://i.4cdn.org/${board}/${targetPost.tim}s.jpg`
            : (targetPost.thumbLink || null);

        const attachment = {
            id: String(targetPost.no),
            type: isVideo ? 'gifv' : 'image', // 'gifv' is Mastodon's type for autoplaying video — Discord renders it with a play button
            url: mediaUrl,
            preview_url: thumbUrl || mediaUrl,
            remote_url: null,
            text_url: mediaUrl,
            meta: {
                original: {
                    width: targetPost.w || 640,
                    height: targetPost.h || 480,
                    frame_rate: '25/1',
                    duration: null,
                    bitrate: null,
                },
                small: {
                    width: targetPost.w || 640,
                    height: targetPost.h || 480,
                    size: `${targetPost.w || 640}x${targetPost.h || 480}`,
                    aspect: (targetPost.w && targetPost.h) ? targetPost.w / targetPost.h : 1.778,
                },
            },
            description: null,
            blurhash: null,
        };

        mediaAttachments.push(attachment);
    }

    const postUrl = postId
        ? `${baseUrl}/${board}/thread/${threadId}/p${postId}`
        : `${baseUrl}/${board}/thread/${threadId}`;

    // Mastodon v1 Status object — Discord reads these fields
    return {
        id: String(targetPost.no),
        created_at: new Date().toISOString(),
        in_reply_to_id: null,
        in_reply_to_account_id: null,
        sensitive: isRedboard,
        spoiler_text: '',
        visibility: 'public',
        language: 'en',
        uri: postUrl,
        url: postUrl,
        replies_count: 0,
        reblogs_count: 0,
        favourites_count: 0,
        content: contentHtml,
        reblog: null,
        application: null,
        account: {
            id: String(targetPost.no),
            username: author.replace(/\s/g, '_'),
            acct: author.replace(/\s/g, '_'),
            display_name: author,
            locked: false,
            created_at: new Date().toISOString(),
            followers_count: 0,
            following_count: 0,
            statuses_count: 0,
            note: sourceEmbed,
            url: postUrl,
            avatar: `${baseUrl}/favicon.ico`,
            avatar_static: `${baseUrl}/favicon.ico`,
            header: '',
            header_static: '',
            emojis: [],
            fields: [],
        },
        media_attachments: mediaAttachments,
        mentions: [],
        tags: [],
        emojis: [],
        card: null,
        poll: null,
    };
}

export async function handleThreadRequest(request, { board, threadId, postId = null, baseUrl, isoembed = false, isActivity = false })
{
    const isRedboard = NSFWBoards.includes(board);


    if (!config.allowNSFWBoards && isRedboard || config.blacklistedBoards.includes(board)){
        return { error: 'This board is not supported', status: 403 };
    }
    const userAgent = request.headers.get?.('User-Agent') || request.get?.('User-Agent') || '';

    // Check if it's Discord specifically (for Activity embed path)
    const isDiscord = isDiscordBot(userAgent);
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

        let isArchive = true;

        // Checking 4chan API if it's still alive
        if (response.ok) {
            data = await response.json();
        }

        // Remove any prefix before digits if it exists on the comment ID
        if (postId) {
            cleanPostId = String(postId).replace(/^\D+/, '');
        }

        // If looking for a comment in a thread, Check if comment exists on 4chan API
        if (postId && response.ok) {
            foundPost = data.posts.find(post => post.no === parseInt(cleanPostId));
            if(foundPost) {
                redirectUrl = `https://boards.4chan.org/${board}/thread/${threadId}#p${cleanPostId}`;
                if (!isBotRequest)
                    return { redirect: redirectUrl };

                isArchive = false;
            }
        }

        // If looking for OP only, and is alive
        if (!postId && response.ok) {
            redirectUrl = `https://boards.4chan.org/${board}/thread/${threadId}`;
            // Redirect real users to actual 4chan thread
            if (!isBotRequest)
                return { redirect: redirectUrl };

            isArchive = false;
        }

        // Checks if the board is foolfuuka compliant
        const matchedArchive = ARCHIVES.find(archive => archive.board.includes(board));
        if (matchedArchive) {
            archiveName = matchedArchive.archive;
            apiDomain = matchedArchive.api;
        }

        // If 4chan is kill, foolfuuka fallback
        // or if 4chan alive, but is targeting a comment, but le comment dead
        if ((!response.ok && matchedArchive) || (response.ok && postId && !foundPost && matchedArchive)) {
            const lookupPostId = postId ? cleanPostId : threadId;

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

            let shouldFetchArchive = true;

            // Check archive for the comment as well
            if (response.ok && (lookupPostId !== threadId)) // 4chan thread is alive, post ID is not the same as thread
            {
                // Check the post if it exists in the archive
                if (!apiResponse.ok) {
                    // In this case, the thread is alive, but comment cannot be found on both the archives AND 4chan
                    targetPost = data.posts[0]; // Return OP from 4chan
                    shouldFetchArchive = false;

                    // Passing only OP
                    redirectUrl = `https://boards.4chan.org/${board}/thread/${threadId}`

                    // Passing redirect if a real user
                    if(!isBotRequest) {
                        return { redirect: redirectUrl };
                    }

                    isArchive = false;
                }
            }

            // Otherwise, if the thread is dead, or is alive but the comment is dead but archived, we return the archive
            if (shouldFetchArchive)
            {
                if (!apiResponse.ok) {
                    console.log(apiURL + " failed to response", apiResponse.status, apiResponse.statusText )
                    return { error: 'Thread not found', status: 404 };
                }

                redirectUrl = cleanPostId
                    ? `https://${apiDomain}/${board}/thread/${threadId}/#q${cleanPostId}`
                    : `https://${apiDomain}/${board}/thread/${threadId}`;

                const apiData = await apiResponse.json();

                // Edge case - when the API returns 200, but passing an error as API instead
                if (apiData.error) {
                    console.log(apiURL + " responded with " + apiData.error, apiResponse.status, apiResponse.statusText )
                    return { error: 'Thread not found', status: 404 };
                }

                // Passing redirect if a real user
                if(!isBotRequest) {
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
                    apiMediaLink: apiData.media?.media_link || apiData.media?.thumb_link|| null,
                    // Store thumb separately so we can use it as og:image for video posts with text
                    thumbLink: apiData.media?.thumb_link || null,
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
            ? `Post #${postId} in /${board.toLowerCase()}/ Thread #${threadId}`
            : (targetPost.sub || `/${board.toLowerCase()}/ Thread #${threadId}`);

        const sourceEmbed = `${source} - /${board.toLowerCase()}/`
        const author = ( targetPost.name ? targetPost.name : "Anonymous") + (targetPost.trip ? " - " + targetPost.trip : "")

        if (isoembed) // If is for oembed then we can do early termination
        {
            const rawComment = targetPost.com || '';
            const commentText = isArchive
                ? rawComment.replace(/<br\s*\/?>/gi, '')
                : rawComment.replace(/<br\s*\/?>/gi, '\n');

            // For video posts use the thumbnail, not the video URL itself
            const thumbUrl = targetPost.thumbLink || (
                targetPost.tim ? `https://i.4cdn.org/${board}/${targetPost.tim}s.jpg` : mediaUrl
            );

            return {
                data: {
                    author: author,
                    providerName: sourceEmbed,
                    thumbnailUrl: isVideo ? thumbUrl : mediaUrl, // fixed: was always mediaUrl (broke for video)
                    thumbnailWidth: targetPost.w,
                    thumbnailHeight: targetPost.h,
                    title: title,
                    description: sanitizeHtml(commentText), // added: lets oEmbed consumers show the post text
                }
            }
        }

        // If Discord is fetching the Activity endpoint, return Mastodon-compatible JSON.
        // This is what allows video + text to coexist in Discord embeds.
        if (isActivity)
        {
            const activityStatus = buildActivityStatus({
                board, threadId, postId, targetPost, mediaUrl, source, isArchive, baseUrl
            });
            return { activity: activityStatus };
        }

        // Convert <br> tags to newlines before sanitizing
        const rawComment = targetPost.com || '';
        let commentWithLineBreaks;

        if(isArchive) { // If what we're parsing is from an archive, then only remove <br/>, no need for replacement
            commentWithLineBreaks = rawComment.replace(/<br\s*\/?>/gi, '');
        }
        else {
            commentWithLineBreaks = rawComment.replace(/<br\s*\/?>/gi, '\n');
        }
        const description = sanitizeHtml(commentWithLineBreaks);

        //console.log(description);

        // Generate appropriate meta tags based on media type
        let mediaTags = '';
        if (mediaUrl) {
            if (isVideo) {
                // For video posts with text: use thumbnail as og:image so description shows on Telegram etc.
                // Discord bypasses this entirely via the Activity embed path (Link header).
                // For video-only posts (no comment): use full og:video embed.
                const thumbUrl = targetPost.thumbLink || (
                    targetPost.tim ? `https://i.4cdn.org/${board}/${targetPost.tim}s.jpg` : null
                );

                if (description && description.length > 0 && thumbUrl) {
                    // Image fallback — description will be visible on Telegram and other OG consumers
                    mediaTags = `
                        <meta property="og:image" content="${thumbUrl}">
                        <meta property="og:image:width" content="${targetPost.w || ''}">
                        <meta property="og:image:height" content="${targetPost.h || ''}">
                        <meta name="twitter:card" content="summary_large_image">
                        <meta name="twitter:image" content="${thumbUrl}">`;
                } else {
                    // No text — full video embed is fine
                    mediaTags = `
                        <meta property="og:video" content="${mediaUrl}">
                        <meta property="og:video:type" content="video/${targetPost.ext.slice(1)}">
                        <meta property="og:video:width" content="${targetPost.w || 640}">
                        <meta property="og:video:height" content="${targetPost.h || 480}">
                        <meta name="twitter:card" content="player">
                        <meta name="twitter:player" content="${mediaUrl}">
                        <meta name="twitter:player:width" content="${targetPost.w || 640}">
                        <meta name="twitter:player:height" content="${targetPost.h || 480}">`;
                }
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

        const oembed= `${baseUrl}/oembed?board=${board}&thread=${threadId}${postId ? '&post=' + postId : ''}`

        // The Activity endpoint URL — Discord fetches this as a Mastodon API v1 status,
        // which is what allows both video and text to appear in the Discord embed simultaneously.
        const activityUrl = `${baseUrl}/activity?board=${board}&thread=${threadId}${postId ? '&post=' + postId : ''}`;

        const html = `
                <!DOCTYPE html>
                <html lang="en">
                <head>
                        <meta charset="utf-8">
                        <title>${title}</title>

                        <meta property="og:title" content="${title}">
                        <meta property="og:description" content="${description}">
                        <meta property="og:type" content="${isVideo ? 'video.other' : 'article'}">
                        <meta property="og:site_name" content="${sourceEmbed}">
                        ${mediaTags}
                        <meta http-equiv="refresh" content="0;url=${redirectUrl}">
                        <meta property="theme-color" content=${isRedboard ? redboardColor : blueboardColor} />

                        <link rel="alternate" href="${oembed}" type="application/json+oembed"
                </head>
                </html>`;

        // Pass activityUrl and isDiscord back so index.js can set the Link header for Discord bots
        return { html, activityUrl, isDiscord };
    } catch (err) {
        console.error(err);
        return { error: 'Error fetching thread', status: 500 };
    }
}

// 4chan and foolfuuka already processed enough, we only need to strip away the spans from greentexts
function sanitizeHtml(html) {
    return html
        .replace(/<[^>]*>/g, '')
        .trim()
}

// Used when building Activity embed HTML content — prevents XSS in the Mastodon JSON content field
function escapeHtml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}