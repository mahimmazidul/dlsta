package com.mahimmazidul.dlsta;
import static org.junit.Assert.*;
import org.junit.Test;
public class MediaRulesTest {
    @Test public void validatesCdnHostsAndHttps() {
        assertTrue(MediaRules.allowedUrl("https://scontent.cdninstagram.com/media?sig=1"));
        assertTrue(MediaRules.allowedUrl("https://x.fbcdn.net/media"));
        for (String value : new String[]{"http://fbcdn.net/x", "https://fbcdn.net.evil.test/x", "https://fbcdn.net@evil.test/x", "https://x.fbcdn.net:443/x", "https://evil.test/x", "file:///tmp/x"}) assertFalse(value, MediaRules.allowedUrl(value));
    }
    @Test public void validatesFilenameAndMime() {
        assertTrue(MediaRules.allowedFilename("instagram_ABC-xyz_17"));
        assertFalse(MediaRules.allowedFilename("instagram_../../secret"));
        assertEquals("jpg", MediaRules.extension("image/jpeg; charset=binary"));
        assertEquals("webp", MediaRules.extension("IMAGE/WEBP"));
        assertEquals("mp4", MediaRules.extension("video/mp4"));
        assertNull(MediaRules.extension("text/html"));
    }
}
