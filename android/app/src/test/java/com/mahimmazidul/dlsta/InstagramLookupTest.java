package com.mahimmazidul.dlsta;

import org.junit.Test;
import org.json.JSONArray;
import org.json.JSONObject;
import static org.junit.Assert.*;
import java.util.ArrayList;
import java.util.List;

public class InstagramLookupTest {
    private JSONObject photo(String shortcode) throws Exception {
        return new JSONObject().put("shortcode",shortcode).put("is_video",false).put("display_resources",new JSONArray()
            .put(new JSONObject().put("src","https://media.fbcdn.net/small.jpg").put("config_width",320).put("config_height",320))
            .put(new JSONObject().put("src","https://media.fbcdn.net/big.webp").put("config_width",1440).put("config_height",1440))
            .put(new JSONObject().put("src","https://evil.example/big.jpg").put("config_width",4000).put("config_height",4000)));
    }
    private String embed(JSONObject root) throws Exception {
        JSONObject context=new JSONObject().put("gql_data",new JSONObject().put("shortcode_media",root));
        return "<script>foo={\"contextJSON\":"+JSONObject.quote(context.toString())+"}</script>";
    }
    @Test public void inputValidationBlocksUntrustedAndStripsQuery() {
        assertEquals("https://www.instagram.com/p/Example_123/",InstagramLookup.normalize("https://instagram.com/p/Example_123/?utm=abc"));
        for(String u:new String[]{"http://instagram.com/p/abc/","https://instagram.com.evil.test/p/abc/","https://x@instagram.com/p/abc/","https://instagram.com:443/p/abc/","https://instagram.com/stories/user/123/"}) {
            try{InstagramLookup.normalize(u);fail("Accepted invalid input");}catch(IllegalArgumentException expected){}
        }
    }
    @Test public void embedUsesMatchingShortcodeAndLargestAllowedVariant() throws Exception {
        String html=embed(photo("ABC"));InstagramLookup.Result r=InstagramLookup.parsePublic(html,"ABC");
        assertNotNull(r);assertEquals("device",r.source);assertEquals("https://media.fbcdn.net/big.webp",r.items.get(0).url);assertNull(InstagramLookup.parsePublic(html,"OTHER"));
    }
    @Test public void supportsCarouselAndTracksUnavailableItems() throws Exception {
        JSONObject one=photo("unused");JSONObject video=new JSONObject().put("is_video",true).put("video_url","https://video.cdninstagram.com/a.mp4");
        JSONObject missing=new JSONObject().put("is_video",true);JSONObject root=new JSONObject().put("shortcode","ABC").put("__typename","GraphSidecar").put("carousel_media_count",3).put("carousel_media",new JSONArray().put(one).put(video).put(missing));
        InstagramLookup.Result r=InstagramLookup.parsePublic(embed(root),"ABC");assertEquals(2,r.items.size());assertEquals(3,r.total);assertTrue(r.partial);assertEquals("video",r.items.get(1).type);assertEquals(2,r.items.get(1).position);
    }
    @Test public void untypedThumbnailIsNotAStandalonePhoto() throws Exception {
        JSONObject root=new JSONObject().put("shortcode","ABC").put("display_url","https://media.fbcdn.net/cover.jpg");assertNull(InstagramLookup.parsePublic(embed(root),"ABC"));
    }
    @Test public void deviceSuccessNeverUsesFallback() throws Exception {
        List<String> requests=new ArrayList<>();String html=embed(photo("ABC"));
        InstagramLookup.Result r=InstagramLookup.lookup("https://instagram.com/p/ABC/",(url,method,body)->{requests.add(url);return html;});
        assertEquals("device",r.source);assertEquals(1,requests.size());assertFalse(requests.contains(InstagramLookup.BACKEND));
    }
    @Test public void missingLocalMediaUsesOnlyOurBackendFallback() throws Exception {
        List<String> requests=new ArrayList<>();InstagramLookup.Result r=InstagramLookup.lookup("https://instagram.com/reel/ABC/",(url,method,body)->{requests.add(url);if(url.equals(InstagramLookup.BACKEND)){assertEquals("POST",method);assertEquals("https://www.instagram.com/reel/ABC/",new JSONObject(body).getString("url"));return "{\"success\":true,\"mediaType\":\"video\",\"mediaUrl\":\"https://video.cdninstagram.com/a.mp4\"}";}return "<html>no media</html>";});
        assertEquals("fallback",r.source);assertEquals(4,requests.size());assertEquals(InstagramLookup.BACKEND,requests.get(3));
    }
    @Test public void blockedCustomDomainUsesSameWorkerBackup() throws Exception {
        List<String> requests=new ArrayList<>();InstagramLookup.Result r=InstagramLookup.lookup("https://instagram.com/p/ABC/",(url,method,body)->{
            requests.add(url);if(url.equals(InstagramLookup.BACKEND))throw new InstagramLookup.HttpFailure(403);
            if(url.equals(InstagramLookup.BACKUP_BACKEND))return "{\"success\":true,\"mediaType\":\"photo\",\"mediaUrl\":\"https://media.fbcdn.net/a.jpg\"}";
            return "<html>no media</html>";});
        assertEquals("fallback",r.source);assertEquals(InstagramLookup.BACKUP_BACKEND,requests.get(requests.size()-1));
    }
    @Test public void workerRateLimitIsNotBypassed() throws Exception {
        List<String> requests=new ArrayList<>();try {InstagramLookup.lookup("https://instagram.com/p/ABC/",(url,method,body)->{requests.add(url);if(url.equals(InstagramLookup.BACKEND))throw new InstagramLookup.HttpFailure(429);return "no media";});fail("Lookup should fail");} catch(Exception expected){}
        assertFalse(requests.contains(InstagramLookup.BACKUP_BACKEND));
    }
    @Test public void fallbackNeverAcceptsUntrustedMediaHosts() throws Exception {
        JSONObject result=new JSONObject("{\"success\":true,\"mediaType\":\"photo\",\"mediaUrl\":\"https://fbcdn.net.evil.example/a.jpg\"}");assertNull(InstagramLookup.parseBackend(result));
    }
    @Test public void jsonScriptMediaIsFound() throws Exception {
        String html="<script type=\"application/json\">"+new JSONObject().put("data",photo("ABC"))+"</script>";
        assertNotNull(InstagramLookup.parsePublic(html,"ABC"));
    }
}
