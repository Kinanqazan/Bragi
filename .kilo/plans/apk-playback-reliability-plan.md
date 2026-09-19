# APK Playback and Cast Reliability Plan

## Goal

Make the first playback command reliable, prevent premature or repeated queue advancement, preserve the authoritative track across Android/Cast lifecycle changes, and make failures diagnosable without exposing authenticated media URLs.

## Current architecture and diagnosis

Playback state is currently distributed across five authorities:

1. Redux persists the queue and selected index.
2. `PlaybackBridge` switches between local and Cast targets.
3. `PlaybackEngine` owns the browser `<audio>` element.
4. Android `MainActivity` relays WebView, MediaSession, and Cast commands.
5. The Cast receiver owns the actual remote media session.

The asynchronous boundaries do not share one operation identity. Several callbacks therefore act on the mutable *current* track even when they originated from a previous load/session.

### Candidate sources considered

1. Stale or duplicate local `<audio>` `ended` events advancing the replacement track.
2. Native Cast `IDLE/ERROR` callbacks being applied to a later load and advancing twice.
3. Android declaring Cast handoff successful before receiver playback is confirmed.
4. Cold-start queue/index restoration and delayed `audio.play()` leaving stale or rejected startup state.
5. Native Cast media-base discovery completing after the first receiver load.
6. Truncated/non-seekable live transcodes or inaccurate `Content-Length` appearing as early EOF.
7. Activity/WebView, PlaybackService, browser MediaSession, and Cast MediaSession issuing overlapping commands.

### Most likely shared causes

The leading diagnosis is a combination of:

- **Uncorrelated terminal events:** local `ended` and native Cast `IDLE/ERROR/FINISHED` are not consistently tied to the load operation, media identity, and session that produced them. This explains one premature advance followed by another skip after the next track begins.
- **Incorrect cold-start/handoff readiness:** restored playback state and native Cast loads are treated as ready before the local element or remote receiver has actually accepted and started the requested media. Media-base discovery and session resume further race this startup. Selecting a different song creates a new generation and often recovers.

Live-transcode truncation is the strongest secondary possibility. It can trigger the same unsafe terminal-event path, so it must be measured before changing server streaming behavior.

## Phase 1 — Add correlated diagnostics and reproduce

No behavior-changing fix should be applied until this phase identifies which terminal event and operation causes the skip.

### Shared event schema

Add a development-only playback trace with:

- `bootId`
- monotonic timestamp
- `target` (`local`, `native-cast`, `web-cast`)
- `operationId` / load generation
- `sessionIdHash`
- `queueRevision`
- `trackId` and queue index
- sanitized media origin/path identity, never query parameters or tokens
- intent, state before/after, event/reason
- current time, duration, ready state, and whether PLAYING was ever observed

### Instrumentation points

- `ui/src/store/createAdminStore.js`: restored queue count, rejected entries, saved index, clamped index, and user/library scope.
- `ui/src/audioplayer/engine/PlaybackEngine.js`: load creation, resolution, source assignment, play request/confirmation/rejection, `error`, `ended`, stale-event rejection, and advance decision.
- `ui/src/audioplayer/PlaybackBridge.jsx`: target transition, handoff generation, adopt-versus-load decision, and local pause/resume.
- `ui/src/cast/castPlayback.js`: requested/observed content identity, session/media-session identity, terminal state, idle reason, operation match, and recovery/advance decision.
- `android/app/src/main/java/org/bragi/app/MainActivity.java`: actual session event type, Cast load operation, media status, load result, timeout, and ignored obsolete callback.
- `android/app/src/main/java/org/bragi/app/PlaybackService.java`: command source, action, metadata identity, service/MediaSession state, and foreground/wake-lock transition.
- Server stream completion: requested media ID/profile, cache/live-transcode path, bytes written, expected length, completion/error, and elapsed time.

Replace existing full stream-URL Android logs with sanitized origin/path output.

### Reproduction matrix

Capture synchronized browser console, `adb logcat`, Cast status, and server access/stream logs for:

1. Force-stop APK, launch, and select one local track exactly once.
2. Launch with a persisted paused queue and press Play once.
3. Start a first-time uncached Cast transcode immediately after connecting.
4. Let a Cast track run through the failure window without touching controls.
5. Background/recreate the Activity during a Cast session and resume it.
6. Repeat with already-cached media and with a known direct-play-compatible track.

### Diagnosis confirmation gate

Confirm the captured event sequence before implementing later phases. The trace should distinguish:

