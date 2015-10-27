"use strict";

var VERSION = 4;

importScripts("src/serviceworker-cache-polyfill.js");

var log = console.log.bind(console);
var err = console.error.bind(console);
var swLocation = self.location;
var l = new URL(swLocation);
var dir = l.pathname.substring(0, l.pathname.lastIndexOf("serviceworker.js"));
var root = l.origin + dir;

var CORE_CACHE = VERSION + "-amp-up";
var ITEM_CACHE = VERSION + "-amp-up-article-cache";
var START_AMP_CONTENT = "<!--___START_AMP_CONTENT___-->";
var END_AMP_CONTENT = "<!--___END_AMP_CONTENT___-->";

self.addEventListener("install", function(e) {

  e.waitUntil(
    caches.open(CORE_CACHE).then(function(c) {
      return c.addAll([
        root + "src/shell.html",
        root + "src/styles.css",
        root + "src/webcomponents-lite.min.js",
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
        new Request("https://fonts.googleapis.com/css?family=Roboto:400,300,300italic,400italic,500,500italic,700,700italic", { mode: "no-cors" }),
        new Request("https://fonts.googleapis.com/css?family=Roboto+Mono:400,700", { mode: "no-cors" }),
        new Request("https://cdn.rawgit.com/webcomponents/webcomponentsjs/v0.7.15/webcomponents-lite.min.js", { mode: "no-cors"}),
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

var AMPOnly = function(text) {
  var end = text.lastIndexOf(END_AMP_CONTENT);
  text = text.substring(0, end);
  var start = text.indexOf(START_AMP_CONTENT);
  text = text.substring(start + (START_AMP_CONTENT).length);
  return text;
}

var postToMatchingWindow = function(text, url) {
  return clients.matchAll({ type: "window" }).then(function(clients) {
    clients.forEach(function(c) {
      log(c, url.indexOf(c.url));
      if (url.indexOf(c.url) == 0) {
        c.postMessage(text);
      }
    });
  });
}


var memoryCachedAMPs = new Map();

self.addEventListener("fetch", function(e) {
  // NOTE: we don't have support for e.request.mode == "navigate" yet,
  //  so this is really ugly
  var url = new URL(e.request.url);
  if(url.search.indexOf("nosw=1") >= 0) {
    return; // Fall through to the network
  }

  var AMPOnlyUrl = new URL(e.request.url);
  AMPOnlyUrl.search = "AMPOnly=1";

  if (e.request.url.indexOf(root + "demo/") >= 0) {
    if(url.href == AMPOnlyUrl.href) {
      // Look for it in the memory cache
      if (memoryCachedAMPs.has(AMPOnlyUrl.href)) {
        // log("We got it!", memoryCachedAMPs.get(AMPOnlyUrl.href));
        e.respondWith(memoryCachedAMPs.get(AMPOnlyUrl.href).clone());
        return;
      }

      // Look for it in the disk cache
      log("looking for it in the disk cache");

      // As a last resort, fetch it again
    }

    return e.respondWith(caches.open(CORE_CACHE).then(function(cache) {
      // Go to the network for hte latest
      e.waitUntil(fetch(e.request).then(function(response) {
        response.clone().text().then(function(responseText) {
          // Splice out the text of the response and post it over to the main
          // document.
          responseText = AMPOnly(responseText);
          // Put it in the memory and disk caches
          var syntheticResponse = new Response(responseText);
          memoryCachedAMPs.set(AMPOnlyUrl.href, syntheticResponse.clone());
          // Forward it on via postMessage
          return postToMatchingWindow(responseText, e.request.url).then(
            function() {
              // Write to the disk cache
              caches.open(ITEM_CACHE).then(function(cache) {
                return cache.put(AMPOnlyUrl.href,  syntheticResponse.clone());
              });
            },
            err
          );
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

