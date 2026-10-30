package com.mahimmazidul.dlsta;

import static org.junit.Assert.*;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.io.InputStream;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Map;

/** Real, anonymous requests through the same Android-only lookup code as the released APK. */
@RunWith(AndroidJUnit4.class)
public class ReelLiveTest {
    private void testReel(String shortcode) throws Exception {
        StringBuilder diagnostics=new StringBuilder();
        Method nativeRequest=InstagramLookup.class.getDeclaredMethod("request",String.class,String.class,String.class,Map.class);
        nativeRequest.setAccessible(true);
        InstagramLookup.Transport observed=(url,method,body,headers)->{
            String stage=url.equals(InstagramLookup.GRAPHQL)?"graphql":url.equals("https://www.instagram.com/")?"home":url.contains("captioned")?"captioned-embed":url.endsWith("/embed/")?"plain-embed":"post";
            try {
                String response=(String)nativeRequest.invoke(null,url,method,body,headers);
                diagnostics.append(stage).append("=HTTP200/").append(response.length()).append("chars");
                if(stage.equals("graphql")) {
                    String json=response.startsWith("for (;;);")?response.substring(9):response;
                    try {JSONObject data=new JSONObject(json);diagnostics.append("/error=").append(data.optInt("error",0)).append("/data=").append(data.optJSONObject("data")!=null);}catch(Exception e){diagnostics.append("/non-json");}
                } else diagnostics.append("/context=").append(response.contains("\"contextJSON\"")).append("/video=").append(response.contains("video_url"));
                diagnostics.append("; ");return response;
            } catch(InvocationTargetException wrapped) {
                Throwable cause=wrapped.getCause();diagnostics.append(stage).append("=");
                if(cause instanceof InstagramLookup.HttpFailure)diagnostics.append("HTTP").append(((InstagramLookup.HttpFailure)cause).status);else diagnostics.append(cause==null?"unknown":cause.getClass().getSimpleName());
                diagnostics.append("; ");throw new Exception("Request failed");
            }
        };
        InstagramLookup.Result result;
        try {result=InstagramLookup.lookup("https://www.instagram.com/reel/"+shortcode+"/",observed);}
        catch(Exception e){fail("Android-only reel "+shortcode+" could not resolve. Stages: "+diagnostics);return;}
        assertNotNull(result);assertFalse(result.items.isEmpty());InstagramLookup.Item item=result.items.get(0);
        assertEquals("Must resolve video media", "video",item.type);assertTrue("Only allow Instagram CDN",MediaRules.allowedUrl(item.url));
        String url=item.url;HttpURLConnection c=null;
        try {
            for(int redirects=0;redirects<=5;redirects++) {
                assertTrue(MediaRules.allowedUrl(url));c=(HttpURLConnection)new URL(url).openConnection();c.setInstanceFollowRedirects(false);c.setConnectTimeout(15000);c.setReadTimeout(15000);
                int status=c.getResponseCode();if(status>=300&&status<400){String next=c.getHeaderField("Location");assertNotNull(next);url=new URL(new URL(url),next).toString();c.disconnect();c=null;continue;}
                assertEquals("Direct CDN response",200,status);assertTrue("Expected video MIME",c.getContentType()!=null&&c.getContentType().toLowerCase().startsWith("video/"));
                try(InputStream in=c.getInputStream()){byte[] b=new byte[1024];assertTrue("Video must contain data",in.read(b)>0);}return;
            }
            fail("Too many redirects");
        } finally {if(c!=null)c.disconnect();}
    }
    @Test public void requestedReel() throws Exception {testReel("De3hNM7x4jE");}
    @Test public void publicReelOne() throws Exception {testReel("DQWxAjPjI32");}
    @Test public void publicReelTwo() throws Exception {testReel("Dbn-XJhk0_-");}
}
