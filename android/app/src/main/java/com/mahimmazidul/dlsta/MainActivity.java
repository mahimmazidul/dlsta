package com.mahimmazidul.dlsta;

import android.app.Activity;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.content.res.ColorStateList;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.InputType;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.View;
import android.view.inputmethod.EditorInfo;
import android.view.inputmethod.InputMethodManager;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;
import androidx.work.BackoffPolicy;
import androidx.work.Constraints;
import androidx.work.Data;
import androidx.work.ExistingWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.WorkContinuation;
import androidx.work.WorkInfo;
import androidx.work.WorkManager;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

/** Native Android interface; network lookups and media saves never run on the UI thread. */
public final class MainActivity extends Activity {
    private final ExecutorService lookupIo=Executors.newSingleThreadExecutor();
    private final ExecutorService imageIo=Executors.newSingleThreadExecutor();
    private final ExecutorService queueIo=Executors.newSingleThreadExecutor();
    private final Handler handler=new Handler(Looper.getMainLooper());
    private LinearLayout page, results, controls; private EditText input; private TextView message, queueStatus, counter, caption, direct, mediaKind; private ImageView preview;
    private Button get, previous, next, saveAll; private ProgressBar progress;
    private InstagramLookup.Result current; private String shortcode="", batch=""; private int selected=0, generation=0, imageGeneration=0;
    private boolean light=false; private int background, text, muted, surface, surface2, stroke, accent, buttonText;
    private int dp(float value){return Math.round(getResources().getDisplayMetrics().density*value);}
    private GradientDrawable shape(int color, int radius, int border){GradientDrawable d=new GradientDrawable();d.setColor(color);d.setCornerRadius(dp(radius));if(border!=0)d.setStroke(dp(1),border);return d;}
    private LinearLayout vertical(){LinearLayout l=new LinearLayout(this);l.setOrientation(LinearLayout.VERTICAL);return l;}
    private LinearLayout horizontal(){LinearLayout l=new LinearLayout(this);l.setOrientation(LinearLayout.HORIZONTAL);l.setGravity(Gravity.CENTER_VERTICAL);return l;}
    private void gap(LinearLayout l,int height){View v=new View(this);l.addView(v,new LinearLayout.LayoutParams(1,dp(height)));}
    private TextView text(String value,int size,int color,boolean bold){TextView t=new TextView(this);t.setText(value);t.setTextSize(size);t.setTextColor(color);if(bold)t.setTypeface(Typeface.create("sans-serif-medium",Typeface.NORMAL));t.setIncludeFontPadding(true);return t;}
    private Button button(String title, boolean primary){Button b=new Button(this);b.setText(title);b.setTextSize(14);b.setAllCaps(false);b.setTypeface(Typeface.create("sans-serif-medium",Typeface.NORMAL));b.setTextColor(primary?buttonText:text);b.setBackground(shape(primary?accent:surface2,16,primary?0:stroke));b.setMinHeight(0);b.setMinimumHeight(dp(48));b.setPadding(dp(16),0,dp(16),0);return b;}
    private void colors(){background=Color.parseColor(light?"#F7F7F2":"#111512");text=Color.parseColor(light?"#182019":"#F1F5EC");muted=Color.parseColor(light?"#637067":"#A0ADA1");surface=Color.parseColor(light?"#FFFFFF":"#1A211B");surface2=Color.parseColor(light?"#EEF2E9":"#253027");stroke=Color.parseColor(light?"#DCE6D9":"#344137");accent=Color.parseColor(light?"#276A3C":"#C5F27C");buttonText=Color.parseColor(light?"#FFFFFF":"#1B2916");}
    @Override public void onCreate(Bundle state){super.onCreate(state);light=getPreferences(MODE_PRIVATE).getBoolean("light",false);buildScreen("");}
    private void buildScreen(String typed){
        colors();getWindow().setStatusBarColor(background);getWindow().setNavigationBarColor(background);
        getWindow().getDecorView().setSystemUiVisibility(light?View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR|View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR:0);
        ScrollView scroll=new ScrollView(this);scroll.setFillViewport(true);scroll.setBackgroundColor(background);scroll.setClipToPadding(false);
        page=vertical();page.setPadding(dp(24),dp(18),dp(24),dp(34));scroll.addView(page);setContentView(scroll);
        LinearLayout top=horizontal();ImageView icon=new ImageView(this);icon.setImageResource(R.drawable.ic_launcher);icon.setScaleType(ImageView.ScaleType.FIT_CENTER);top.addView(icon,new LinearLayout.LayoutParams(dp(42),dp(42)));
        TextView brand=text("dlsta",23,text,true);LinearLayout.LayoutParams brandParams=new LinearLayout.LayoutParams(0,-2,1);brandParams.leftMargin=dp(10);top.addView(brand,brandParams);
        Button theme=button(light?"☾":"☼",false);theme.setContentDescription(light?"Switch to dark mode":"Switch to light mode");theme.setTextSize(21);theme.setPadding(0,0,0,0);top.addView(theme,new LinearLayout.LayoutParams(dp(48),dp(48)));page.addView(top);
        theme.setOnClickListener(v->{String value=input.getText().toString();light=!light;getPreferences(MODE_PRIVATE).edit().putBoolean("light",light).apply();buildScreen(value);});
        gap(page,36);TextView eyebrow=text("YOUR MEDIA, MADE SIMPLE",11,accent,true);eyebrow.setLetterSpacing(.12f);page.addView(eyebrow);gap(page,9);
        TextView title=text("Save what you love.",30,text,true);title.setLetterSpacing(-.025f);page.addView(title);gap(page,7);
        TextView subtitle=text("Photos, reels and carousels — right to your phone.",15,muted,false);subtitle.setLineSpacing(dp(3),1f);page.addView(subtitle);gap(page,30);
        TextView label=text("Instagram link",14,text,true);page.addView(label);gap(page,9);
        LinearLayout entry=horizontal();entry.setBackground(shape(surface,18,stroke));entry.setPadding(dp(14),dp(3),dp(5),dp(3));
        input=new EditText(this);input.setId(R.id.url_input);input.setSingleLine(true);input.setTextSize(15);input.setTextColor(text);input.setHintTextColor(muted);input.setHint("Paste a post or reel link");input.setInputType(InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_URI);input.setImeOptions(EditorInfo.IME_ACTION_GO);input.setBackgroundColor(Color.TRANSPARENT);input.setPadding(0,dp(12),dp(4),dp(12));input.setText(typed);entry.addView(input,new LinearLayout.LayoutParams(0,dp(50),1));
        Button paste=button("Paste",false);paste.setId(R.id.paste_button);entry.addView(paste,new LinearLayout.LayoutParams(-2,dp(44)));page.addView(entry);paste.setOnClickListener(v->paste());
        input.setOnEditorActionListener((v,action,event)->{if(action==EditorInfo.IME_ACTION_GO||(event!=null&&event.getKeyCode()==KeyEvent.KEYCODE_ENTER)){startLookup();return true;}return false;});
        gap(page,13);get=button("Get media",true);get.setId(R.id.lookup_button);page.addView(get,new LinearLayout.LayoutParams(-1,dp(54)));get.setOnClickListener(v->startLookup());
        gap(page,13);progress=new ProgressBar(this,null,android.R.attr.progressBarStyleHorizontal);progress.setIndeterminate(true);progress.setIndeterminateTintList(ColorStateList.valueOf(accent));page.addView(progress,new LinearLayout.LayoutParams(-1,dp(4)));progress.setVisibility(View.GONE);
        message=text("",14,muted,false);message.setId(R.id.message);message.setLineSpacing(dp(3),1f);page.addView(message);results=vertical();results.setId(R.id.results);page.addView(results);controls=vertical();page.addView(controls);
        if(current!=null)renderResult();
        gap(page,32);TextView footer=text("dlsta  •  Public media only",12,muted,false);footer.setGravity(Gravity.CENTER);page.addView(footer);
        if(!batch.isEmpty())pollBatch(batch);
    }
    private void paste(){ClipboardManager clipboard=(ClipboardManager)getSystemService(Context.CLIPBOARD_SERVICE);ClipData clip=clipboard.getPrimaryClip();if(clip==null||clip.getItemCount()==0){message.setText("Your clipboard is empty.");return;}CharSequence value=clip.getItemAt(0).coerceToText(this);input.setText(value==null?"":value.toString());input.setSelection(input.length());message.setText("");}
    private void startLookup(){
        String raw=input.getText().toString().trim();if(raw.isEmpty()){paste();raw=input.getText().toString().trim();}
        final String valid;try{valid=InstagramLookup.normalize(raw);}catch(IllegalArgumentException e){message.setText(e.getMessage());input.setText("");return;}
        ((InputMethodManager)getSystemService(INPUT_METHOD_SERVICE)).hideSoftInputFromWindow(input.getWindowToken(),0);input.clearFocus();
        final int request=++generation;current=null;results.removeAllViews();controls.removeAllViews();get.setEnabled(false);progress.setVisibility(View.VISIBLE);message.setText("Finding your media…");
        lookupIo.execute(()->{try{InstagramLookup.Result result=InstagramLookup.lookup(valid);runOnUiThread(()->{if(isFinishing()||request!=generation)return;current=result;shortcode=valid.split("/")[4];selected=0;input.setText("");get.setEnabled(true);progress.setVisibility(View.GONE);message.setText("");renderResult();});}
            catch(Exception e){runOnUiThread(()->{if(isFinishing()||request!=generation)return;get.setEnabled(true);progress.setVisibility(View.GONE);input.setText("");message.setText(e.getMessage()==null?"Could not retrieve this post. Please try again.":e.getMessage());});}});
    }
    private void renderResult(){
        results.removeAllViews();controls.removeAllViews();if(current==null||current.items.isEmpty())return;selected=Math.max(0,Math.min(selected,current.items.size()-1));
        gap(results,30);LinearLayout heading=horizontal();TextView section=text("Ready to save",21,text,true);heading.addView(section,new LinearLayout.LayoutParams(0,-2,1));counter=text("",13,muted,true);counter.setId(R.id.media_counter);heading.addView(counter);results.addView(heading);gap(results,13);
        android.widget.FrameLayout frame=new android.widget.FrameLayout(this);frame.setBackground(shape(surface,20,stroke));frame.setClipToOutline(true);preview=new ImageView(this);preview.setContentDescription("Media preview");preview.setScaleType(ImageView.ScaleType.FIT_CENTER);frame.addView(preview,new android.widget.FrameLayout.LayoutParams(-1,-1));
        mediaKind=text("",12,text,true);mediaKind.setBackground(shape(surface2,10,0));mediaKind.setPadding(dp(10),dp(5),dp(10),dp(5));android.widget.FrameLayout.LayoutParams kindParams=new android.widget.FrameLayout.LayoutParams(-2,-2,Gravity.TOP|Gravity.START);kindParams.setMargins(dp(12),dp(12),0,0);frame.addView(mediaKind,kindParams);
        results.addView(frame,new LinearLayout.LayoutParams(-1,dp(280)));
        LinearLayout navigation=horizontal();navigation.setGravity(Gravity.CENTER);previous=button("‹  Previous",false);next=button("Next  ›",false);previous.setId(R.id.previous_button);next.setId(R.id.next_button);navigation.addView(previous,new LinearLayout.LayoutParams(0,dp(46),1));LinearLayout.LayoutParams right=new LinearLayout.LayoutParams(0,dp(46),1);right.leftMargin=dp(10);navigation.addView(next,right);gap(results,10);results.addView(navigation);navigation.setVisibility(current.items.size()>1?View.VISIBLE:View.GONE);previous.setOnClickListener(v->{selected=(selected-1+current.items.size())%current.items.size();showSelected();});next.setOnClickListener(v->{selected=(selected+1)%current.items.size();showSelected();});
        caption=text(current.caption,14,muted,false);caption.setLineSpacing(dp(3),1f);caption.setMaxLines(4);if(!current.caption.isEmpty()){gap(results,14);results.addView(caption);}
        gap(results,18);Button save=button("Save this media",true);save.setId(R.id.save_button);results.addView(save,new LinearLayout.LayoutParams(-1,dp(54)));save.setOnClickListener(v->enqueue(false));
        saveAll=button("Save all separately",false);saveAll.setId(R.id.save_all_button);if(current.total>1||current.items.size()>1){gap(results,10);results.addView(saveAll,new LinearLayout.LayoutParams(-1,dp(50)));saveAll.setOnClickListener(v->enqueue(true));}
        if(current.partial){gap(results,10);TextView notice=text("Some items aren't available from this post.",13,muted,false);results.addView(notice);}
        gap(results,22);TextView linkLabel=text("Direct media link",13,text,true);results.addView(linkLabel);gap(results,8);
        LinearLayout linkRow=horizontal();linkRow.setBackground(shape(surface,16,stroke));linkRow.setPadding(dp(12),dp(4),dp(5),dp(4));direct=text("",13,muted,false);direct.setSingleLine(true);direct.setHorizontallyScrolling(true);direct.setTextIsSelectable(true);linkRow.addView(direct,new LinearLayout.LayoutParams(0,dp(44),1));Button copy=button("Copy",false);copy.setId(R.id.copy_button);linkRow.addView(copy,new LinearLayout.LayoutParams(-2,dp(42)));results.addView(linkRow);copy.setOnClickListener(v->{String url=current.items.get(selected).url;((ClipboardManager)getSystemService(CLIPBOARD_SERVICE)).setPrimaryClip(ClipData.newPlainText("Direct media link",url));Toast.makeText(this,"Link copied",Toast.LENGTH_SHORT).show();});
        gap(results,10);Button open=button("Open direct media  ↗",false);open.setId(R.id.open_button);results.addView(open,new LinearLayout.LayoutParams(-1,dp(48)));open.setOnClickListener(v->{String url=current.items.get(selected).url;if(MediaRules.allowedUrl(url))try{startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse(url)));}catch(Exception e){message.setText("No app is available to open this link.");}});
        gap(results,14);queueStatus=text("",13,muted,false);queueStatus.setId(R.id.queue_status);queueStatus.setLineSpacing(dp(3),1f);results.addView(queueStatus);showSelected();
    }
    private void showSelected(){if(current==null)return;InstagramLookup.Item item=current.items.get(selected);counter.setText(current.items.size()>1?(selected+1)+" / "+current.items.size():"1 item");mediaKind.setText(item.type.equals("video")?"VIDEO":"PHOTO");direct.setText(item.url);preview.setImageDrawable(null);preview.setContentDescription("Loading media preview");final int token=++imageGeneration;String url=item.thumbnail; if(url.isEmpty())url=item.type.equals("photo")?item.url:"";if(!MediaRules.allowedUrl(url))return;final String target=url;
        imageIo.execute(()->{Bitmap bitmap=loadPreview(target);runOnUiThread(()->{if(token==imageGeneration&&!isFinishing()&&preview!=null&&bitmap!=null){preview.setImageBitmap(bitmap);preview.setContentDescription("Media preview");}});});
    }
    private Bitmap loadPreview(String url){HttpURLConnection c=null;try{for(int i=0;i<5;i++){if(!MediaRules.allowedUrl(url))return null;c=(HttpURLConnection)new URL(url).openConnection();c.setInstanceFollowRedirects(false);c.setConnectTimeout(7000);c.setReadTimeout(7000);int status=c.getResponseCode();if(status>=300&&status<400){String next=c.getHeaderField("Location");if(next==null)return null;url=new URL(new URL(url),next).toString();c.disconnect();c=null;continue;}if(status!=200||c.getContentLengthLong()>8_000_000)return null;try(InputStream in=c.getInputStream();ByteArrayOutputStream out=new ByteArrayOutputStream()){byte[] buf=new byte[8192];int n,total=0;while((n=in.read(buf))!=-1){total+=n;if(total>8_000_000)return null;out.write(buf,0,n);}byte[] data=out.toByteArray();BitmapFactory.Options options=new BitmapFactory.Options();options.inJustDecodeBounds=true;BitmapFactory.decodeByteArray(data,0,data.length,options);options.inSampleSize=Math.max(1,Math.max(options.outWidth,options.outHeight)/1200);options.inJustDecodeBounds=false;return BitmapFactory.decodeByteArray(data,0,data.length,options);}}}catch(Exception ignored){}finally{if(c!=null)c.disconnect();}return null;}
    private void enqueue(boolean all){if(current==null)return;List<InstagramLookup.Item> list=new ArrayList<>();if(all)list.addAll(current.items);else list.add(current.items.get(selected));
        String newBatch="dlsta-batch-"+UUID.randomUUID();List<OneTimeWorkRequest> jobs=new ArrayList<>();Constraints network=new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build();boolean multi=current.total>1||current.items.size()>1;
        for(InstagramLookup.Item item:list){String filename="instagram_"+shortcode+(multi?"_"+item.position:"");if(!MediaRules.allowedUrl(item.url)||!MediaRules.allowedFilename(filename)){queueStatus.setText("Unsupported media link.");return;}Data data=new Data.Builder().putString("url",item.url).putString("filename",filename).build();jobs.add(new OneTimeWorkRequest.Builder(DownloadWorker.class).setInputData(data).setConstraints(network).setBackoffCriteria(BackoffPolicy.EXPONENTIAL,20,TimeUnit.SECONDS).addTag(newBatch).build());}
        try{WorkContinuation chain=WorkManager.getInstance(this).beginUniqueWork("dlsta-download-queue",ExistingWorkPolicy.APPEND_OR_REPLACE,jobs.get(0));for(int i=1;i<jobs.size();i++)chain=chain.then(jobs.get(i));chain.enqueue();batch=newBatch;queueStatus.setText("Queued "+jobs.size()+" file(s) for Downloads / dlsta.");handler.postDelayed(()->pollBatch(newBatch),1000);}catch(Exception e){queueStatus.setText("Could not queue downloads. Please try again.");}
    }
    private void pollBatch(String id){if(id.isEmpty()||!id.equals(batch))return;queueIo.execute(()->{try{List<WorkInfo> info=WorkManager.getInstance(this).getWorkInfosByTag(id).get(10,TimeUnit.SECONDS);int saved=0,existing=0,failed=0,waiting=0;for(WorkInfo work:info){if(!work.getState().isFinished()){waiting++;continue;}String outcome=work.getOutputData().getString("outcome");if("downloaded".equals(outcome))saved++;else if("existing".equals(outcome))existing++;else failed++;}final int s=saved,e=existing,f=failed,w=waiting,total=info.size();runOnUiThread(()->{if(isFinishing()||!id.equals(batch))return;if(queueStatus!=null)queueStatus.setText((w>0?"Processing "+(total-w)+" of "+total+" · ":"Finished · ")+s+" saved · "+e+" already saved · "+f+" failed\nDownloads / dlsta");if(w>0||total==0)handler.postDelayed(()->pollBatch(id),1500);});}catch(Exception ignored){runOnUiThread(()->{if(queueStatus!=null)queueStatus.setText("Unable to check download progress.");});}});}
    @Override protected void onDestroy(){generation++;imageGeneration++;handler.removeCallbacksAndMessages(null);lookupIo.shutdownNow();imageIo.shutdownNow();queueIo.shutdownNow();super.onDestroy();}
}
