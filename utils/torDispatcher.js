// utils/torDispatcher.js
import { socksDispatcher } from "fetch-socks";
import { fetch as undiciFetch } from "undici";
import * as config from "../config.js";

// Issue: fetch is using a baked in Undici 7. This will fuck with Tor dispatcher because of mismatching.
// Instead, we use the later Undici 8 directly.
export { undiciFetch };

let torDispatcher = null;

export function getTorDispatcher() {
    if (!torDispatcher) {
        torDispatcher = socksDispatcher({
            type: 5,
            host: config.torProxyHost,
            port: config.torProxyPort,
        });
        console.log(`Tor proxy enabled for this request: routing through ${config.torProxyHost}:${config.torProxyPort}`);
    }
    return torDispatcher;
}