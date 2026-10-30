package com.mahimmazidul.dlsta;

import java.net.URI;
import java.util.Locale;

/** Security boundary for every media URL and filename. */
public final class MediaRules {
    private MediaRules() {}
    public static boolean allowedUrl(String value) {
        if (value == null || value.length() > 8192) return false;
        try {
            URI uri = new URI(value);
            String host = uri.getHost();
            if (host == null || !"https".equalsIgnoreCase(uri.getScheme()) || uri.getRawUserInfo() != null || uri.getPort() != -1) return false;
            host = host.toLowerCase(Locale.ROOT);
            return host.equals("cdninstagram.com") || host.endsWith(".cdninstagram.com") ||
                   host.equals("fbcdn.net") || host.endsWith(".fbcdn.net");
        } catch (Exception ignored) { return false; }
    }
    public static boolean allowedFilename(String value) {
        return value != null && value.matches("instagram_[A-Za-z0-9_-]{1,80}");
    }
    public static String extension(String mime) {
        if (mime == null) return null;
        switch (mime.split(";", 2)[0].trim().toLowerCase(Locale.ROOT)) {
            case "image/jpeg": return "jpg"; case "image/png": return "png"; case "image/webp": return "webp";
            case "image/avif": return "avif"; case "image/gif": return "gif"; case "video/mp4": return "mp4";
            case "video/webm": return "webm"; case "video/quicktime": return "mov"; default: return null;
        }
    }
}
