package com.mahimmazidul.dlsta;

import android.app.Activity;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.TextView;
import androidx.annotation.NonNull;
import androidx.webkit.JavaScriptReplyProxy;
import androidx.webkit.WebMessageCompat;
import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewClientCompat;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import androidx.work.BackoffPolicy;
import androidx.work.Constraints;
import androidx.work.Data;
import androidx.work.ExistingWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.WorkInfo;
import androidx.work.WorkManager;
import androidx.work.WorkContinuation;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

public final class MainActivity extends Activity {
    private static final String ORIGIN = "https://appassets.androidplatform.net";
    private static final String START = ORIGIN + "/assets/www/index.html";
    private WebView web;
    private final java.util.concurrent.ExecutorService io = Executors.newSingleThreadExecutor();
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            TextView error = new TextView(this); error.setText("Please update Android System WebView and reopen dlsta.");
            error.setTextColor(Color.WHITE); error.setBackgroundColor(Color.rgb(16,18,15)); error.setPadding(32,64,32,32); setContentView(error); return;
        }
        web = new WebView(this); web.setId(R.id.webview); web.setBackgroundColor(Color.rgb(16,18,15));
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true); settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false); settings.setAllowContentAccess(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false); settings.setSupportMultipleWindows(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        WebViewAssetLoader assets = new WebViewAssetLoader.Builder().addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this)).build();
        web.setWebViewClient(new WebViewClientCompat() {
            @Override public WebResourceResponse shouldInterceptRequest(@NonNull WebView view, @NonNull WebResourceRequest request) { return assets.shouldInterceptRequest(request.getUrl()); }
            @Override public boolean shouldOverrideUrlLoading(@NonNull WebView view, @NonNull WebResourceRequest request) {
                Uri uri = request.getUrl();
                if ("https".equalsIgnoreCase(uri.getScheme()) && "appassets.androidplatform.net".equalsIgnoreCase(uri.getHost()) && uri.getPort() == -1 && uri.getUserInfo() == null) return false;
                if (request.isForMainFrame() && "https".equalsIgnoreCase(uri.getScheme()) && uri.getHost() != null && uri.getUserInfo() == null) {
                    try { startActivity(new Intent(Intent.ACTION_VIEW, uri)); } catch (Exception ignored) {}
                }
                return true;
            }
        });
        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            WebViewCompat.addWebMessageListener(web, "dlstaNative", Collections.singleton(ORIGIN), (view, message, sourceOrigin, mainFrame, reply) -> {
                if (!mainFrame || !"https".equals(sourceOrigin.getScheme()) || !"appassets.androidplatform.net".equals(sourceOrigin.getHost()) || sourceOrigin.getPort() != -1) return;
                handleMessage(message, reply);
            });
        }
        setContentView(web); web.loadUrl(START);
    }
    private void reply(JavaScriptReplyProxy proxy, long id, boolean ok, String text, String batch) {
        try {
            JSONObject result = new JSONObject().put("id", id).put("ok", ok);
            if (text != null) result.put(ok ? "text" : "error", text);
            if (batch != null) result.put("batch", batch);
            if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) proxy.postMessage(result.toString());
        } catch (Exception ignored) {}
    }
    private void handleMessage(WebMessageCompat message, JavaScriptReplyProxy proxy) {
        String raw = message.getData(); long id = -1;
        if (raw == null || raw.length() > 900000) return;
        try {
            JSONObject request = new JSONObject(raw); id = request.getLong("id");
            String type = request.getString("type");
            ClipboardManager clipboard = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
            if ("readClipboard".equals(type)) {
                ClipData clip = clipboard.getPrimaryClip();
                CharSequence text = clip != null && clip.getItemCount() > 0 ? clip.getItemAt(0).coerceToText(this) : "";
                String value = text == null ? "" : text.toString();
                reply(proxy, id, true, value.length() <= 2048 ? value : "", null); return;
            }
            if ("writeClipboard".equals(type)) {
                String text = request.optString("text", "");
                if (!MediaRules.allowedUrl(text)) { reply(proxy, id, false, "Unsupported link.", null); return; }
                clipboard.setPrimaryClip(ClipData.newPlainText("Direct media link", text));
                reply(proxy, id, true, null, null); return;
            }
            if ("enqueue".equals(type)) {
                JSONArray items = request.getJSONArray("items");
                if (items.length() < 1 || items.length() > 100) { reply(proxy, id, false, "Invalid queue.", null); return; }
                List<OneTimeWorkRequest> jobs = new ArrayList<>();
                String batch = "dlsta-batch-" + UUID.randomUUID();
                Constraints network = new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build();
                for (int i = 0; i < items.length(); i++) {
                    JSONObject item = items.getJSONObject(i);
                    String url = item.getString("url"), filename = item.getString("filename");
                    if (!MediaRules.allowedUrl(url) || !MediaRules.allowedFilename(filename)) { reply(proxy, id, false, "Unsupported media link.", null); return; }
                    Data data = new Data.Builder().putString("url", url).putString("filename", filename).build();
                    jobs.add(new OneTimeWorkRequest.Builder(DownloadWorker.class).setInputData(data).setConstraints(network)
                        .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 20, TimeUnit.SECONDS).addTag(batch).build());
                }
                WorkContinuation chain = WorkManager.getInstance(this).beginUniqueWork("dlsta-download-queue", ExistingWorkPolicy.APPEND_OR_REPLACE, jobs.get(0));
                for (int i = 1; i < jobs.size(); i++) chain = chain.then(jobs.get(i));
                chain.enqueue();
                reply(proxy, id, true, null, batch); return;
            }
            if ("status".equals(type)) {
                String batch = request.optString("batch", "");
                if (!batch.matches("dlsta-batch-[0-9a-f-]{36}")) { reply(proxy, id, false, "Invalid queue.", null); return; }
                long requestId = id;
                io.execute(() -> {
                    try {
                        List<WorkInfo> info = WorkManager.getInstance(this).getWorkInfosByTag(batch).get(10, TimeUnit.SECONDS);
                        int downloaded = 0, existing = 0, failed = 0, waiting = 0;
                        for (WorkInfo work : info) {
                            if (!work.getState().isFinished()) { waiting++; continue; }
                            String outcome = work.getOutputData().getString("outcome");
                            if ("downloaded".equals(outcome)) downloaded++;
                            else if ("existing".equals(outcome)) existing++;
                            else failed++;
                        }
                        JSONObject result = new JSONObject().put("id", requestId).put("ok", true).put("total", info.size())
                            .put("downloaded", downloaded).put("existing", existing).put("failed", failed).put("waiting", waiting);
                        runOnUiThread(() -> { if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) proxy.postMessage(result.toString()); });
                    } catch (Exception ignored) { runOnUiThread(() -> reply(proxy, requestId, false, "Unable to check queue.", null)); }
                });
                return;
            }
            reply(proxy, id, false, "Unsupported request.", null);
        } catch (Exception ignored) { if (id >= 0) reply(proxy, id, false, "Invalid Android request.", null); }
    }
    @Override public void onBackPressed() {
        if (web != null && web.canGoBack()) web.goBack(); else super.onBackPressed();
    }
    @Override protected void onDestroy() { io.shutdownNow(); if (web != null) { web.destroy(); web = null; } super.onDestroy(); }
}
