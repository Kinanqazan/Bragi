# Google Cast audio from the Navidrome PWA: reassessment

Reassessment date: 2026-08-28

Scope: a Navidrome PWA can discover and connect to a Google Nest speaker, and
the Default Media Receiver displays the selected track metadata, but remote
audio does not start. This document reassesses the architecture and the missing
"Stage 2" question from current primary sources and the current repository.

## Executive conclusion

The missing Stage 2 is **not the cause of connection-with-no-audio**. The code
already performs the minimum media stage documented by Google: it gets the
current `CastSession`, creates `MediaInfo` and `LoadRequest`, and calls
`CastSession.loadMedia()`. The receiver screenshot showing Navidrome's title and
artwork independently confirms that this load path was reached. A later stage
is still needed for a complete product (queue, next/previous, refresh/rejoin,
and robust state synchronization), but none of those features is required to
play the first URL.

The most likely failure boundary is therefore the URL that the Nest must fetch
itself. The current sender derives it from `window.location.origin`, so an app
opened at `https://navidrome.lan` sends the Nest an authenticated
`https://navidrome.lan/rest/...` URL. That can work only if the Nest can resolve
that name, route to it, and accept its TLS chain. A browser trusting Caddy's
internal CA does not establish that the Nest trusts it.

The cleanest internal-only architecture is:

1. Keep the installed PWA and Web Sender on HTTPS.
2. Keep Google's Default Media Receiver for the first reliable version.
3. Add one server-generated, short-lived, track-scoped Cast media URL.
4. Advertise that URL from a configurable receiver-reachable base address,
   preferably LAN HTTP (hostname or IP), rather than always copying the PWA's
   HTTPS origin.
5. Serve a conservative MP3 baseline with correct `Content-Type`, `HEAD`, byte
   ranges/`206`, `Content-Length`, and CORS behavior.
6. Add queue and session-resume behavior only after single-track playback is
   proven.

Google explicitly documents that a published Web Receiver must be HTTPS while
media content loaded by it may be served over HTTP. It also says an internal
NAT address is valid and `localhost` is not. This makes an internal HTTP media
endpoint a supported way to avoid private-CA uncertainty without buying a
public domain. It can use the same hostname as the PWA if the Nest resolves it;
an advertised LAN IP is the more deterministic fallback.

