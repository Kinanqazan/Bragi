# Lyrics search research and recommended design

Date: 2026-10-05

## Recommendation

Add one **Search lyrics** control beside the existing lyrics file picker on the song page. Use LRCLIB as the first and only online source. Search only when the user asks; do not run library-wide lookups or save a result automatically.

When clicked, Bragi should send the selected song's current title and artist, plus album and duration when available, through the backend. Try LRCLIB's metadata-based `/api/get` first. If it has no suitable result, show a short list from `/api/search`. A result should show title, artist, album, duration, and whether plain or synchronized lyrics are available. LRCLIB documents these endpoints, recommends album and duration for matching, uses a roughly ±2-second duration tolerance, and returns up to 20 search results without pagination. [LRCLIB API documentation](https://lrclib.net/docs)

Choosing a result should load its plain or synchronized text into the **existing unsaved lyrics editor**. The user can review or edit it and then use the existing destination and Save controls to store it as a sidecar or embedded lyrics. Selecting a search result must never replace existing lyrics by itself. This follows the useful distinction in Music Assistant: it recognizes local embedded and sidecar lyrics as sources and offers manual metadata refresh, while also supporting online LRCLIB results. Bragi can keep this even simpler by making online lookup explicitly user-triggered. [Music Assistant lyrics behavior](https://www.music-assistant.io/metadata/lyrics/)

## Why it fits Bragi

- `ui/src/song/SongShow.jsx` already has the lyrics editor, file selection, destination, and Save/Cancel/Delete actions. Search can populate its draft instead of adding another editor or save path.
- `core/lyrics/lyrics.go` already resolves lyrics using source priority. It has a provider interface for playback retrieval, but that interface returns lyrics for a track rather than search candidates. Manual search is a separate operation, so it should not be forced into playback priority.
- `core/lyrics/sources.go` already handles embedded lyrics and same-folder sidecars. `conf/configuration.go` gives sidecars priority over embedded tags by default. Keep that behavior: saving into a lower-priority source while a higher-priority sidecar exists may not change the lyrics currently played, and the existing UI should continue to explain that conflict.
- `core/maintenance.go` and the native song lyrics routes already provide the safe, explicit persistence and refresh flow. A search result should enter that existing flow only after the user presses Save.

## Small, testable implementation sequence

1. **Backend search client and endpoint:** add one LRCLIB client with a short request timeout, response-size bound, identifiable `User-Agent`, and clear handling for no match, service failure, and HTTP 429. LRCLIB requires a descriptive client identity and says clients must honor `Retry-After`; for batches it recommends sequential requests with a 200–500 ms pause. Bragi's first version should not batch. [LRCLIB API implementation requirements](https://lrclib.net/docs)
2. **Candidate list UI:** add the single Search lyrics control, loading/error/empty states, and a small selectable result list. Keep only enough rows to identify the right recording; show duration because alternate edits and live versions often differ.
3. **Load into draft:** on selection, load the chosen result into the existing lyrics editor and identify it as plain or synchronized. Do not write a file yet.
4. **Reuse Save:** let the user review/edit and save with the existing sidecar-versus-embedded destination. Verify player refresh and preserve optimistic conflict checks.

Each step can be tested separately. Step 1 tests matching and error behavior without changing any files. Steps 2–3 test that the correct result appears in the editor and Cancel leaves storage unchanged. Step 4 tests persistence through the existing save path.

## Scope and risks

Start with LRCLIB only. Its API offers exact metadata lookup, free-text/field search, IDs for retrieving a selected entry, and both plain and synchronized lyrics. A provider abstraction for future services is only justified when a second provider is actually requested.

Do not infer that a free API means the lyrics are free to redistribute. LRCLIB's source repository is open, but its public tracker still has an unanswered question about rights and caching lyrics. Keep lookups on demand, avoid bulk caching or redistribution, and review the applicable terms/rights before offering this as a hosted or commercial feature. [LRCLIB commercial-use question](https://github.com/tranxuanthang/lrclib/issues/111)

## Sources

- [LRCLIB API documentation](https://lrclib.net/docs) — endpoint parameters, result fields, matching guidance, client identification, and rate-limit requirements.
- [Music Assistant lyrics documentation](https://www.music-assistant.io/metadata/lyrics/) — example of local-source priority, optional online providers, manual metadata refresh, and synced/plain lyrics.
- [LRCLIB commercial-use question](https://github.com/tranxuanthang/lrclib/issues/111) — shows that rights/caching questions should not be assumed resolved merely because the API is free.
- Bragi code inspected: `ui/src/song/SongShow.jsx`, `core/lyrics/lyrics.go`, `core/lyrics/sources.go`, `core/maintenance.go`, `server/nativeapi/song_metadata.go`, and the `LyricsPriority` default in `conf/configuration.go`.
