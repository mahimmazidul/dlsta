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
import java.nio.charset.StandardCharsets;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Public, anonymous lookup on the device first. The existing backend is the fallback. */
final class InstagramLookup {
    static final String BACKEND = "https://d.byaislop.cv/api/scrape";
    static final int MAX_BODY = 3_000_000;
    private static final String USER_AGENT = "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome/131.0.0.0 Mobile Safari/537.36";
    interface Transport { String request(String url, String method, String body) throws Exception; }
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
            Matcher m=Pattern.compile("^/(p|reel|tv)/([A-Za-z0-9_-]{1,32})/?$").matcher(u.getPath());
            if (!m.matches()) throw new IllegalArgumentException();
            return "https://www.instagram.com/"+m.group(1)+"/"+m.group(2)+"/";
        } catch (Exception ignored) { throw new IllegalArgumentException("Enter a valid Instagram post or reel link."); }
    }
    static Result lookup(String raw) throws Exception { return lookup(raw, InstagramLookup::request); }
    static Result lookup(String raw, Transport transport) throws Exception {
        String url=normalize(raw); String shortcode=url.split("/")[4];
        String alternate=url.contains("/reel/") ? url.replace("/reel/","/p/") : url.contains("/p/") ? url.replace("/p/","/reel/") : null;
        String[] attempts=alternate==null ? new String[]{url+"embed/captioned/",url+"embed/"} : new String[]{url+"embed/captioned/",alternate+"embed/captioned/",url+"embed/"};
        for (String candidate: attempts) {
            try { Result result=parsePublic(transport.request(candidate,"GET",null),shortcode); if (result!=null) return result; } catch (Exception ignored) { }
        }
        try {
            JSONObject data=new JSONObject(transport.request(BACKEND,"POST",new JSONObject().put("url",url).toString()));
            if (!data.optBoolean("success")) throw new Exception();
            Result result=parseBackend(data); if (result!=null) return result;
        } catch (Exception ignored) { }
        throw new Exception("Could not retrieve this post. It may be private, deleted, restricted or temporarily unavailable.");
    }
    private static String request(String url,String method,String body) throws Exception {
        HttpURLConnection c=(HttpURLConnection)new URL(url).openConnection();
        try {
            c.setConnectTimeout(4500); c.setReadTimeout(6500); c.setInstanceFollowRedirects(false); c.setRequestMethod(method);
            c.setRequestProperty("User-Agent",USER_AGENT); c.setRequestProperty("Accept",method.equals("POST")?"application/json":"text/html");
            if (body!=null) { c.setDoOutput(true); c.setRequestProperty("Content-Type","application/json"); try(OutputStream out=c.getOutputStream()){ out.write(body.getBytes(StandardCharsets.UTF_8)); } }
            if (c.getResponseCode()!=200 || c.getContentLengthLong()>MAX_BODY) throw new Exception("Request failed");
            try (InputStream in=c.getInputStream(); ByteArrayOutputStream out=new ByteArrayOutputStream()) {
                byte[] bytes=new byte[8192]; int n, total=0; while((n=in.read(bytes))!=-1){total+=n;if(total>MAX_BODY)throw new Exception("Response too large");out.write(bytes,0,n);} return out.toString("UTF-8");
            }
        } finally { c.disconnect(); }
    }
    static Result parseBackend(JSONObject data) {
        List<Item> items=new ArrayList<>(); JSONArray array=data.optJSONArray("items"); boolean partial=data.optBoolean("partial",false);
        if (array!=null) {
            for(int i=0;i<Math.min(array.length(),50);i++) {
                JSONObject item=array.optJSONObject(i); if(item==null){partial=true;continue;}
                String url=item.optString("mediaUrl",""); String type=item.optString("mediaType","");
                if(item.optBoolean("available",false) && MediaRules.allowedUrl(url) && (type.equals("photo")||type.equals("video"))) {
                    String thumb=item.optString("thumbnailUrl","");items.add(new Item(type,url,MediaRules.allowedUrl(thumb)?thumb:"",Math.max(1,item.optInt("position",i+1))));
                } else partial=true;
            }
        } else {
            String type=data.optString("mediaType","");String url=data.optString("mediaUrl","");String thumb=data.optString("thumbnailUrl","");
            if((type.equals("photo")||type.equals("video")) && MediaRules.allowedUrl(url))items.add(new Item(type,url,MediaRules.allowedUrl(thumb)?thumb:"",1));
        }
        if(items.isEmpty())return null;
        String caption=data.optString("caption",""); if(caption.length()>2000)caption=caption.substring(0,2000);
        int total=Math.max(Math.max(items.size(),array==null?0:array.length()),data.optInt("totalItems",items.size()));
        return new Result(items,caption,"fallback",total,partial||items.size()<total);
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
        return null;
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
