"use strict";

var VERSION = 3;

importScripts("src/serviceworker-cache-polyfill.js");

var log = console.log.bind(console);
var err = console.error.bind(console);
var swLocation = self.location;
var l = new URL(swLocation);
var dir = l.pathname.substring(0, l.pathname.lastIndexOf("serviceworker.js"));
var root = l.origin + dir;

var CORE_CACHE = VERSION + "-amp-up";
var ITEM_CACHE = VERSION + "-amp-up-items";

self.addEventListener("install", function(e) {

  e.waitUntil(
    caches.open(CORE_CACHE).then(function(c) {
      return c.addAll([
        root + "src/shell.html",
        root + "src/styles.css",
        root + "src/elements.v.html",
        root + "src/elements.v.js",
        new Request("https://cdn.ampproject.org/v0/amp-audio-0.1.js", { mode: "no-cors" }),
        new Request("https://cdn.ampproject.org/v0/amp-anim-0.1.js", { mode: "no-cors" }),
        new Request("https://cdn.ampproject.org/v0/amp-carousel-0.1.js", { mode: "no-cors" }),
        new Request("https://cdn.ampproject.org/v0/amp-iframe-0.1.js", { mode: "no-cors" }),
        new Request("https://cdn.ampproject.org/v0/amp-image-lightbox-0.1.js", { mode: "no-cors" }),
        new Request("https://cdn.ampproject.org/v0/amp-instagram-0.1.js", { mode: "no-cors" }),
        new Request("https://cdn.ampproject.org/v0/amp-fit-text-0.1.js", { mode: "no-cors" }),
        new Request("https://cdn.ampproject.org/v0/amp-twitter-0.1.js", { mode: "no-cors" }),
        new Request("https://cdn.ampproject.org/v0/amp-youtube-0.1.js", { mode: "no-cors" }),
        new Request("https://cdn.ampproject.org/v0.js", { mode: "no-cors" }),
        new Request("https://fonts.googleapis.com/css?family=Questrial", { mode: "no-cors" }),
        new Request("https://fonts.gstatic.com/s/questrial/v6/MYWJ4lYm5dbZ1UBuYox79JBw1xU1rKptJj_0jans920.woff2", { mode: "no-cors" }),
        new Request("https://fonts.googleapis.com/css?family=Roboto:400,300,300italic,400italic,500,500italic,700,700italic", { mode: "no-cors" }),
        new Request("https://fonts.googleapis.com/css?family=Roboto+Mono:400,700", { mode: "no-cors" }),
      ]).then(
        function() {
          return self.skipWaiting();
        },
        err
      );
    }, err)
  )
});

self.addEventListener("activate", function(e) {
  var cacheWhitelist = [ CORE_CACHE, ITEM_CACHE ];
  e.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

var lastBody = "";

self.addEventListener("fetch", function(e) {
  if (e.request.url.indexOf(root + "SHOW_ME_WHAT_YOU_GOT") >= 0) {
    // FIXME(slightlyoff): lifetime HACK
    e.respondWith(new Response(lastBody));
    return;
  }

  if (e.request.url.indexOf(root + "demo/") >= 0) {
    return e.respondWith(caches.open(CORE_CACHE).then(function(cache) {
      // Go to the network for hte latest
      e.waitUntil(fetch(e.request).then(function(response) {
        response.clone().text().then(function(responseText) {
          // Splice out the text of the response and post it over to the main
          // document.
          var end = responseText.lastIndexOf("</body>");
          responseText = responseText.substring(0, end);
          var start = responseText.indexOf("<body>");
          responseText = responseText.substring(start + ("<body>").length);
          lastBody = responseText;
        }, err);
      }, err));
      // Meanwhile, get the party started by sending back the app shell
      return cache.match(root + "src/shell.html");
    }));
  }
  if (e.request.url.indexOf("elements.v.js") >= 0) {
    return e.respondWith(caches.open(CORE_CACHE).then(function(cache) {
      return cache.match(root + "src/elements.v.js");
    }));
  }

  e.respondWith(
    caches.match(e.request).then(function(response) {
      return response || fetch(e.request);
    })
  );
});

