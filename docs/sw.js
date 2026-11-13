/* Site cache: network-first pages, stale-while-revalidate assets. */
var CACHE = "site-cache-v1";
var FONT_HOSTS = ["fonts.googleapis.com","fonts.gstatic.com"];
var SKIP_PATH = "/admin/";
self.addEventListener('install', function() {
  self.skipWaiting();
});
self.addEventListener('activate', function(event) {
  event.waitUntil(caches.keys().then(function(keys) {
    return Promise.all(keys.filter(function(key) { return key !== CACHE; }).map(function(key) { return caches.delete(key); }));
  }).then(function() { return self.clients.claim(); }));
});
function remember(request, response) {
  if (response && (response.ok || response.type === 'opaque')) {
    var copy = response.clone();
    caches.open(CACHE).then(function(cache) { cache.put(request, copy); });
  }
  return response;
}
self.addEventListener('fetch', function(event) {
  var request = event.request;
  if (request.method !== 'GET') {
    return;
  }
  var url = new URL(request.url);
  var sameOrigin = url.origin === self.location.origin;
  if (!sameOrigin && FONT_HOSTS.indexOf(url.hostname) === -1) {
    return;
  }
  if (sameOrigin && url.pathname.indexOf(SKIP_PATH) !== -1) {
    return;
  }
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(function(response) {
      return remember(request, response);
    }).catch(function() {
      return caches.match(request);
    }));
    return;
  }
  event.respondWith(caches.match(request).then(function(cached) {
    var network = fetch(request).then(function(response) {
      return remember(request, response);
    });
    if (cached) {
      network.catch(function() {});
      return cached;
    }
    return network;
  }));
});
