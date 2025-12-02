// config.js - Configuration and variables
// Networking
export const webPort = 3000;
export const isHTTPS = true;

// General Configuration
export const allowNSFWBoards = true;
export const blacklistedBoards = []; // If you don't want to proxy a board

// Image Proxying - Some image sources are blocked by services such as Discord. We bypass this by proxying.
export const allowsImageProxy = true;
export const imageProxySrc = ["arch-img.b4k.dev"];
export const imageProxyAge = 86400;                     // Request the services to cache for n seconds (default 24 hrs)