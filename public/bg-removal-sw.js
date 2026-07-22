// Stub for browser extensions that request this file — avoids slow 404 compiles in dev.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", () => self.clients.claim());
