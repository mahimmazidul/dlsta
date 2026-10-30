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
        assertEquals("https://www.instagram.com/reel/De3hNM7x4jE/",InstagramLookup.normalize("https://instagram.com/reels/De3hNM7x4jE/?s=1"));
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
    @Test public void embedRequestsUsePublicFetcherIdentity() {
        assertTrue(InstagramLookup.userAgentFor("https://www.instagram.com/reel/ABC/embed/captioned/").contains("public-media-fetcher/1.0"));
        assertTrue(InstagramLookup.userAgentFor(InstagramLookup.GRAPHQL).contains("Windows NT"));
        assertTrue(InstagramLookup.userAgentFor("https://www.instagram.com/").contains("Windows NT"));
    }
    @Test public void deviceSuccessNeverUsesFallback() throws Exception {
        List<String> requests=new ArrayList<>();String html=embed(photo("ABC"));
        InstagramLookup.Result r=InstagramLookup.lookup("https://instagram.com/p/ABC/",(url,method,body,headers)->{requests.add(url);return html;});
        assertEquals("device",r.source);assertEquals(1,requests.size());assertEquals("https://www.instagram.com/p/ABC/embed/captioned/",requests.get(0));
    }
    @Test public void localGraphqlCanResolveAReelWithoutAnyBackend() throws Exception {
        List<String> requests=new ArrayList<>();InstagramLookup.Result result=InstagramLookup.lookup("https://instagram.com/reel/DdR7YUOIJl5/?srtk=abc",(url,method,body,headers)->{
            requests.add(url);assertTrue("Only Instagram is contacted",url.startsWith("https://www.instagram.com/"));
            if(url.equals(InstagramLookup.GRAPHQL)){
                assertEquals("POST",method);assertTrue(body.contains("DdR7YUOIJl5"));assertEquals("application/x-www-form-urlencoded",headers.get("Content-Type"));
                JSONObject root=new JSONObject().put("shortcode","DdR7YUOIJl5").put("media_type",2).put("video_versions",new JSONArray().put(new JSONObject().put("url","https://video.cdninstagram.com/clip.mp4").put("width",720).put("height",1280)));
                return new JSONObject().put("data",new JSONObject().put("xdt_api__v1__media__shortcode__web_info",new JSONObject().put("items",new JSONArray().put(root)))).toString();
            }
            return "<html>no media</html>";
        });
        assertEquals("device",result.source);assertEquals("video",result.items.get(0).type);assertEquals(InstagramLookup.GRAPHQL,requests.get(requests.size()-1));
    }
    @Test public void directFailureNeverContactsCloudflare() throws Exception {
        List<String> requests=new ArrayList<>();try{InstagramLookup.lookup("https://instagram.com/p/ABC/",(url,method,body,headers)->{requests.add(url);return "no media";});fail("Should report failure");}catch(Exception expected){}
        assertTrue(requests.size()>3);for(String url:requests)assertTrue(url.startsWith("https://www.instagram.com/"));
    }
    @Test public void explicitlyTypedOpenGraphVideoIsAllowedButUntrustedHostIsNot() {
        String video="<meta property=\"og:video\" content=\"https://video.cdninstagram.com/a.mp4?x=1&amp;y=2\">";
        InstagramLookup.Result result=InstagramLookup.parsePublic(video,"ABC");assertNotNull(result);assertEquals("https://video.cdninstagram.com/a.mp4?x=1&y=2",result.items.get(0).url);
        assertNull(InstagramLookup.parsePublic("<meta property=\"og:video\" content=\"https://fbcdn.net.evil.example/a.mp4\">","ABC"));
    }
    @Test public void jsonScriptMediaIsFound() throws Exception {
        String html="<script type=\"application/json\">"+new JSONObject().put("data",photo("ABC"))+"</script>";
        assertNotNull(InstagramLookup.parsePublic(html,"ABC"));
    }
}
