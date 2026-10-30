package com.mahimmazidul.dlsta;

import static org.junit.Assert.*;
import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Rect;
import android.os.ParcelFileDescriptor;
import android.os.SystemClock;
import android.view.View;
import android.view.WindowInsetsController;
import android.os.Build;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.ScrollView;
import android.widget.TextView;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.io.FileInputStream;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.Arrays;

/** Exercise real Android measurements at compact, scaled and wide window sizes. */
@RunWith(AndroidJUnit4.class)
public class ResponsiveLayoutTest {
    private void shell(String command) throws Exception {
        try (ParcelFileDescriptor fd=InstrumentationRegistry.getInstrumentation().getUiAutomation().executeShellCommand(command);
             FileInputStream in=new FileInputStream(fd.getFileDescriptor())) { while(in.read()!=-1) { } }
    }
    private void snapshot(String name) throws Exception {
        // waitForIdleSync covers the UI thread, not the system compositor or bar transition.
        InstrumentationRegistry.getInstrumentation().waitForIdleSync(); SystemClock.sleep(900);
        shell("screencap -p /sdcard/Download/"+name+".png");
    }
    private void fullyVisible(View v) {
        assertNotNull(v);Rect rect=new Rect();assertTrue("View should be visible",v.getGlobalVisibleRect(rect));
        assertEquals("Control must not be clipped horizontally",v.getWidth(),rect.width());
    }
    private void assertSystemBarContrast(MainActivity activity, boolean light) {
        if (Build.VERSION.SDK_INT >= 30) {
            WindowInsetsController controller=activity.getWindow().getInsetsController();assertNotNull(controller);
            int mask=WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS;
            assertEquals("System bar icons should contrast with the theme",light?mask:0,controller.getSystemBarsAppearance()&mask);
        }
    }
    private void injectResult(MainActivity activity) {
        try {
            InstagramLookup.Result result=new InstagramLookup.Result(Arrays.asList(new InstagramLookup.Item("video","https://video.cdninstagram.com/1.mp4","",1),new InstagramLookup.Item("photo","https://media.fbcdn.net/2.jpg","",2)),"A caption for the selected post.","device",2,false);
            Field current=MainActivity.class.getDeclaredField("current"),code=MainActivity.class.getDeclaredField("shortcode");current.setAccessible(true);code.setAccessible(true);current.set(activity,result);code.set(activity,"ScreenTest");
            Method render=MainActivity.class.getDeclaredMethod("renderResult");render.setAccessible(true);render.invoke(activity);
            // A generated preview keeps screenshots self-contained and avoids network dependencies.
            Bitmap bitmap=Bitmap.createBitmap(720,720,Bitmap.Config.ARGB_8888);Canvas canvas=new Canvas(bitmap);canvas.drawColor(Color.rgb(51,73,59));Paint p=new Paint(3);p.setColor(Color.rgb(142,177,139));canvas.drawCircle(360,300,175,p);p.setColor(Color.rgb(32,51,39));canvas.drawRect(0,500,720,720,p);
            ((ImageView)activity.findViewById(R.id.media_preview)).setImageBitmap(bitmap);
        } catch(Exception e) { throw new AssertionError(e); }
    }
    @Test public void compactLargeTextAndWideScreenStayUsable() throws Exception {
        Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();
        boolean original=context.getSharedPreferences("MainActivity",Context.MODE_PRIVATE).getBoolean("light",false);
        try {
            shell("wm size 320x640");shell("wm density 160");shell("settings put system font_scale 1.25");SystemClock.sleep(1000);
            try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)) {
                InstrumentationRegistry.getInstrumentation().waitForIdleSync();
                scenario.onActivity(a->{
                    View root=a.findViewById(R.id.main_content);assertTrue("Compact content fits width",root.getWidth()<=a.getResources().getDisplayMetrics().widthPixels);
                    assertSystemBarContrast(a, a.getPreferences(Context.MODE_PRIVATE).getBoolean("light",false));
                    fullyVisible(a.findViewById(R.id.theme_button));fullyVisible(a.findViewById(R.id.url_input));fullyVisible(a.findViewById(R.id.paste_button));fullyVisible(a.findViewById(R.id.lookup_button));
                    assertTrue("Primary touch target at least 48dp",a.findViewById(R.id.lookup_button).getHeight()>=Math.round(48*a.getResources().getDisplayMetrics().density));
                    ((EditText)a.findViewById(R.id.url_input)).setText("https://instagram.com/reels/De3hNM7x4jE/");
                });
                snapshot("dlsta-small-dark");
                scenario.onActivity(a->a.findViewById(R.id.theme_button).performClick());InstrumentationRegistry.getInstrumentation().waitForIdleSync();
                scenario.onActivity(a->{assertSystemBarContrast(a, a.getPreferences(Context.MODE_PRIVATE).getBoolean("light",false));assertTrue("Theme toggle preserves typed link",((EditText)a.findViewById(R.id.url_input)).getText().toString().contains("De3hNM7x4jE"));fullyVisible(a.findViewById(R.id.lookup_button));});
                snapshot("dlsta-small-light");
                scenario.onActivity(this::injectResult);InstrumentationRegistry.getInstrumentation().waitForIdleSync();
                scenario.onActivity(a->{((ScrollView)a.findViewById(R.id.main_scroll)).scrollTo(0,a.findViewById(R.id.results).getTop());});InstrumentationRegistry.getInstrumentation().waitForIdleSync();
                snapshot("dlsta-small-result");
                scenario.recreate();InstrumentationRegistry.getInstrumentation().waitForIdleSync();
                scenario.onActivity(a->{assertNotNull("Result survives recreation",a.findViewById(R.id.save_button));assertEquals("Carousel restored", "1 / 2",((TextView)a.findViewById(R.id.media_counter)).getText().toString());});
            }
            shell("wm size 1280x800");shell("wm density 160");shell("settings put system font_scale 1.0");SystemClock.sleep(1000);
            try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)) {
                InstrumentationRegistry.getInstrumentation().waitForIdleSync();
                scenario.onActivity(a->{assertSystemBarContrast(a, a.getPreferences(Context.MODE_PRIVATE).getBoolean("light",false));View root=a.findViewById(R.id.main_content);assertTrue("Wide layouts cap content width",root.getWidth()<=Math.round(600*a.getResources().getDisplayMetrics().density)+1);fullyVisible(a.findViewById(R.id.url_input));fullyVisible(a.findViewById(R.id.lookup_button));});
                snapshot("dlsta-wide");
            }
        } finally {
            context.getSharedPreferences("MainActivity",Context.MODE_PRIVATE).edit().putBoolean("light",original).commit();
            shell("settings put system font_scale 1.0");shell("wm size reset");shell("wm density reset");
        }
    }
}
