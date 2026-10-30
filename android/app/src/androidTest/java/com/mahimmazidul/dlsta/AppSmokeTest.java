package com.mahimmazidul.dlsta;

import static org.junit.Assert.*;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.graphics.Bitmap;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebView;
import android.widget.EditText;
import android.widget.TextView;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.io.File;
import java.io.FileOutputStream;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.Arrays;
import java.util.concurrent.atomic.AtomicReference;

@RunWith(AndroidJUnit4.class)
public class AppSmokeTest {
    private boolean containsWebView(View v){if(v instanceof WebView)return true;if(v instanceof ViewGroup){ViewGroup g=(ViewGroup)v;for(int i=0;i<g.getChildCount();i++)if(containsWebView(g.getChildAt(i)))return true;}return false;}
    @Test public void nativeInterfaceClipboardCarouselAndValidation() throws Exception {
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)) {
            AtomicReference<String> value=new AtomicReference<>();
            scenario.onActivity(activity->{
                assertFalse("Native screen must not embed a WebView",containsWebView(activity.getWindow().getDecorView()));
                ((ClipboardManager)activity.getSystemService(Context.CLIPBOARD_SERVICE)).setPrimaryClip(ClipData.newPlainText("test","https://www.instagram.com/p/Smoke123/"));
                activity.findViewById(R.id.paste_button).performClick();value.set(((EditText)activity.findViewById(R.id.url_input)).getText().toString());
            });
            assertEquals("https://www.instagram.com/p/Smoke123/",value.get());
            scenario.onActivity(activity->{((EditText)activity.findViewById(R.id.url_input)).setText("https://evil.example/p/abc/");activity.findViewById(R.id.lookup_button).performClick();value.set(((TextView)activity.findViewById(R.id.message)).getText().toString());});
            assertTrue("Invalid input should be explained",value.get().contains("valid Instagram"));
            scenario.onActivity(activity->{try{
                InstagramLookup.Result result=new InstagramLookup.Result(Arrays.asList(new InstagramLookup.Item("photo","https://media.fbcdn.net/1.jpg","",1),new InstagramLookup.Item("video","https://video.cdninstagram.com/2.mp4","",2)),"Hello from dlsta","device",2,false);
                Field current=MainActivity.class.getDeclaredField("current"),code=MainActivity.class.getDeclaredField("shortcode");current.setAccessible(true);code.setAccessible(true);current.set(activity,result);code.set(activity,"Smoke123");Method render=MainActivity.class.getDeclaredMethod("renderResult");render.setAccessible(true);render.invoke(activity);
                assertNotNull(activity.findViewById(R.id.save_button));assertNotNull(activity.findViewById(R.id.save_all_button));assertNotNull(activity.findViewById(R.id.open_button));
                activity.findViewById(R.id.next_button).performClick();assertEquals("2 / 2",((TextView)activity.findViewById(R.id.media_counter)).getText().toString());
                activity.findViewById(R.id.copy_button).performClick();ClipboardManager clipboard=(ClipboardManager)activity.getSystemService(Context.CLIPBOARD_SERVICE);assertEquals("https://video.cdninstagram.com/2.mp4",clipboard.getPrimaryClip().getItemAt(0).coerceToText(activity).toString());
            }catch(Exception e){throw new AssertionError(e);}});
            // Capture the native UI in the emulator report for visual review.
            InstrumentationRegistry.getInstrumentation().waitForIdleSync();
            Bitmap screenshot=InstrumentationRegistry.getInstrumentation().getUiAutomation().takeScreenshot();
            scenario.onActivity(activity->{try(FileOutputStream out=new FileOutputStream(new File(activity.getExternalFilesDir(null),"native-screen.png"))){screenshot.compress(Bitmap.CompressFormat.PNG,100,out);}catch(Exception ignored){}});
        }
    }
}