- stale/duplicate terminal callback,
- autoplay rejection,
- wrong/unavailable receiver URL,
- receiver load rejection,
- truncated stream/early EOF,
- duplicated command source.

## Phase 2 — Make local playback events operation-safe

Files:

- `ui/src/audioplayer/engine/PlaybackEngine.js`
- `ui/src/audioplayer/engine/audioElementAdapter.js`
- `ui/src/audioplayer/engine/PlaybackEngine.test.js`

Changes:

1. Associate each assigned media source with the current load generation and canonical track UUID/media ID.
2. Ignore `ended`, `error`, metadata, and position callbacks that do not match the active source generation.
3. Make terminal handling idempotent: at most one terminal transition per operation.
4. Accept natural completion only after PLAYING was observed and timing is plausibly at the end. Treat implausibly early `ended` as a playback failure eligible for one raw-stream retry, not automatic queue advancement.
5. Pause/detach the old resource before resolving an ended-triggered next source, rather than leaving the prior resource active during asynchronous resolution.
6. Remove or invalidate per-load position listeners when a load is superseded so an old listener cannot seek a new source.
7. Preserve playback intent during navigation while the current load is still starting; do not infer intent solely from `state.playing`.

Tests:

- duplicate `ended` advances once;
- old-source `ended` and `error` after selecting a new track are ignored;
- `ended` at 0–5 seconds on a long track retries/fails visibly rather than advancing;
- superseded position callbacks cannot seek the replacement track;
- Next during initial loading retains autoplay intent;
- valid near-duration completion still advances exactly once.

## Phase 3 — Normalize startup and persisted state

Files:

- `ui/src/store/createAdminStore.js`
- `ui/src/store/persistState.js`
- `ui/src/reducers/playerReducer.js`
- `ui/src/audioplayer/PlaybackBridge.jsx`
- associated store/reducer/bridge tests

Changes:

1. Version persisted playback state and scope it to the authenticated user/server/library identity.
2. Validate restored tracks and clamp or clear `savedPlayIndex` before it becomes `playIndex`.
3. Do not convert a restored paused index into a pending explicit selection. Restore queue/current display state separately from a user playback command.
4. Ensure a fresh Play Now atomically supersedes restore work, increments queue revision, and invalidates all prior asynchronous loads.
5. Represent startup as explicit states (`restoring`, `ready`, `starting`, `playing`, `failed`) so the first command cannot disappear between store hydration and audio-element readiness.
6. On a user gesture, initiate/resume the media element immediately where platform policy requires it, then complete stream resolution without losing activation; expose actionable state when `play()` is rejected.

Tests:

- deleted/malformed restored tracks;
- out-of-range saved index;
- persisted queue from another user/server;
- first Play Now during hydration;
- fresh selection winning over delayed restored-track resolution;
- one cold-start action causing exactly one load and one play.

## Phase 4 — Make native Cast handoff and status authoritative

Files:

- `ui/src/cast/castPlayback.js`
- `ui/src/cast/castApi.js`
- `ui/src/audioplayer/PlaybackBridge.jsx`
- `android/app/src/main/java/org/bragi/app/MainActivity.java`
- Cast/bridge tests

Changes:

1. Give every native Cast load an operation ID shared by JavaScript and Java.
2. Change the native bridge from fire-and-forget to an acknowledgement contract. Resolve handoff only after the matching receiver media is PLAYING or intentionally PAUSED; reject on load failure, missing session, terminal idle, or timeout.
3. Keep local playback active until that acknowledgement, matching the browser Cast behavior.
4. Require exact current content/operation matching. Empty content ID must not match every request.
5. Add one terminal/recovery guard per operation so duplicate/stale `ERROR` or `FINISHED` callbacks cannot advance multiple tracks.
6. Process real terminal receiver states before applying the local `isMediaLoading` overlay; do not turn `IDLE/ERROR` into `BUFFERING`.
7. Prevent one-second progress callbacks carrying idle reason `NONE` from overwriting meaningful terminal status.
8. Clear `mediaLoaded` on terminal failure so Play performs a real reload.
9. Clear playing intent/state when the final queue item finishes.
10. Use the actual `SESSION_RESUMED` event end-to-end and adopt the receiver’s authoritative media/position instead of reloading sender-local state.

Tests:

- Java rejection after JS invokes `loadMedia` keeps/resumes local playback;
- duplicate native ERROR while the next URL resolves advances no more than once;
- stale empty/mismatched content status is ignored;
- native FINISHED advances once and final-item FINISHED stops cleanly;
- native session resume adopts rather than reloads;
- terminal IDLE is never masked indefinitely as BUFFERING;
- Play after receiver ERROR submits a fresh load.

