package com.mahimmazidul.dlsta;

import static org.junit.Assert.*;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.webkit.WebView;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

@RunWith(AndroidJUnit4.class)
public class AppSmokeTest {
    private String evaluate(ActivityScenario<MainActivity> scenario, String script) throws Exception {
        AtomicReference<String> value = new AtomicReference<>(); CountDownLatch done = new CountDownLatch(1);
        scenario.onActivity(activity -> {
            WebView web = activity.findViewById(R.id.webview);
            if (web == null) { done.countDown(); return; }
            web.evaluateJavascript(script, result -> { value.set(result); done.countDown(); });
        });
        assertTrue("JavaScript callback timed out", done.await(8, TimeUnit.SECONDS));
        return value.get();
    }
    @Test public void bundledPageAndNativeClipboardBridgeLoad() throws Exception {
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            String ready = "";
            for (int i = 0; i < 40; i++) {
                ready = evaluate(scenario, "!!(document.querySelector('#form') && window.dlstaNative && location.hostname==='appassets.androidplatform.net')");
                if ("true".equals(ready)) break;
                Thread.sleep(500);
            }
            assertEquals("Bundled UI and trusted bridge should load", "true", ready);
            scenario.onActivity(activity -> ((ClipboardManager) activity.getSystemService(Context.CLIPBOARD_SERVICE)).setPrimaryClip(ClipData.newPlainText("test", "https://www.instagram.com/p/Smoke123/")));
            evaluate(scenario, "window.__testReply=''; window.dlstaNative.onmessage=e=>window.__testReply=JSON.parse(e.data).text; window.dlstaNative.postMessage(JSON.stringify({id:901,type:'readClipboard'})); true");
            String reply = "";
            for (int i = 0; i < 20; i++) {
                reply = evaluate(scenario, "window.__testReply");
                if (reply != null && reply.contains("Smoke123")) break;
                Thread.sleep(250);
            }
            assertTrue("Native clipboard bridge should return the user clipboard", reply != null && reply.contains("Smoke123"));
            evaluate(scenario, "window.__reject=''; window.dlstaNative.onmessage=e=>window.__reject=JSON.parse(e.data).ok?'allowed':'rejected'; window.dlstaNative.postMessage(JSON.stringify({id:902,type:'enqueue',items:[{url:'https://evil.example/file.jpg',filename:'instagram_test'}]})); true");
            String rejected = "";
            for (int i = 0; i < 20; i++) { rejected = evaluate(scenario, "window.__reject"); if (rejected != null && rejected.contains("rejected")) break; Thread.sleep(250); }
            assertTrue("Untrusted hosts must be rejected", rejected != null && rejected.contains("rejected"));
            assertEquals("true", evaluate(scenario, "!!document.querySelector('#save-all') && !!document.querySelector('#save-media') && !!document.querySelector('#download')"));
        }
    }
}
