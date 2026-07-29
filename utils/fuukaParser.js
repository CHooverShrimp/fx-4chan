// utils/fuukaParser.js
// Fuuka's post markup (see https://github.com/eksopl/fuuka/blob/master/templates.pl)
// looks roughly like this per post:
//
//   OP:     <div id="p<no>"> ... </div>
//   Reply:  <td class="reply" id="p<no>"> ... </td>
//   Sub-reply (ghost/internal): <td class="subreply" id="p<no>_<subnum>"> ... </td>
//
// Each post block contains, in order:
//   File: <size>, <w>x<h>, <original filename><!-- hash -->
//   <a href="FULL_IMAGE"><img class="thumb" src="THUMB" ...></a>
//   <span class="postername">NAME</span>
//   <span class="postertrip">TRIP</span>
//   <span class="posttime" title="EPOCH_MS">DATE STRING</span>
//   <a class="js" href="...">No.<no></a>
//   <span class="filetitle">SUBJECT</span>   (OP only, when a subject was set)
//   <blockquote><p>COMMENT (raw, with <br/> and quote links)</p></blockquote>
//
// NOTE: the number shown after "File:" is the *original* upload filename,
// not the value used in the actual media URL - so we always derive
// tim/ext from the real image URL rather than that filename text.
//
// This module is deliberately archive-agnostic: every function takes the
// archive's api domain (e.g. "warosu.org") as a parameter rather than
// hardcoding one, so it works for any board running the same Fuuka codebase.

const FETCH_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
};

function stripTags(str) {
    return (str || "")
        .replace(/<[^>]*>/g, "")
        .replace(/&nbsp;/gi, " ")
        .trim();
}

// Pull "no", "sub", "com", "w", "h", "tim", "ext", "apiMediaLink", "name", "trip"
// out of a single post's HTML segment.
function parsePostSegment(segment, no, subnum, apiDomain) {
    let w = null, h = null;
    const fileMatch = segment.match(/File:\s*[\d.]+\s*\w+,\s*(\d+)x(\d+),/);
    if (fileMatch) {
        w = parseInt(fileMatch[1]);
        h = parseInt(fileMatch[2]);
    }

    // Prefer the full-size image link that wraps the thumbnail; fall back
    // to the thumbnail itself if no wrapping anchor is found (e.g. text-only
    // posts never have either, so mediaUrl stays null).
    let mediaUrl = null;
    const fullLinkMatch = segment.match(/<a[^>]+href="([^"]+)"[^>]*>\s*<img class="thumb"/);
    if (fullLinkMatch) {
        mediaUrl = fullLinkMatch[1];
    } else {
        const thumbMatch = segment.match(/<img class="thumb" src="([^"]+)"/);
        if (thumbMatch) mediaUrl = thumbMatch[1];
    }

    // Normalize protocol-relative / relative URLs against the archive's own domain
    if (mediaUrl && mediaUrl.startsWith("//")) {
        mediaUrl = "https:" + mediaUrl;
    } else if (mediaUrl && mediaUrl.startsWith("/")) {
        mediaUrl = `https://${apiDomain}${mediaUrl}`;
    }

    let tim = null, ext = null;
    if (mediaUrl) {
        const filename = mediaUrl.split("/").pop().split("?")[0];
        const dot = filename.lastIndexOf(".");
        if (dot !== -1) {
            tim = filename.slice(0, dot);
            ext = filename.slice(dot); // includes the leading dot
        }
    }

    let name = "Anonymous";
    const nameMatch = segment.match(/<span class="postername[^"]*">([\s\S]*?)<\/span>/);
    if (nameMatch) {
        const cleaned = stripTags(nameMatch[1]);
        if (cleaned) name = cleaned;
    }

    let trip = null;
    const tripMatch = segment.match(/<span class="postertrip[^"]*">([\s\S]*?)<\/span>/);
    if (tripMatch) {
        const cleaned = stripTags(tripMatch[1]);
        if (cleaned) trip = cleaned;
    }

    let sub = null;
    const subMatch = segment.match(/<span class="filetitle">([\s\S]*?)<\/span>/);
    if (subMatch) {
        const cleaned = stripTags(subMatch[1]);
        if (cleaned) sub = cleaned;
    }

    let com = "";
    const comMatch = segment.match(/<blockquote>\s*<p>([\s\S]*?)<\/p>\s*<\/blockquote>/);
    if (comMatch) com = comMatch[1];

    return {
        no: parseInt(no),
        subnum: subnum ? parseInt(subnum) : 0,
        sub,
        com,
        name,
        trip,
        tim,
        ext,
        w,
        h,
        apiMediaLink: mediaUrl,
    };
}

// Splits the full thread page HTML into per-post segments using the id="pNNN"
// / id="pNNN_M" markers that Fuuka puts on every post container, then parses
// each one individually. `apiDomain` is only used to resolve any relative
// media URLs against the right host.
export function parseFuukaThreadHtml(html, apiDomain) {
    const idRegex = /id="p(\d+)(?:_(\d+))?"/g;
    const markers = [...html.matchAll(idRegex)];

    if (markers.length === 0) return null;

    const posts = markers.map((match, i) => {
        const start = match.index;
        const end = i + 1 < markers.length ? markers[i + 1].index : html.length;
        const segment = html.slice(start, end);
        return parsePostSegment(segment, match[1], match[2], apiDomain);
    });

    return posts;
}

// Fetches and parses a thread from any Fuuka-based archive. Returns null if
// the thread itself doesn't exist / the archive returned a non-OK response.
export async function fetchFuukaThread(apiDomain, board, threadId) {
    const url = `https://${apiDomain}/${board}/thread/${threadId}`;

    const response = await fetch(url, { headers: FETCH_HEADERS });

    if (!response.ok) {
        console.log(url + " failed to respond", response.status, response.statusText);
        return null;
    }

    const html = await response.text();
    const posts = parseFuukaThreadHtml(html, apiDomain);

    if (!posts) {
        console.log(url + " responded but no posts could be parsed");
        return null;
    }

    return posts;
}

// Finds a specific post number within a parsed post list. If duplicate "no"
// values exist (ghost / internal sub-replies reuse the parent's post number
// in some themes), the top-level (subnum === 0) post is preferred.
export function findFuukaPost(posts, postId) {
    if (!posts || posts.length === 0) return null;

    const targetNo = parseInt(postId);
    const matches = posts.filter(p => p.no === targetNo);

    if (matches.length === 0) return null;

    return matches.find(p => p.subnum === 0) || matches[0];
}

// Convenience wrapper: fetch + find in one call.
export async function getFuukaPost(apiDomain, board, threadId, postId = null) {
    const posts = await fetchFuukaThread(apiDomain, board, threadId);
    if (!posts) return null;

    const lookupId = postId || threadId;
    return findFuukaPost(posts, lookupId);
}