Sources: [Web Sender setup](https://developers.google.com/cast/docs/web_sender),
[Web Sender integration](https://developers.google.com/cast/docs/web_sender/integrate),
[Cast registration and URL rules](https://developers.google.com/cast/docs/registration),
[CastSession reference](https://developers.google.com/cast/docs/reference/web_sender/cast.framework.CastSession).

## Sender choice: Web versus native

For an installed PWA, Google's **Web Sender SDK** is the correct implementation.
Google supports it in Cast-capable browsers on macOS, Windows, Linux, ChromeOS,
and Android, and separately provides native Android and iOS SDKs. An installed
PWA does not become a native Android/iOS Cast sender merely by being installed.

- Android/desktop PWA: use Web Sender in a supported stable browser. Google
  recommends testing stable Chrome; Brave is not named as a supported target.
- iOS browser/PWA: Google explicitly says casting is not supported in iOS
  Chrome. A dependable iOS solution requires a native iOS app using the iOS
  Cast SDK.
- A native Android app provides deeper platform integration, notifications,
  lock-screen controls, and lifecycle handling, but it does **not** remove the
  requirement that the receiver can fetch the media URL.

Sources: [Web Sender platforms](https://developers.google.com/cast/docs/web_sender),
[Android Sender SDK](https://developers.google.com/cast/docs/android_sender),
[iOS Sender SDK](https://developers.google.com/cast/docs/ios_sender),
[sender UX requirements](https://developers.google.com/cast/docs/design_checklist/sender).

## Default Media Receiver versus a custom receiver

The Default Media Receiver is sufficient to prove and operate basic MP3 audio
when it receives a directly playable URL. It is Google-hosted, needs no app
registration, cannot be customized, and loads the URL supplied by the sender.

Google describes it as appropriate only for very limited playback and says a
Custom Web Receiver is appropriate when authentication, authorization,
analytics, or other custom business logic is required. A custom receiver could:

- exchange an opaque media ID plus credential for a playable URL;
- add authorization headers or credentialed request handling;
- provide receiver-side logs, queue logic, and custom resume behavior.

It would **not** fix an unresolvable hostname, an untrusted certificate, or a
malformed media response. It also adds application registration and a receiver
page that must be hosted over HTTPS for publication. Therefore it is not the
best first fix for this private PWA; first make one signed URL play through the
Default Receiver. Reconsider a custom receiver only if the desired
authentication cannot be represented safely by a short-lived URL or if richer
receiver-side behavior becomes necessary.

Sources: [Cast architecture and receiver selection](https://developers.google.com/cast/docs/overview),
[Web Receiver types](https://developers.google.com/cast/docs/web_receiver),
[Custom Web Receiver core features](https://developers.google.com/cast/docs/web_receiver/core_features).

## Media URL contract

### Reachability, DNS, and TLS

The receiver, not the sender browser, loads the media URL. A successful Cast
session proves only the control connection. It does not prove that the Nest can
resolve or reach `navidrome.lan`, or validate its HTTPS certificate.

A same-host internal HTTPS URL **can work in principle** if all three conditions
hold. It is not a reliable default with a private/internal CA because the Cast
documentation does not provide a supported way to install that CA on a Nest.
Google also warns that certificate chains requiring an extra CA download may
fail on Android-based receiver platforms. This is why the architecture should
allow a receiver-advertised HTTP base URL rather than hard-code or always infer
the PWA origin.

Source: [Custom Receiver certificate guidance](https://developers.google.com/cast/docs/web_receiver/core_features),
[Cast registration and internal-address/HTTP-media rules](https://developers.google.com/cast/docs/registration).

### CORS, MIME type, and byte ranges

Google requires correct media response headers and specifically calls out
`Content-Type`, `Accept-Encoding`, and `Range`. It requires CORS for adaptive
media and for simple media with tracks, and says wildcard
`Access-Control-Allow-Origin` cannot be used for protected media.

The current repository now reflects a non-empty request origin instead of
returning wildcard CORS, so the old report's claim that wildcard CORS was the
leading repository mismatch is stale. The actual Nest response still needs to
be observed.

Navidrome's direct seekable path uses Go's `http.ServeContent`, which supports
range requests. A first-time/transcoded stream can be non-seekable and advertises
`Accept-Ranges: none`. For the reliability target, the initial Cast endpoint
should prefer a supported direct file or a seekable cached MP3 and correctly
answer `HEAD` and `Range` requests, including `206 Partial Content` when a byte
range is requested.

Sources: [Google Cast CORS requirements](https://developers.google.com/cast/docs/web_sender/advanced),
[supported Cast media](https://developers.google.com/cast/docs/media),
[receiver error and HTTP status guidance](https://developers.google.com/cast/docs/web_receiver/error_codes),
[current CORS middleware](../../server/middlewares.go),
[current Navidrome stream serving](../../core/stream/media_streamer.go).

### Authentication

The Default Receiver does not inherit the PWA's cookies, local storage, or
Navidrome authorization header. The current implementation works around that by
placing Subsonic `u`, `t`, and `s` parameters in the media URL; Navidrome accepts
those parameters. This is receiver-usable, but it is broader and longer-lived
than necessary and exposes authentication material in a URL.

The recommended endpoint should issue an opaque HMAC/JWT-style token scoped to:

- one authenticated user;
- one media ID and permitted format;
- a short expiry;
- streaming only, not general Subsonic API access.

The Nest then needs only a URL. No cookie or custom request header is required.
If the server must instead attach authorization headers dynamically, that is a
reason to introduce a Custom Web Receiver.

Sources: [Custom Receiver authentication interception](https://developers.google.com/cast/docs/web_receiver/core_features),
[Navidrome external/Subsonic authentication](https://navidrome.org/docs/usage/integration/authentication/),
[current Subsonic URL generation](../../ui/src/subsonic/index.js),
[current Subsonic credential validation](../../server/subsonic/middlewares.go).

## Session resume and Stage 2

Google's `ORIGIN_SCOPED` auto-join policy can reconnect the same web origin to an
existing receiver session. Google also documents explicit persistence of the
session ID and `requestSessionById(sessionId)` when the sender needs to rejoin
without reloading media.

The current implementation already has:

- SDK initialization and Default Receiver launch;
- `ORIGIN_SCOPED` session setup;
- current-track URL resolution;
- `MediaInfo`, metadata, `LoadRequest`, and `loadMedia()`;
- basic remote play/pause/seek/volume bindings;
- a guarded local-to-remote handoff.

It does not yet have a complete Stage 2:

- `next()` and `previous()` return `false`, and it does not load the full queue;
- it does not persist/rejoin by session ID or adopt existing receiver media
  cleanly after a PWA refresh;
- connection currently reloads the sender's local track rather than treating
  the receiver media session as authoritative;
- it pushes the local default volume when the active engine changes, which can
  set the Nest to maximum. Google explicitly says senders must not set a
  predefined volume and should send only user-initiated volume changes.

These omissions explain incomplete controls, refresh/reconnect behavior, and
the volume jump. They do **not** explain why the first media URL produces no
audio. Single-track media loading—the prerequisite for first audio—is already
implemented in [`castPlayback.js`](../../ui/src/cast/castPlayback.js) and invoked
by [`PlaybackBridge.jsx`](../../ui/src/audioplayer/PlaybackBridge.jsx).

Sources: [Web Sender session resume](https://developers.google.com/cast/docs/web_sender/advanced),
[auto-join policy reference](https://developers.google.com/cast/docs/reference/web_sender/chrome.cast),
[sender volume requirements](https://developers.google.com/cast/docs/design_checklist/sender).

## Recommended implementation sequence

1. **Prove the failure boundary:** enable Caddy/Navidrome access logging and cast
   one known MP3. No media request means DNS/TLS/routing. A request with
   `401/403/404/5xx` means URL/auth/proxy. A `200/206` request moves the check to
   MIME type, bytes, range behavior, and codec.
2. **Implement the Cast media handoff endpoint:** short-lived scoped token,
   configurable advertised base URL, same hostname by default, LAN HTTP/IP
   override, and a conservative seekable MP3 response.
3. **Fix current sender correctness:** never synchronize a default volume on
   connect; wait for an actual receiver media session/player state before
   switching the active engine; surface receiver load failures.
4. **Complete Stage 2:** full queue, next/previous, authoritative remote state,
   saved session ID, rejoin/adopt after refresh, and disconnect recovery.
5. **Consider a custom receiver only if needed:** use it for header-based auth,
   receiver diagnostics/business logic, or advanced queue/session behavior—not
   as a workaround for an unreachable media origin.

The first diagnostic remains mandatory. Sender-side unit tests cannot reproduce
Nest DNS, certificate trust, or receiver HTTP behavior; the smallest red-capable
feedback loop is one cast attempt correlated with a sanitized reverse-proxy
access-log line.
