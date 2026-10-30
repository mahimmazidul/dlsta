package com.mahimmazidul.dlsta;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.net.Uri;
import android.os.Environment;
import android.provider.MediaStore;
import androidx.annotation.NonNull;
import androidx.work.Data;
import androidx.work.Worker;
import androidx.work.WorkerParameters;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/** One file per persistent WorkManager job; each job is chained after the preceding job. */
public final class DownloadWorker extends Worker {
    private static final String FOLDER = Environment.DIRECTORY_DOWNLOADS + "/dlsta/";
    public DownloadWorker(@NonNull Context context, @NonNull WorkerParameters params) { super(context, params); }
    private Result outcome(String state) { return Result.success(new Data.Builder().putString("outcome", state).build()); }
    @NonNull @Override public Result doWork() {
        String link = getInputData().getString("url"), base = getInputData().getString("filename");
        if (!MediaRules.allowedUrl(link) || !MediaRules.allowedFilename(base)) return outcome("failed");
        HttpURLConnection connection = null; Uri saved = null;
        ContentResolver resolver = getApplicationContext().getContentResolver();
        try {
            for (int redirects = 0; redirects <= 5; redirects++) {
                if (!MediaRules.allowedUrl(link)) return outcome("failed");
                connection = (HttpURLConnection) new URL(link).openConnection();
                connection.setInstanceFollowRedirects(false);
                connection.setConnectTimeout(20000); connection.setReadTimeout(30000);
                connection.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome/131.0.0.0 Mobile Safari/537.36");
                int code = connection.getResponseCode();
                if (code >= 300 && code <= 399) {
                    String next = connection.getHeaderField("Location");
                    if (next == null) return outcome("failed");
                    link = new URL(new URL(link), next).toString();
                    connection.disconnect(); connection = null; continue;
                }
                if (code == 429 || code >= 500) return getRunAttemptCount() < 2 ? Result.retry() : outcome("failed");
                if (code != 200) return outcome("failed");
                String mime = connection.getContentType();
                String extension = MediaRules.extension(mime);
                if (extension == null) return outcome("failed");
                String filename = base + "." + extension;
                // Android 10+ lets the app see its own Downloads rows without broad storage permission.
                try (Cursor rows = resolver.query(MediaStore.Downloads.EXTERNAL_CONTENT_URI,
                        new String[]{MediaStore.Downloads._ID},
                        MediaStore.Downloads.DISPLAY_NAME + "=? AND " + MediaStore.Downloads.RELATIVE_PATH + "=? AND " + MediaStore.Downloads.IS_PENDING + "=0",
                        new String[]{filename, FOLDER}, null)) {
                    if (rows != null && rows.moveToFirst()) return outcome("existing");
                }
                ContentValues values = new ContentValues();
                values.put(MediaStore.Downloads.DISPLAY_NAME, filename);
                values.put(MediaStore.Downloads.MIME_TYPE, mime.split(";", 2)[0].trim());
                values.put(MediaStore.Downloads.RELATIVE_PATH, FOLDER);
                values.put(MediaStore.Downloads.IS_PENDING, 1);
                saved = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                if (saved == null) return outcome("failed");
                try (InputStream input = connection.getInputStream(); OutputStream output = resolver.openOutputStream(saved)) {
                    if (output == null) throw new java.io.IOException("Unable to open destination");
                    byte[] buffer = new byte[65536]; int count; long bytes = 0;
                    while ((count = input.read(buffer)) != -1) {
                        if (isStopped()) throw new java.io.IOException("Stopped");
                        output.write(buffer, 0, count); bytes += count;
                    }
                    if (bytes == 0) throw new java.io.IOException("Empty media");
                }
                ContentValues ready = new ContentValues(); ready.put(MediaStore.Downloads.IS_PENDING, 0);
                if (resolver.update(saved, ready, null, null) != 1) throw new java.io.IOException("Unable to publish file");
                saved = null;
                return outcome("downloaded");
            }
            return outcome("failed");
        } catch (Exception ignored) {
            if (saved != null) resolver.delete(saved, null, null);
            return getRunAttemptCount() < 2 ? Result.retry() : outcome("failed");
        } finally { if (connection != null) connection.disconnect(); }
    }
}
