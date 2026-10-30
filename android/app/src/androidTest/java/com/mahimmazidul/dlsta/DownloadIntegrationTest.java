package com.mahimmazidul.dlsta;

import static org.junit.Assert.*;
import android.content.ContentResolver;
import android.content.Context;
import android.database.Cursor;
import android.provider.MediaStore;
import android.widget.EditText;
import android.widget.TextView;
import androidx.test.core.app.ActivityScenario;
import androidx.test.core.app.ApplicationProvider;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.util.concurrent.atomic.AtomicReference;

/** Real network, native screen, native queue and shared storage. May fail if upstream blocks the runner. */
@RunWith(AndroidJUnit4.class)
public class DownloadIntegrationTest {
    private String read(ActivityScenario<MainActivity> s,int id){AtomicReference<String> result=new AtomicReference<>("");s.onActivity(a->{TextView v=a.findViewById(id);if(v!=null)result.set(v.getText().toString());});return result.get();}
    private String waitFinished(ActivityScenario<MainActivity> s) throws Exception {
        long deadline=System.currentTimeMillis()+150000;
        while(System.currentTimeMillis()<deadline){String status=read(s,R.id.queue_status);if(status.startsWith("Finished"))return status;Thread.sleep(1000);}
        throw new AssertionError("Timed out waiting for downloads");
    }
    @Test public void downloadsPublicCarouselAndSkipsSavedFilesOnRepeat() throws Exception {
        String prefix="instagram_DfGUZ1GjB-A_";Context context=ApplicationProvider.getApplicationContext();ContentResolver resolver=context.getContentResolver();
        try(ActivityScenario<MainActivity> s=ActivityScenario.launch(MainActivity.class)) {
            s.onActivity(a->{((EditText)a.findViewById(R.id.url_input)).setText("https://www.instagram.com/p/DfGUZ1GjB-A/");a.findViewById(R.id.lookup_button).performClick();});
            long deadline=System.currentTimeMillis()+110000;boolean found=false;
            while(System.currentTimeMillis()<deadline){AtomicReference<Boolean> ready=new AtomicReference<>(false);s.onActivity(a->ready.set(a.findViewById(R.id.save_all_button)!=null));if(ready.get()){found=true;break;}String message=read(s,R.id.message);if(message.startsWith("Could not")||message.startsWith("Enter a"))fail("Real Android lookup failed: "+message);Thread.sleep(750);}
            assertTrue("Public carousel must load on Android",found);
            s.onActivity(a->a.findViewById(R.id.save_all_button).performClick());String first=waitFinished(s);assertTrue("Expected three saved files: "+first,first.contains("3 saved")&&first.contains("0 failed"));
            try(Cursor files=resolver.query(MediaStore.Downloads.EXTERNAL_CONTENT_URI,new String[]{MediaStore.Downloads.SIZE},MediaStore.Downloads.DISPLAY_NAME+" LIKE ?",new String[]{prefix+"%"},null)){assertNotNull(files);assertEquals(3,files.getCount());while(files.moveToNext())assertTrue(files.getLong(0)>0);}
            s.onActivity(a->a.findViewById(R.id.save_all_button).performClick());String second=waitFinished(s);assertTrue("Repeat should skip existing files: "+second,second.contains("3 already saved")&&second.contains("0 failed"));
            try(Cursor files=resolver.query(MediaStore.Downloads.EXTERNAL_CONTENT_URI,new String[]{MediaStore.Downloads._ID},MediaStore.Downloads.DISPLAY_NAME+" LIKE ?",new String[]{prefix+"%"},null)){assertNotNull(files);assertEquals(3,files.getCount());}
        } finally {resolver.delete(MediaStore.Downloads.EXTERNAL_CONTENT_URI,MediaStore.Downloads.DISPLAY_NAME+" LIKE ?",new String[]{prefix+"%"});}
    }
}
