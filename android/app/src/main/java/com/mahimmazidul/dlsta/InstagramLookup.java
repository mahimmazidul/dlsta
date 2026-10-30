package com.mahimmazidul.dlsta;

import org.json.JSONArray;
import org.json.JSONObject;
import org.json.JSONTokener;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URL;
import java.net.URLEncoder;
import java.util.UUID;
import java.util.Map;
import java.util.LinkedHashMap;
import java.util.Collections;
import java.nio.charset.StandardCharsets;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Public, anonymous lookup performed entirely on the device. */
final class InstagramLookup {
    static final String GRAPHQL = "https://www.instagram.com/graphql/query";
    static final class HttpFailure extends Exception { final int status; HttpFailure(int status) { this.status=status; } }
    static final int MAX_BODY = 3_000_000;
    private static final String USER_AGENT = "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome/131.0.0.0 Mobile Safari/537.36";
    interface Transport { String request(String url, String method, String body, Map<String,String> headers) throws Exception; }
    static final class Item {
        final String type, url, thumbnail; final int position;
        Item(String type, String url, String thumbnail, int position) { this.type=type; this.url=url; this.thumbnail=thumbnail; this.position=position; }
    }
    static final class Result {
        final List<Item> items; final String caption, source; final int total; final boolean partial;
        Result(List<Item> items, String caption, String source, int total, boolean partial) {
            this.items=items; this.caption=caption; this.source=source; this.total=total; this.partial=partial;
        }
    }
    static String normalize(String raw) {
        if (raw == null || raw.length() > 2048) throw new IllegalArgumentException("Enter a valid Instagram post or reel link.");
        try {
            URI u=new URI(raw.trim()); String host=u.getHost();
            if (!"https".equalsIgnoreCase(u.getScheme()) || u.getRawUserInfo()!=null || u.getPort()!=-1 || host==null ||
                !(host.equalsIgnoreCase("instagram.com") || host.equalsIgnoreCase("www.instagram.com") || host.equalsIgnoreCase("m.instagram.com"))) throw new IllegalArgumentException();
            Matcher m=Pattern.compile("^/(p|reel|reels|tv)/([A-Za-z0-9_-]{1,32})/?$").matcher(u.getPath());
            if (!m.matches()) throw new IllegalArgumentException();
            return "https://www.instagram.com/"+(m.group(1).equals("reels")?"reel":m.group(1))+"/"+m.group(2)+"/";
        } catch (Exception ignored) { throw new IllegalArgumentException("Enter a valid Instagram post or reel link."); }
    }
    static Result lookup(String raw) throws Exception { return lookup(raw, InstagramLookup::request); }
    static Result lookup(String raw, Transport transport) throws Exception {
        String url=normalize(raw); String shortcode=url.split("/")[4];
        String alternate=url.contains("/reel/") ? url.replace("/reel/","/p/") : url.contains("/p/") ? url.replace("/p/","/reel/") : null;
        String[] attempts=alternate==null ? new String[]{url+"embed/captioned/",url+"embed/",url} : new String[]{url+"embed/captioned/",alternate+"embed/captioned/",url+"embed/",url};
        for (String candidate: attempts) {
            try { Result result=parsePublic(transport.request(candidate,"GET",null,Collections.emptyMap()),shortcode); if (result!=null) return result; } catch (Exception ignored) { }
        }
        try {
            String csrf=UUID.randomUUID().toString().replace("-","");
            try {
                String home=transport.request("https://www.instagram.com/","GET",null,Collections.emptyMap());
                Matcher token=Pattern.compile("\"csrf_token\"\\s*:\\s*\"([A-Za-z0-9_-]{1,128})\"").matcher(home);
                if(token.find())csrf=token.group(1);
            } catch(Exception ignored) { }
            JSONObject variables=new JSONObject().put("shortcode",shortcode).put("fetch_tagged_user_count",JSONObject.NULL).put("hoisted_comment_id",JSONObject.NULL).put("hoisted_reply_id",JSONObject.NULL).put("__relay_internal__pv__PolarisAIGMMediaWebLabelEnabledrelayprovider",false);
            Map<String,String> fields=new LinkedHashMap<>();fields.put("variables",variables.toString());fields.put("doc_id","27128499623469141");fields.put("lsd","AVqbxe3J_YA");fields.put("fb_api_req_friendly_name","PolarisPostRootQuery");fields.put("av","0");fields.put("__d","www");fields.put("__user","0");fields.put("__a","1");fields.put("__req","3");fields.put("__hs","20000.HYP:instagram_web_pkg.2.1..0.0");fields.put("dpr","1");fields.put("__ccg","UNKNOWN");fields.put("__comet_req","7");fields.put("jazoest","2957");fields.put("__spin_r","1000000000");fields.put("__spin_b","trunk");fields.put("fb_api_caller_class","RelayModern");fields.put("server_timestamps","true");
            StringBuilder form=new StringBuilder();for(Map.Entry<String,String> entry:fields.entrySet()){if(form.length()>0)form.append('&');form.append(URLEncoder.encode(entry.getKey(),"UTF-8")).append('=').append(URLEncoder.encode(entry.getValue(),"UTF-8"));}
            Map<String,String> headers=new LinkedHashMap<>();headers.put("Content-Type","application/x-www-form-urlencoded");headers.put("X-IG-App-ID","936619743392459");headers.put("X-FB-LSD","AVqbxe3J_YA");headers.put("X-FB-Friendly-Name","PolarisPostRootQuery");headers.put("X-Requested-With","XMLHttpRequest");headers.put("X-ASBD-ID","129477");headers.put("X-CSRFToken",csrf);headers.put("Cookie","csrftoken="+csrf+"; ig_did="+UUID.randomUUID()+"; mid="+UUID.randomUUID().toString().replace("-",""));headers.put("Origin","https://www.instagram.com");headers.put("Referer","https://www.instagram.com/");
            String json=transport.request(GRAPHQL,"POST",form.toString(),headers);if(json.startsWith("for (;;);"))json=json.substring(9);
            JSONObject envelope=new JSONObject(json).optJSONObject("data");JSONObject info=envelope==null?null:envelope.optJSONObject("xdt_api__v1__media__shortcode__web_info");JSONArray items=info==null?null:info.optJSONArray("items");
            JSONObject root=items==null?null:items.optJSONObject(0);if(root==null&&envelope!=null)root=envelope.optJSONObject("xdt_shortcode_media");
            if(root!=null && (!root.has("shortcode")||shortcode.equals(root.optString("shortcode")))){Result result=structured(root);if(result!=null)return result;}
        } catch(Exception ignored) { }
        throw new Exception("Could not retrieve this post directly. Instagram may have restricted it or blocked this network.");
    }
    private static String request(String url,String method,String body,Map<String,String> headers) throws Exception {
        HttpURLConnection c=(HttpURLConnection)new URL(url).openConnection();
        try {
            c.setConnectTimeout(4500); c.setReadTimeout(6500); c.setInstanceFollowRedirects(false); c.setRequestMethod(method);
            c.setRequestProperty("User-Agent",USER_AGENT); c.setRequestProperty("Accept",method.equals("POST")?"*/*":"text/html");
            for(Map.Entry<String,String> h:headers.entrySet())c.setRequestProperty(h.getKey(),h.getValue());
            if (body!=null) { c.setDoOutput(true); try(OutputStream out=c.getOutputStream()){ out.write(body.getBytes(StandardCharsets.UTF_8)); } }
            int status=c.getResponseCode(); if(status!=200)throw new HttpFailure(status);
            if(c.getContentLengthLong()>MAX_BODY)throw new Exception("Response too large");
            try (InputStream in=c.getInputStream(); ByteArrayOutputStream out=new ByteArrayOutputStream()) {
                byte[] bytes=new byte[8192]; int n, total=0; while((n=in.read(bytes))!=-1){total+=n;if(total>MAX_BODY)throw new Exception("Response too large");out.write(bytes,0,n);}
                String result=out.toString("UTF-8");
                // Use only an anonymous CSRF value issued for this request; never load a user session.
                if(url.equals("https://www.instagram.com/"))for(Map.Entry<String,List<String>> h:c.getHeaderFields().entrySet())if(h.getKey()!=null&&h.getKey().equalsIgnoreCase("set-cookie"))for(String value:h.getValue()){
                    Matcher csrf=Pattern.compile("(?:^|[;,]\\s*)csrftoken=([A-Za-z0-9_-]{1,128})").matcher(value);
                    if(csrf.find())return result+"\n{\"csrf_token\":\""+csrf.group(1)+"\"}";
                }
                return result;
            }
        } finally { c.disconnect(); }
    }
    static Result parsePublic(String html, String shortcode) {
        if(html==null || html.length()>MAX_BODY)return null;
        Matcher contexts=Pattern.compile("\"contextJSON\"\\s*:\\s*(\"(?:\\\\.|[^\"\\\\])*\")").matcher(html);
        while(contexts.find()) try {
            Object text=new JSONTokener(contexts.group(1)).nextValue(); if(!(text instanceof String))continue;
            JSONObject data=new JSONObject((String)text); JSONObject gql=data.optJSONObject("gql_data"), graph=data.optJSONObject("graphql"), context=data.optJSONObject("context");
            JSONObject root=gql==null?null:gql.optJSONObject("shortcode_media");if(root==null&&graph!=null)root=graph.optJSONObject("shortcode_media");if(root==null&&context!=null)root=context.optJSONObject("media");
            if(root!=null && shortcode.equals(root.optString("shortcode")) && (context==null||!context.has("shortcode")||shortcode.equals(context.optString("shortcode")))) { Result r=structured(root);if(r!=null)return r; }
        } catch(Exception ignored) { }
        Matcher scripts=Pattern.compile("<script\\b(?=[^>]*\\btype\\s*=\\s*[\"']application/json[\"'])[^>]*>([\\s\\S]*?)</script>",Pattern.CASE_INSENSITIVE).matcher(html);
        int scriptsSeen=0, examined=0;
        while(scripts.find() && scriptsSeen++<40 && examined<5000) try {
            Object root=new JSONTokener(scripts.group(1)).nextValue(); ArrayDeque<Object> queue=new ArrayDeque<>(); if(root instanceof JSONObject || root instanceof JSONArray)queue.add(root);
            while(!queue.isEmpty() && examined++<5000) {
                Object value=queue.removeLast();
                if(value instanceof JSONObject) { JSONObject obj=(JSONObject)value; if(shortcode.equals(obj.optString("shortcode"))) {Result r=structured(obj);if(r!=null)return r;} java.util.Iterator<String> keys=obj.keys();while(keys.hasNext()){Object c=obj.opt(keys.next());if(c instanceof JSONObject||c instanceof JSONArray)queue.add(c);} }
                else if(value instanceof JSONArray){JSONArray a=(JSONArray)value;for(int i=0;i<a.length();i++){Object c=a.opt(i);if(c instanceof JSONObject||c instanceof JSONArray)queue.add(c);}}
            }
        } catch(Exception ignored) { }
        String video=meta(html,"og:video:secure_url");if(video.isEmpty())video=meta(html,"og:video");
        if(MediaRules.allowedUrl(video)) {
            String image=meta(html,"og:image"), caption=meta(html,"og:description");
            List<Item> items=new ArrayList<>();items.add(new Item("video",video,MediaRules.allowedUrl(image)?image:"",1));
            if(caption.length()>2000)caption=caption.substring(0,2000);return new Result(items,caption,"device",1,false);
        }
        return null;
    }
    private static String meta(String html,String key){
        Matcher tags=Pattern.compile("<meta\\b[^>]*>",Pattern.CASE_INSENSITIVE).matcher(html);
        Pattern attr=Pattern.compile("([A-Za-z_:.-]+)\\s*=\\s*([\"'])(.*?)\\2",Pattern.CASE_INSENSITIVE);
        while(tags.find()){Matcher values=attr.matcher(tags.group());String name="",content="";while(values.find()){if(values.group(1).equalsIgnoreCase("property")||values.group(1).equalsIgnoreCase("name"))name=values.group(3);if(values.group(1).equalsIgnoreCase("content"))content=values.group(3);}if(name.equalsIgnoreCase(key))return content.replace("&amp;","&").replace("&quot;","\"").replace("&#39;","'").replace("&lt;","<").replace("&gt;",">");}
        return "";
    }
    private static String best(JSONArray candidates) {
        if(candidates==null)return ""; String best=""; long bestArea=-1,bestRate=-1;
        for(int i=0;i<candidates.length();i++){JSONObject v=candidates.optJSONObject(i);if(v==null)continue;String url=v.optString("url",v.optString("src",""));if(!MediaRules.allowedUrl(url))continue;
            long area=Math.max(0,v.optLong("width",v.optLong("config_width",0)))*Math.max(0,v.optLong("height",v.optLong("config_height",0)));long rate=v.optLong("bitrate",v.optLong("bandwidth",0));
            if(area>bestArea||(area==bestArea&&rate>bestRate)){best=url;bestArea=area;bestRate=rate;}}
        return best;
    }
    static Result structured(JSONObject root) {
        JSONArray nodes=root.optJSONArray("carousel_media");JSONObject sidecar=root.optJSONObject("edge_sidecar_to_children");JSONArray edges=sidecar==null?null:sidecar.optJSONArray("edges");
        boolean carousel=nodes!=null||edges!=null||"GraphSidecar".equals(root.optString("__typename"));
        if(nodes==null && edges!=null){nodes=new JSONArray();for(int i=0;i<edges.length();i++){JSONObject e=edges.optJSONObject(i);nodes.put(e==null?JSONObject.NULL:e.optJSONObject("node"));}}
        if(nodes==null){nodes=new JSONArray();if(!carousel)nodes.put(root);}
        List<Item> items=new ArrayList<>();boolean partial=false;
        int total=Math.max(nodes.length(),root.optInt("carousel_media_count",sidecar==null?0:sidecar.optInt("count",0)));
        if(sidecar!=null && sidecar.optJSONObject("page_info")!=null && sidecar.optJSONObject("page_info").optBoolean("has_next_page"))partial=true;
        for(int i=0;i<Math.min(nodes.length(),50);i++) {
            JSONObject item=nodes.optJSONObject(i);if(item==null){partial=true;continue;}
            boolean video=item.optInt("media_type")==2||item.optBoolean("is_video",false)||"GraphVideo".equals(item.optString("__typename"));
            boolean photo=item.optInt("media_type")==1||(item.has("is_video")&&!item.optBoolean("is_video",true))||"GraphImage".equals(item.optString("__typename"));
            JSONObject versions=item.optJSONObject("image_versions2");String image;
            // Choose across both arrays by dimensions, just like the Worker.
            JSONArray combined=new JSONArray();JSONArray a=versions==null?null:versions.optJSONArray("candidates"), b=item.optJSONArray("display_resources");
            if(a!=null)for(int j=0;j<a.length();j++)combined.put(a.opt(j));if(b!=null)for(int j=0;j<b.length();j++)combined.put(b.opt(j));
            image=best(combined);if(image.isEmpty()&&MediaRules.allowedUrl(item.optString("display_url","")))image=item.optString("display_url");
            String vid=best(item.optJSONArray("video_versions"));if(vid.isEmpty()&&MediaRules.allowedUrl(item.optString("video_url","")))vid=item.optString("video_url");
            String url=video?vid:photo?image:"";if(url.isEmpty()){partial=true;continue;}items.add(new Item(video?"video":"photo",url,image,i+1));
        }
        if(items.isEmpty())return null;
        String caption="";JSONObject cap=root.optJSONObject("caption");if(cap!=null)caption=cap.optString("text","");
        JSONObject edge=root.optJSONObject("edge_media_to_caption");JSONArray e=edge==null?null:edge.optJSONArray("edges");if(caption.isEmpty()&&e!=null&&e.optJSONObject(0)!=null&&e.optJSONObject(0).optJSONObject("node")!=null)caption=e.optJSONObject(0).optJSONObject("node").optString("text","");
        if(caption.length()>2000)caption=caption.substring(0,2000);
        return new Result(items,caption,"device",Math.max(total,items.size()),partial||items.size()<total);
    }
}