## Phase 5 — Remove the Cast media-base startup race

Files:

- `android/app/src/main/java/org/bragi/app/MainActivity.java`
- `ui/src/config.js`
- `ui/src/cast/castMedia.js`
- native Cast tests/manual instrumentation

Changes:

1. Resolve and validate the receiver-accessible media base before enabling the first Cast media load.
2. Cache the last validated base by server identity, but revalidate it when the configured server changes.
3. Expose readiness/failure explicitly to JavaScript rather than silently falling back to a sender-only origin.
4. Do not mutate the base underneath an in-flight media operation; a new base creates a new operation generation.
5. Surface a precise receiver-reachability/configuration error instead of auto-skipping the queue.

Tests:

- delayed six-second configuration fetch cannot launch a load with the old base;
- base change invalidates an older load without affecting the replacement;
- unreachable/invalid receiver base fails without advancing tracks;
- manual selection is no longer required after configuration arrives.

## Phase 6 — Validate and harden the stream contract

Only implement server behavior changes if Phase 1 proves early EOF, length mismatch, or range behavior contributes to failures.

Files likely involved:

- `core/stream/media_streamer.go`
- stream/cache tests
- `ui/src/cast/castMedia.js`

Changes to evaluate:

1. Do not advertise an estimated value as authoritative `Content-Length` for a live non-seekable transcode.
2. Propagate partial-copy/transcoder failure as a failed stream outcome and structured diagnostic rather than normal completion.
3. Prefer a completed seekable cached transcode for Cast, or delay receiver load until a Cast-compatible resource contract is available.
4. Verify content type, range behavior, TLS trust, DNS, and receiver reachability from the receiver—not merely from the phone.
5. Keep one bounded retry for transient receiver startup; never interpret repeated failures as multiple natural completions.

Tests:

- transcoder writes a short prefix then fails;
- advertised length versus bytes sent;
- cached and uncached range requests;
- receiver retry after cache completion;
- no queue advance on transport failure unless an explicit, guarded skip policy is chosen.

## Phase 7 — Consolidate Android playback ownership

The immediate defects can be fixed without a broad rewrite, but the current lifecycle model remains fragile.

Short-term changes:

1. Remove duplicate native capture-listener and React notifications for the same play/pause/ended transition; designate `PlaybackBridge` as the single publisher to `PlaybackService`.
2. Make MediaSession play and pause absolute commands, not toggles.
3. Correct foreground-service stop scheduling and wake-lock release for restored paused metadata.
4. Add Android audio-focus handling and becoming-noisy behavior.
5. Update position coherently or mark it unknown rather than publishing stale MediaSession position.

Architectural follow-up:

- Decide whether Android background playback is genuinely native or WebView-owned.
- If background playback must survive Activity/WebView death, move queue, source resolution, and playback into a native service/player (for example Media3) and make the WebView a controller.
- If it remains WebView-owned, document that limitation and stop presenting `PlaybackService` as an independent playback owner.
- For robust Cast background controls, move from sender-only single-item loads to a receiver-side Cast queue, or persist enough native queue state to operate without the Activity.

## Verification and rollout

1. Run focused Vitest suites for engine, bridge, reducer/store, Cast API, and Cast playback.
2. Add Android JVM tests for session-event mapping and status translation; add instrumentation tests for WebView/native acknowledgement and Activity recreation.
3. Build a debug APK and run the reproduction matrix with trace correlation enabled.
4. Verify local, browser Cast, and native Cast against cached and uncached tracks and multiple formats.
5. Soak-test at least one album through natural transitions, rapid manual skips, background/foreground, network interruption, Cast reconnect, and final queue completion.
6. Disable verbose traces in release builds while retaining sanitized warning/error breadcrumbs.
7. Release in stages: event guards/startup validation first, Cast acknowledgement/base readiness second, server stream changes only with confirming evidence, architectural service migration separately.

## Acceptance criteria

- One first-play action after force-stop starts the selected track without selecting another song.
- No callback from an old load/session changes the current track or advances the queue.
- Natural completion advances exactly once; early EOF/load failure never masquerades as multiple completions.
- Native Cast does not pause local playback until the receiver confirms the requested item.
- Cast reconnect adopts the receiver track and position without restart or replacement.
- A failed receiver URL/transcode produces one clear error/recovery decision and no skip cascade.
- Restored queue state is valid, user/server-scoped, and cannot override a new selection.
- Foreground service, wake lock, MediaSession state, and playback intent agree after pause, stop, failure, and Activity recreation.
