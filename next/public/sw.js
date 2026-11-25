// Minimal service worker: makes the app installable. Pages always come from the network,
// so students and the teacher never see an old version. Offline results are handled by bridge.js.
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', function () {});
