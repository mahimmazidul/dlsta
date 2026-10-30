package com.mahimmazidul.dlsta;

import static org.junit.Assert.*;
import android.content.ContentResolver;
import android.content.Context;
import android.database.Cursor;
import android.provider.MediaStore;
import android.webkit.WebView;
import android.webkit.WebChromeClient;
import android.webkit.ConsoleMessage;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Collections;
import java.util.ArrayList;
import java.util.List;
import androidx.test.core.app.ActivityScenario;
import androidx.test.core.app.ApplicationProvider;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import org.json.JSONTokener;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

/** Real user path: WebView lookup, native queue, shared storage and duplicate handling. */
@RunWith(AndroidJUnit4.class)
public class DownloadIntegrationTest {
    private String evaluate(ActivityScenario<MainActivity> scenario, String script) throws Exception {
        AtomicReference<String> value = new AtomicReference<>(); CountDownLatch done = new CountDownLatch(1);
        scenario.onActivity(activity -> { WebView web=activity.findViewById(R.id.webview); if (web == null) {done.countDown();return;} web.evaluateJavascript(script, result->{value.set(result);done.countDown();}); });
        assertTrue(done.await(8, TimeUnit.SECONDS)); return value.get();
    }
    private String text(ActivityScenario<MainActivity> scenario, String selector) throws Exception {
        String raw=evaluate(scenario,"document.querySelector('"+selector+"').textContent");
        return raw == null ? "" : String.valueOf(new JSONTokener(raw).nextValue());
    }
    private String waitForFinish(ActivityScenario<MainActivity> scenario) throws Exception {
        long deadline=System.currentTimeMillis()+150000;
        while(System.currentTimeMillis()<deadline) {
            String status=text(scenario,"#download-status");
            if(status.startsWith("Finished:")) return status;
            if(status.contains("Could not queue")) fail("Android queue rejected the download");
            Thread.sleep(1000);
        }
        throw new AssertionError("Timed out waiting for native Android queue");
    }
    private String probe(String host) {
        try {
            HttpURLConnection c=(HttpURLConnection)new URL("https://"+host+"/api/scrape").openConnection();
            c.setConnectTimeout(12000); c.setReadTimeout(12000); c.setRequestMethod("OPTIONS");
            c.setRequestProperty("Origin","https://appassets.androidplatform.net");
            c.setRequestProperty("Access-Control-Request-Method","POST");
            c.setRequestProperty("Access-Control-Request-Headers","content-type");
            c.setRequestProperty("User-Agent","Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/132.0.0.0 Mobile Safari/537.36");
            int code=c.getResponseCode(); String mitigated=c.getHeaderField("cf-mitigated"); String allow=c.getHeaderField("access-control-allow-origin"); c.disconnect();
            return host+" HTTP "+code+" challenge="+mitigated+" allow-origin="+allow;
        } catch(Exception e) { return host+" "+e.getClass().getSimpleName(); }
    }
    @Test public void downloadsPublicCarouselAndSkipsSavedFilesOnRepeat() throws Exception {
        String prefix="instagram_DfGUZ1GjB-A_";
        Context context=ApplicationProvider.getApplicationContext(); ContentResolver resolver=context.getContentResolver();
        final List<String> diagnostics=Collections.synchronizedList(new ArrayList<>());
        String probes=probe("d.byaislop.cv")+"; "+probe("dlsta.byaislop.workers.dev");
        try (ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)) {
            scenario.onActivity(activity -> { WebView web=activity.findViewById(R.id.webview); if (web != null) web.setWebChromeClient(new WebChromeClient() {
                @Override public boolean onConsoleMessage(ConsoleMessage message) {
                    String value=message.message().replaceAll("https?://[^\\s]+", "<url>");
                    if (value.contains("CORS") || value.contains("net::") || value.contains("403")) diagnostics.add(value.substring(0,Math.min(value.length(),350)));
                    return true;
                }
            }); });
            String ready="";
            for(int i=0;i<40;i++){ready=evaluate(scenario,"!!(window.dlstaNative&&document.querySelector('#form'))");if("true".equals(ready))break;Thread.sleep(500);}
            assertEquals("true",ready);
            evaluate(scenario,"document.querySelector('#url').value='https://www.instagram.com/p/DfGUZ1GjB-A/';document.querySelector('#form').requestSubmit();true");
            boolean found=false;
            for(int i=0;i<100;i++) {
                String result=evaluate(scenario,"!document.querySelector('#result').hidden && document.querySelector('#media-list').children.length >= 3");
                if("true".equals(result)){found=true;break;}
                String error=text(scenario,"#message");
                if(!error.isEmpty()) fail("Public lookup failed in Android WebView: "+error+"; probes: "+probes+"; console: "+diagnostics);
                Thread.sleep(500);
            }
            assertTrue("Public carousel must load in the Android WebView",found);
            evaluate(scenario,"document.querySelector('#save-all').click();true");
            String first=waitForFinish(scenario);
            assertTrue("Expected three files saved; got: "+first,first.contains("3 saved") && !first.contains("failed"));
            try (Cursor files=resolver.query(MediaStore.Downloads.EXTERNAL_CONTENT_URI,new String[]{MediaStore.Downloads.SIZE},MediaStore.Downloads.DISPLAY_NAME+" LIKE ?",new String[]{prefix+"%"},null)) {
                assertNotNull(files); assertEquals("Three files visible in Downloads",3,files.getCount());
                while(files.moveToNext())assertTrue("File should not be empty",files.getLong(0)>0);
            }
            evaluate(scenario,"document.querySelector('#save-all').click();true");
            // The previous Finished message is replaced immediately by the queued status.
            String repeated=waitForFinish(scenario);
            assertTrue("Repeat should skip saved files; got: "+repeated,repeated.contains("3 already saved") && !repeated.contains("failed"));
            try (Cursor files=resolver.query(MediaStore.Downloads.EXTERNAL_CONTENT_URI,new String[]{MediaStore.Downloads._ID},MediaStore.Downloads.DISPLAY_NAME+" LIKE ?",new String[]{prefix+"%"},null)) {
                assertNotNull(files); assertEquals("Repeat must not create duplicates",3,files.getCount());
            }
        } finally {
            resolver.delete(MediaStore.Downloads.EXTERNAL_CONTENT_URI,MediaStore.Downloads.DISPLAY_NAME+" LIKE ?",new String[]{prefix+"%"});
        }
    }
}
