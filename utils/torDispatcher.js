// utils/torDispatcher.js
import { socksDispatcher } from "fetch-socks";
import * as config from "../config.js";

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