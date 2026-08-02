// utils/foolfuukaParser.js
import * as config from "../config.js";
import { getTorDispatcher, undiciFetch } from "./torDispatcher.js";

const FETCH_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Sec-Fetch-Site": "same-origin",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Dest": "empty",
    "Sec-Ch-Ua": `"Chromium";v="123", "Not.A/Brand";v="24"`,
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": "\"Windows\"",
};

// Converts a single Foolfuuka `/_/api/chan/post` response body into the same
// post shape used elsewhere (no, sub, com, tim, ext, w, h, apiMediaLink),
// so callers don't need to know which archive tech a post came from.
export function parseFoolfuukaPost(apiData) {
    return {
        no: parseInt(apiData.num),
        sub: apiData.title_processed || apiData.title,
        com: apiData.comment_processed || apiData.comment,
        tim: apiData.media?.media ? apiData.media.media.split('.')[0] : null,
        ext: apiData.media?.media ? '.' + apiData.media.media.split('.').pop() : null,
        w: apiData.media?.media_w ? parseInt(apiData.media.media_w) : null,
        h: apiData.media?.media_h ? parseInt(apiData.media.media_h) : null,
        // Store original media link as fallback
        apiMediaLink: apiData.media?.media_link || apiData.media?.thumb_link || null,
    };
}

// Fetches a single post from a Foolfuuka-based archive's JSON API.
//
// Returns:
//   { ok: true, post, threadId }  on success
//   { ok: false, status, statusText }  if the HTTP request failed
//   { ok: false, apiError: true }  if the archive responded 200 but with
//                                  an `error` field instead of post data
export async function fetchFoolfuukaPost(apiDomain, board, postId, useTorProxy = false) {
    const apiURL = `https://${apiDomain}/_/api/chan/post?board=${board}&num=${postId}`;

    const fetchOptions = {
        headers: {
            ...FETCH_HEADERS,
            "Referer": `https://${apiDomain}/${board}/`,
        }
    };

    const useDispatcher = useTorProxy && config.enableTorProxy;
    if (useDispatcher) {
        fetchOptions.dispatcher = getTorDispatcher();
    }
    const doFetch = useDispatcher ? undiciFetch : fetch;

    const response = await doFetch(apiURL, fetchOptions);

    if (!response.ok) {
        console.log(apiURL + " failed to respond", response.status, response.statusText);
        return { ok: false, status: response.status, statusText: response.statusText };
    }

    let apiData;
    try {
        apiData = await response.json();
    } catch (err) {
        console.log(apiURL + " responded 200 but body was not valid JSON");
        return { ok: false, apiError: true };
    }

    // Edge case - when the API returns 200, but passing an error as API instead
    if (apiData.error) {
        console.log(apiURL + " responded with " + apiData.error, response.status, response.statusText);
        return { ok: false, apiError: true };
    }

    return {
        ok: true,
        post: parseFoolfuukaPost(apiData),
        threadId: apiData.thread_num,
    };
}