package com.mahimmazidul.dlsta;

import static org.junit.Assert.*;
import android.content.ContentResolver;
import android.content.Context;
import android.database.Cursor;
import android.provider.MediaStore;
import android.webkit.WebView;
import androidx.test.core.app.ActivityScenario;
import androidx.test.core.app.ApplicationProvider;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.work.WorkInfo;
import androidx.work.WorkManager;
import org.json.JSONArray;
import org.json.JSONObject;
import org.json.JSONTokener;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

/** End-to-end public-media check on the emulator; no Instagram login or media proxy. */
@RunWith(AndroidJUnit4.class)
public class DownloadIntegrationTest {
    private String evaluate(ActivityScenario<MainActivity> scenario, String script) throws Exception {
        AtomicReference<String> value = new AtomicReference<>(); CountDownLatch done = new CountDownLatch(1);
        scenario.onActivity(activity -> { WebView web=activity.findViewById(R.id.webview); if (web == null) {done.countDown();return;} web.evaluateJavascript(script, result->{value.set(result);done.countDown();}); });
        assertTrue(done.await(8, TimeUnit.SECONDS)); return value.get();
    }
    private JSONArray fetchPublicCarousel() throws Exception {
        HttpURLConnection connection=(HttpURLConnection)new URL("https://d.byaislop.cv/api/scrape").openConnection();
        connection.setConnectTimeout(30000); connection.setReadTimeout(45000); connection.setRequestMethod("POST"); connection.setDoOutput(true);
        connection.setRequestProperty("Content-Type","application/json");
        connection.setRequestProperty("User-Agent","Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/132.0.0.0 Mobile Safari/537.36");
        try (OutputStream out=connection.getOutputStream()) { out.write("{\"url\":\"https://www.instagram.com/p/DfGUZ1GjB-A/\"}".getBytes(StandardCharsets.UTF_8)); }
        assertEquals("Sample API request",200,connection.getResponseCode());
        ByteArrayOutputStream bytes=new ByteArrayOutputStream();
        try(InputStream in=connection.getInputStream()){byte[] buffer=new byte[8192];int n;while((n=in.read(buffer))!=-1)bytes.write(buffer,0,n);}
        connection.disconnect(); JSONObject response=new JSONObject(bytes.toString("UTF-8"));
        assertTrue("Sample lookup must succeed",response.getBoolean("success")); return response.getJSONArray("items");
    }
    private String enqueue(ActivityScenario<MainActivity> scenario, JSONArray items, int id) throws Exception {
        String message=new JSONObject().put("id",id).put("type","enqueue").put("items",items).toString();
        evaluate(scenario,"window.__testBatch=''; window.dlstaNative.onmessage=e=>{let r=JSON.parse(e.data);window.__testBatch=r.ok?r.batch:'ERROR';}; window.dlstaNative.postMessage("+JSONObject.quote(message)+"); true");
        for(int i=0;i<40;i++) {
            String raw=evaluate(scenario,"window.__testBatch");
            Object parsed=raw == null ? "" : new JSONTokener(raw).nextValue();
            String batch=String.valueOf(parsed);
            if(batch.startsWith("dlsta-batch-"))return batch;
            if(batch.equals("ERROR"))fail("Android queue rejected valid media");
            Thread.sleep(250);
        }
        throw new AssertionError("Android queue did not reply");
    }
    private List<WorkInfo> waitForBatch(String batch,int expected) throws Exception {
        Context context=ApplicationProvider.getApplicationContext(); long deadline=System.currentTimeMillis()+150000;
        while(System.currentTimeMillis()<deadline) {
            List<WorkInfo> info=WorkManager.getInstance(context).getWorkInfosByTag(batch).get(10,TimeUnit.SECONDS);
            if(info.size()==expected && info.stream().allMatch(w->w.getState().isFinished())) return info;
            Thread.sleep(1000);
        }
        throw new AssertionError("Timed out waiting for Android download queue");
    }
    @Test public void downloadsPublicCarouselAndSkipsSavedFilesOnRepeat() throws Exception {
        JSONArray source=fetchPublicCarousel(), jobs=new JSONArray();
        String prefix="instagram_CI"+System.currentTimeMillis()+"_";
        for(int i=0;i<source.length() && jobs.length()<3;i++) {
            JSONObject item=source.getJSONObject(i); String url=item.optString("mediaUrl","");
            if(item.optBoolean("available",true) && MediaRules.allowedUrl(url)) jobs.put(new JSONObject().put("url",url).put("filename",prefix+(i+1)));
        }
        assertEquals("Expected three available sample items",3,jobs.length());
        Context context=ApplicationProvider.getApplicationContext(); ContentResolver resolver=context.getContentResolver();
        try (ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)) {
            String ready="";
            for(int i=0;i<40;i++){ready=evaluate(scenario,"!!(window.dlstaNative&&document.querySelector('#form'))");if("true".equals(ready))break;Thread.sleep(500);}
            assertEquals("true",ready);
            List<WorkInfo> first=waitForBatch(enqueue(scenario,jobs,911),3);
            for(WorkInfo work:first)assertEquals("Each real file should be saved", "downloaded",work.getOutputData().getString("outcome"));
            try (Cursor files=resolver.query(MediaStore.Downloads.EXTERNAL_CONTENT_URI, new String[]{MediaStore.Downloads.SIZE}, MediaStore.Downloads.DISPLAY_NAME+" LIKE ?",new String[]{prefix+"%"},null)) {
                assertNotNull(files); assertEquals("Three files visible in Downloads",3,files.getCount());
                while(files.moveToNext()) assertTrue("File should not be empty",files.getLong(0)>0);
            }
            List<WorkInfo> repeated=waitForBatch(enqueue(scenario,jobs,912),3);
            for(WorkInfo work:repeated)assertEquals("Repeat should skip already saved files", "existing",work.getOutputData().getString("outcome"));
        } finally {
            resolver.delete(MediaStore.Downloads.EXTERNAL_CONTENT_URI,MediaStore.Downloads.DISPLAY_NAME+" LIKE ?",new String[]{prefix+"%"});
        }
    }
}
