package org.bragi.app;

import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import com.google.android.gms.cast.MediaInfo;
import com.google.android.gms.cast.MediaMetadata;
import com.google.android.gms.cast.MediaQueueData;
import com.google.android.gms.cast.MediaQueueItem;
import com.google.android.gms.cast.MediaLoadRequestData;
import com.google.android.gms.cast.MediaStatus;
import com.google.android.gms.cast.framework.media.RemoteMediaClient;
import com.google.android.gms.common.images.WebImage;
import org.json.JSONArray;
import org.json.JSONObject;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.function.BooleanSupplier;
import java.util.function.Consumer;

/** Loads the receiver queue in bounded messages, starting around the playing item. */
final class CastQueueLoader {
    static int repeatMode(String mode) {
        switch (mode) {
            case "singleLoop": return MediaStatus.REPEAT_MODE_REPEAT_SINGLE;
            case "orderLoop": return MediaStatus.REPEAT_MODE_REPEAT_ALL;
            case "shufflePlay": return MediaStatus.REPEAT_MODE_REPEAT_ALL_AND_SHUFFLE;
            default: return MediaStatus.REPEAT_MODE_REPEAT_OFF;
        }
    }

    static void load(RemoteMediaClient client, JSONObject request, BooleanSupplier current,
                     Runnable accepted, Consumer<String> failed) throws Exception {
        JSONArray entries = request.getJSONArray("items");
        int startIndex = request.getInt("startIndex");
        int revision = request.getInt("revision");
        if (startIndex < 0 || startIndex >= entries.length()) throw new IllegalArgumentException("Invalid queue index");
        List<List<MediaQueueItem>> batches = new ArrayList<>();
        List<MediaQueueItem> batch = new ArrayList<>();
        batches.add(batch);
        int bytes = 0;
        int selectedBatch = 0;
        int selectedIndex = 0;
        for (int i = 0; i < entries.length(); i++) {
            JSONObject entry = entries.getJSONObject(i);
            MediaMetadata metadata = new MediaMetadata(MediaMetadata.MEDIA_TYPE_MUSIC_TRACK);
            metadata.putString(MediaMetadata.KEY_TITLE, entry.optString("title"));
            metadata.putString(MediaMetadata.KEY_ARTIST, entry.optString("artist"));
            metadata.putString(MediaMetadata.KEY_ALBUM_TITLE, entry.optString("album"));
            String artwork = entry.optString("artwork");
            if (!artwork.isEmpty()) metadata.addImage(new WebImage(Uri.parse(artwork)));
            JSONObject identity = new JSONObject().put("bragiIndex", i).put("bragiRevision", revision);
            MediaInfo.Builder info = new MediaInfo.Builder(entry.getString("url"))
                    .setContentType(entry.optString("contentType", "audio/mpeg"))
                    .setStreamType(MediaInfo.STREAM_TYPE_BUFFERED)
                    .setMetadata(metadata).setCustomData(identity);
            double duration = entry.optDouble("duration", 0);
            if (duration > 0) info.setStreamDuration(Math.round(duration * 1000));
            MediaQueueItem item = new MediaQueueItem.Builder(info.build()).setAutoplay(true).build();
            // Leave room for the protocol envelope below Cast's 64 KiB limit.
            int size = item.toJson().toString().getBytes(StandardCharsets.UTF_8).length;
            if (size > 48000) throw new IllegalArgumentException("Cast queue item exceeds message limit");
            if (!batch.isEmpty() && (bytes + size > 48000 || batch.size() >= 20)) {
                batch = new ArrayList<>();
                batches.add(batch);
                bytes = 0;
            }
            if (i == startIndex) {
                selectedBatch = batches.size() - 1;
                selectedIndex = batch.size();
            }
            batch.add(item);
            bytes += size;
        }
        final int firstBatch = selectedBatch;
        MediaQueueData data = new MediaQueueData.Builder().setItems(batches.get(firstBatch))
                .setStartIndex(selectedIndex).setRepeatMode(repeatMode(request.optString("mode"))).build();
        MediaLoadRequestData load = new MediaLoadRequestData.Builder().setQueueData(data)
                .setAutoplay(request.optBoolean("autoplay"))
                .setCurrentTime(Math.round(request.optDouble("position", 0) * 1000)).build();
        client.load(load).setResultCallback(result -> {
            if (!current.getAsBoolean()) return;
            if (!result.getStatus().isSuccess()) {
                failed.accept("queue load: " + result.getStatus().getStatusCode());
                return;
            }
            accepted.run();
            if (batches.size() == 1) return;
            // MediaQueue is a sparse asynchronous cache. A successful LOAD does
            // not imply its item IDs have arrived in the sender cache yet.
            awaitItemIds(client, batches, firstBatch, current, failed, 0);
        });
    }

    private static void awaitItemIds(RemoteMediaClient client, List<List<MediaQueueItem>> batches,
                                     int firstBatch, BooleanSupplier current,
                                     Consumer<String> failed, int attempt) {
        if (!current.getAsBoolean()) return;
        int[] ids = client.getMediaQueue().getItemIds();
        int firstId = ids.length > 0 ? ids[0] : 0;
        MediaStatus status = client.getMediaStatus();
        if (firstId == 0 && status != null && !status.getQueueItems().isEmpty()) {
            firstId = status.getQueueItems().get(0).getItemId();
        }
        if (firstId != 0) {
            insert(client, batches, firstBatch, 0, firstId, current, failed);
        } else if (attempt < 30) {
            new Handler(Looper.getMainLooper()).postDelayed(() ->
                    awaitItemIds(client, batches, firstBatch, current, failed, attempt + 1), 100);
        } else {
            failed.accept("Queue item IDs did not arrive for remaining batches");
        }
    }

    private static void insert(RemoteMediaClient client, List<List<MediaQueueItem>> batches,
                               int firstBatch, int batchIndex, int firstItemId,
                               BooleanSupplier current, Consumer<String> failed) {
        if (!current.getAsBoolean() || batchIndex >= batches.size()) return;
        if (batchIndex == firstBatch) {
            insert(client, batches, firstBatch, batchIndex + 1, firstItemId, current, failed);
            return;
        }
        MediaQueueItem[] items = batches.get(batchIndex).toArray(new MediaQueueItem[0]);
        client.queueInsertItems(items, batchIndex < firstBatch ? firstItemId : 0, null)
                .setResultCallback(result -> {
                    if (!current.getAsBoolean()) return;
                    if (!result.getStatus().isSuccess()) {
                        failed.accept("queue insert: " + result.getStatus().getStatusCode());
                        return;
                    }
                    insert(client, batches, firstBatch, batchIndex + 1, firstItemId, current, failed);
                });
    }
}
