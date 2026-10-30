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
import android.graphics.drawable.RippleDrawable;
import android.graphics.drawable.StateListDrawable;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.InputType;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.inputmethod.EditorInfo;
import android.view.inputmethod.InputMethodManager;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.ImageButton;
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

/** The Android UI, lookup and download queue run on the device, with no web interface. */
public final class MainActivity extends Activity {
    private final ExecutorService lookupIo = Executors.newSingleThreadExecutor();
    private final ExecutorService imageIo = Executors.newSingleThreadExecutor();
    private final ExecutorService queueIo = Executors.newSingleThreadExecutor();
    private final Handler handler = new Handler(Looper.getMainLooper());
    private LinearLayout page, results;
    private EditText input;
    private TextView message, queueStatus, counter, direct, mediaKind;
    private ImageView preview;
    private Button get;
    private ProgressBar progress;
    private InstagramLookup.Result current;
    private String shortcode = "", batch = "";
    private int selected = 0, generation = 0, imageGeneration = 0, pollGeneration = 0;
    private boolean light = false, loading = false;
    private int background, text, muted, surface, surface2, stroke, accent, buttonText, ripple;

    private int dp(float value) { return Math.round(getResources().getDisplayMetrics().density * value); }
    private GradientDrawable shape(int color, int radius, int border) {
        GradientDrawable drawable = new GradientDrawable();
        drawable.setColor(color); drawable.setCornerRadius(dp(radius));
        if (border != 0) drawable.setStroke(dp(1), border);
        return drawable;
    }
    private RippleDrawable ripple(int color, int radius, int border) {
        return new RippleDrawable(ColorStateList.valueOf(ripple), shape(color, radius, border), null);
    }
    private LinearLayout vertical() { LinearLayout v = new LinearLayout(this); v.setOrientation(LinearLayout.VERTICAL); return v; }
    private LinearLayout horizontal() { LinearLayout v = new LinearLayout(this); v.setOrientation(LinearLayout.HORIZONTAL); v.setGravity(Gravity.CENTER_VERTICAL); return v; }
    private void gap(LinearLayout parent, int height) { View v = new View(this); parent.addView(v, new LinearLayout.LayoutParams(1, dp(height))); }
    private TextView text(String value, int size, int color, boolean medium) {
        TextView view = new TextView(this); view.setText(value); view.setTextSize(size); view.setTextColor(color);
        if (medium) view.setTypeface(Typeface.create("sans-serif-medium", Typeface.NORMAL));
        return view;
    }
    private Button button(String title, boolean primary) {
        Button view = new Button(this); view.setText(title); view.setTextSize(15); view.setAllCaps(false);
        view.setTypeface(Typeface.create("sans-serif-medium", Typeface.NORMAL)); view.setTextColor(primary ? buttonText : text);
        view.setBackground(ripple(primary ? accent : surface2, 15, primary ? 0 : stroke));
        view.setMinHeight(0); view.setMinimumHeight(dp(52)); view.setPadding(dp(16), dp(12), dp(16), dp(12));
        return view;
    }
    private void colors() {
        background = Color.parseColor(light ? "#F7F8F4" : "#101512");
        text = Color.parseColor(light ? "#1A251C" : "#F0F4ED");
        muted = Color.parseColor(light ? "#637267" : "#A2B0A5");
        surface = Color.parseColor(light ? "#FFFFFF" : "#1A221C");
        surface2 = Color.parseColor(light ? "#EBF0E8" : "#253128");
        stroke = Color.parseColor(light ? "#D5E1D2" : "#34453A");
        accent = Color.parseColor(light ? "#2C6A40" : "#C4EFA3");
        buttonText = Color.parseColor(light ? "#FFFFFF" : "#182719");
        ripple = Color.parseColor(light ? "#332A6941" : "#44E3FFCF");
    }
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        light = getPreferences(MODE_PRIVATE).getBoolean("light", false);
        String typed = "", notice = "";
        if (state != null) {
            typed = state.getString("input", ""); notice = state.getString("notice", "");
            shortcode = state.getString("shortcode", ""); batch = state.getString("batch", ""); selected = state.getInt("selected", 0);
            ArrayList<String> urls = state.getStringArrayList("urls"), types = state.getStringArrayList("types"), thumbs = state.getStringArrayList("thumbs");
            int[] positions = state.getIntArray("positions");
            if (urls != null && types != null && thumbs != null && positions != null && urls.size() == types.size() && urls.size() == thumbs.size() && urls.size() == positions.length) {
                List<InstagramLookup.Item> items = new ArrayList<>();
                for (int i = 0; i < urls.size(); i++) if (MediaRules.allowedUrl(urls.get(i))) items.add(new InstagramLookup.Item(types.get(i), urls.get(i), thumbs.get(i), positions[i]));
                if (!items.isEmpty()) current = new InstagramLookup.Result(items, state.getString("caption", ""), "device", state.getInt("total", items.size()), state.getBoolean("partial", false));
            }
            if (state.getBoolean("loading")) notice = "Lookup interrupted. Tap Get media to try again.";
        }
        buildScreen(typed, notice);
    }
    @Override protected void onSaveInstanceState(Bundle state) {
        super.onSaveInstanceState(state);
        state.putString("input", input == null ? "" : input.getText().toString());
        state.putString("notice", message == null ? "" : message.getText().toString());
        state.putString("shortcode", shortcode); state.putString("batch", batch); state.putInt("selected", selected); state.putBoolean("loading", loading);
        if (current != null) {
            ArrayList<String> urls = new ArrayList<>(), types = new ArrayList<>(), thumbs = new ArrayList<>();
            int[] positions = new int[current.items.size()]; int size = 0;
            for (int i = 0; i < current.items.size(); i++) {
                InstagramLookup.Item item = current.items.get(i); urls.add(item.url); types.add(item.type); thumbs.add(item.thumbnail); positions[i] = item.position;
                size += item.url.length() + item.thumbnail.length() + item.type.length();
            }
            // Avoid oversized Binder transactions for unusually long signed carousel links.
            if (size < 200000) {
                state.putStringArrayList("urls", urls); state.putStringArrayList("types", types); state.putStringArrayList("thumbs", thumbs); state.putIntArray("positions", positions);
                state.putString("caption", current.caption); state.putInt("total", current.total); state.putBoolean("partial", current.partial);
            }
        }
    }
    private void applySystemBars() {
        getWindow().setStatusBarColor(background); getWindow().setNavigationBarColor(background);
        getWindow().setNavigationBarContrastEnforced(false);
        if (Build.VERSION.SDK_INT >= 30) {
            WindowInsetsController controller = getWindow().getInsetsController();
            if (controller != null) {
                int mask = WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS;
                controller.setSystemBarsAppearance(light ? mask : 0, mask);
            }
        } else {
            getWindow().getDecorView().setSystemUiVisibility(light ? View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR : 0);
        }
    }
    @Override public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) applySystemBars();
    }
    private void buildScreen(String typed, String notice) {
        colors();
        getWindow().setSoftInputMode(android.view.WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
        ScrollView scroll = new ScrollView(this); scroll.setFillViewport(true); scroll.setBackgroundColor(background); scroll.setClipToPadding(false);
        scroll.setId(R.id.main_scroll);
        if (Build.VERSION.SDK_INT >= 35) {
            scroll.setOnApplyWindowInsetsListener((view, insets) -> {
                android.graphics.Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                view.setPadding(bars.left, bars.top, bars.right, bars.bottom); return insets;
            });
        }
        FrameLayout container = new FrameLayout(this); scroll.addView(container); page = vertical(); page.setId(R.id.main_content);
        int screenWidth = getResources().getConfiguration().screenWidthDp;
        int horizontalPadding = screenWidth < 350 ? 20 : 24;
        page.setPadding(dp(horizontalPadding), dp(18), dp(horizontalPadding), dp(32));
        int pageWidth = Math.min(dp(600), getResources().getDisplayMetrics().widthPixels);
        FrameLayout.LayoutParams pageParams = new FrameLayout.LayoutParams(pageWidth, FrameLayout.LayoutParams.WRAP_CONTENT, Gravity.TOP | Gravity.CENTER_HORIZONTAL);
        container.addView(page, pageParams); setContentView(scroll); applySystemBars();

        LinearLayout top = horizontal();
        ImageView icon = new ImageView(this); icon.setImageResource(R.drawable.ic_launcher); icon.setScaleType(ImageView.ScaleType.FIT_CENTER); icon.setContentDescription(null);
        top.addView(icon, new LinearLayout.LayoutParams(dp(40), dp(40)));
        TextView brand = text("dlsta", 22, text, true); LinearLayout.LayoutParams brandParams = new LinearLayout.LayoutParams(0, -2, 1); brandParams.leftMargin = dp(11); top.addView(brand, brandParams);
        ImageButton theme = new ImageButton(this); theme.setId(R.id.theme_button); theme.setImageResource(light ? R.drawable.ic_moon : R.drawable.ic_sun);
        theme.setImageTintList(ColorStateList.valueOf(text)); theme.setBackground(ripple(surface, 16, stroke)); theme.setPadding(dp(13), dp(13), dp(13), dp(13));
        theme.setContentDescription(light ? "Switch to dark mode" : "Switch to light mode"); top.addView(theme, new LinearLayout.LayoutParams(dp(48), dp(48))); page.addView(top);
        theme.setOnClickListener(v -> { String value = input.getText().toString(), note = message.getText().toString(); light = !light; getPreferences(MODE_PRIVATE).edit().putBoolean("light", light).apply(); buildScreen(value, note); });

        gap(page, screenWidth < 350 ? 28 : 36);
        TextView title = text("Save from Instagram.", screenWidth < 350 ? 27 : 30, text, true); title.setLetterSpacing(-0.025f); page.addView(title);
        gap(page, 5); TextView subtitle = text("Photos, reels and carousels, saved to your phone.", 15, muted, false); subtitle.setLineSpacing(dp(2), 1f); page.addView(subtitle);
        gap(page, 27); page.addView(text("Instagram link", 14, text, true)); gap(page, 9);
        LinearLayout entry = horizontal(); entry.setId(R.id.input_container); entry.setAddStatesFromChildren(true);
        StateListDrawable field = new StateListDrawable(); field.addState(new int[]{android.R.attr.state_focused}, shape(surface, 17, accent)); field.addState(new int[]{}, shape(surface, 17, stroke));
        entry.setBackground(field); entry.setPadding(dp(15), dp(4), dp(5), dp(4));
        input = new EditText(this); input.setId(R.id.url_input); input.setSingleLine(true); input.setTextSize(15); input.setTextColor(text); input.setHintTextColor(muted);
        input.setHint("Paste a post or reel link"); input.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI); input.setImeOptions(EditorInfo.IME_ACTION_GO);
        input.setBackgroundColor(Color.TRANSPARENT); input.setPadding(0, dp(12), dp(6), dp(12)); input.setText(typed);
        entry.addView(input, new LinearLayout.LayoutParams(0, -2, 1));
        Button paste = button("Paste", false); paste.setId(R.id.paste_button); paste.setTextSize(14); paste.setMinimumHeight(dp(44)); paste.setPadding(dp(15), dp(8), dp(15), dp(8));
        entry.addView(paste, new LinearLayout.LayoutParams(-2, -2)); page.addView(entry); paste.setOnClickListener(v -> paste());
        input.setOnEditorActionListener((v, action, event) -> { if (action == EditorInfo.IME_ACTION_GO || (event != null && event.getKeyCode() == KeyEvent.KEYCODE_ENTER)) { startLookup(); return true; } return false; });
        gap(page, 12); get = button("Get media", true); get.setId(R.id.lookup_button); page.addView(get, new LinearLayout.LayoutParams(-1, -2)); get.setOnClickListener(v -> startLookup());
        gap(page, 12); progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal); progress.setIndeterminate(true); progress.setIndeterminateTintList(ColorStateList.valueOf(accent));
        page.addView(progress, new LinearLayout.LayoutParams(-1, dp(3))); progress.setVisibility(loading ? View.VISIBLE : View.GONE); get.setEnabled(!loading);
        message = text(notice, 14, muted, false); message.setId(R.id.message); message.setLineSpacing(dp(2), 1f); message.setAccessibilityLiveRegion(View.ACCESSIBILITY_LIVE_REGION_POLITE); page.addView(message);
        results = vertical(); results.setId(R.id.results); page.addView(results); if (current != null) renderResult();
        gap(page, 32); TextView footer = text("Saved to Downloads / dlsta", 12, muted, false); footer.setGravity(Gravity.CENTER); page.addView(footer);
        if (!batch.isEmpty()) schedulePoll(batch);
    }
    private void paste() {
        ClipboardManager clipboard = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE); ClipData clip = clipboard.getPrimaryClip();
        if (clip == null || clip.getItemCount() == 0) { message.setText("Your clipboard is empty."); return; }
        CharSequence value = clip.getItemAt(0).coerceToText(this); input.setText(value == null ? "" : value.toString()); input.setSelection(input.length()); message.setText("");
    }
    private void startLookup() {
        String raw = input.getText().toString().trim();
        if (raw.isEmpty()) { paste(); raw = input.getText().toString().trim(); if (raw.isEmpty()) return; }
        final String valid;
        try { valid = InstagramLookup.normalize(raw); }
        catch (IllegalArgumentException e) { message.setText(e.getMessage()); input.setText(""); return; }
        ((InputMethodManager) getSystemService(INPUT_METHOD_SERVICE)).hideSoftInputFromWindow(input.getWindowToken(), 0); input.clearFocus();
        final int request = ++generation; current = null; results.removeAllViews(); loading = true; get.setEnabled(false); progress.setVisibility(View.VISIBLE); message.setText("Finding your media…");
        lookupIo.execute(() -> {
            try {
                InstagramLookup.Result result = InstagramLookup.lookup(valid);
                runOnUiThread(() -> {
                    if (isFinishing() || request != generation) return;
                    current = result; shortcode = valid.split("/")[4]; selected = 0; input.setText(""); loading = false; get.setEnabled(true); progress.setVisibility(View.GONE); message.setText(""); renderResult();
                });
            } catch (Exception e) {
                runOnUiThread(() -> {
                    if (isFinishing() || request != generation) return;
                    loading = false; get.setEnabled(true); progress.setVisibility(View.GONE); input.setText("");
                    message.setText(e.getMessage() == null ? "Could not retrieve this post. Please try again." : e.getMessage());
                });
            }
        });
    }
    private void renderResult() {
        results.removeAllViews(); if (current == null || current.items.isEmpty()) return;
        selected = Math.max(0, Math.min(selected, current.items.size() - 1)); gap(results, 28);
        LinearLayout heading = horizontal(); heading.addView(text("Your media", 21, text, true), new LinearLayout.LayoutParams(0, -2, 1));
        counter = text("", 13, muted, true); counter.setId(R.id.media_counter); heading.addView(counter); results.addView(heading); gap(results, 12);
        FrameLayout frame = new FrameLayout(this); frame.setBackground(shape(surface, 20, stroke)); frame.setClipToOutline(true);
        preview = new ImageView(this); preview.setId(R.id.media_preview); preview.setContentDescription("Media preview"); preview.setScaleType(ImageView.ScaleType.FIT_CENTER);
        frame.addView(preview, new FrameLayout.LayoutParams(-1, -1));
        mediaKind = text("", 11, text, true); mediaKind.setLetterSpacing(.05f); mediaKind.setBackground(shape(surface2, 9, 0)); mediaKind.setPadding(dp(10), dp(5), dp(10), dp(5));
        FrameLayout.LayoutParams kindParams = new FrameLayout.LayoutParams(-2, -2, Gravity.TOP | Gravity.START); kindParams.setMargins(dp(12), dp(12), 0, 0); frame.addView(mediaKind, kindParams);
        int availableWidth = Math.min(getResources().getConfiguration().screenWidthDp, 600) - (getResources().getConfiguration().screenWidthDp < 350 ? 40 : 48);
        results.addView(frame, new LinearLayout.LayoutParams(-1, dp(Math.max(200, Math.min(availableWidth, 360)))));
        if (current.items.size() > 1) {
            enableSwipe(frame); gap(results, 10); LinearLayout navigation = horizontal();
            Button previous = button("‹   Previous", false), next = button("Next   ›", false); previous.setId(R.id.previous_button); next.setId(R.id.next_button);
            previous.setTextSize(14); next.setTextSize(14); previous.setPadding(dp(8), dp(10), dp(8), dp(10)); next.setPadding(dp(8), dp(10), dp(8), dp(10));
            navigation.addView(previous, new LinearLayout.LayoutParams(0, -2, 1)); LinearLayout.LayoutParams right = new LinearLayout.LayoutParams(0, -2, 1); right.leftMargin = dp(10); navigation.addView(next, right); results.addView(navigation);
            previous.setOnClickListener(v -> moveSelected(-1)); next.setOnClickListener(v -> moveSelected(1));
        }
        if (!current.caption.isEmpty()) { gap(results, 14); TextView caption = text(current.caption, 14, muted, false); caption.setLineSpacing(dp(3), 1f); caption.setMaxLines(4); results.addView(caption); }
        gap(results, 18); Button save = button("Save this media", true); save.setId(R.id.save_button); results.addView(save, new LinearLayout.LayoutParams(-1, -2)); save.setOnClickListener(v -> enqueue(false));
        if (current.total > 1 || current.items.size() > 1) {
            gap(results, 10); Button saveAll = button("Save all separately", false); saveAll.setId(R.id.save_all_button); results.addView(saveAll, new LinearLayout.LayoutParams(-1, -2)); saveAll.setOnClickListener(v -> enqueue(true));
        }
        if (current.partial) { gap(results, 10); results.addView(text("Some items aren't available from this post.", 13, muted, false)); }
        gap(results, 22); results.addView(text("Direct media link", 13, text, true)); gap(results, 8);
        LinearLayout linkRow = horizontal(); linkRow.setBackground(shape(surface, 16, stroke)); linkRow.setPadding(dp(12), dp(4), dp(5), dp(4));
        EditText link = new EditText(this); direct = link; link.setTextSize(13); link.setTextColor(muted); link.setSingleLine(true); link.setKeyListener(null); link.setTextIsSelectable(true);
        link.setBackgroundColor(Color.TRANSPARENT); link.setPadding(0, dp(10), dp(8), dp(10)); link.setContentDescription("Direct media link, scroll horizontally to read");
        linkRow.addView(link, new LinearLayout.LayoutParams(0, -2, 1)); Button copy = button("Copy", false); copy.setId(R.id.copy_button); copy.setTextSize(14); copy.setMinimumHeight(dp(44)); copy.setPadding(dp(14), dp(8), dp(14), dp(8));
        linkRow.addView(copy, new LinearLayout.LayoutParams(-2, -2)); results.addView(linkRow);
        copy.setOnClickListener(v -> { String url = current.items.get(selected).url; ((ClipboardManager) getSystemService(CLIPBOARD_SERVICE)).setPrimaryClip(ClipData.newPlainText("Direct media link", url)); Toast.makeText(this, "Link copied", Toast.LENGTH_SHORT).show(); });
        gap(results, 10); Button open = button("Open direct media ↗", false); open.setId(R.id.open_button); results.addView(open, new LinearLayout.LayoutParams(-1, -2));
        open.setOnClickListener(v -> { String url = current.items.get(selected).url; if (MediaRules.allowedUrl(url)) try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url))); } catch (Exception e) { message.setText("No app is available to open this link."); } });
        gap(results, 14); queueStatus = text("", 13, muted, false); queueStatus.setId(R.id.queue_status); queueStatus.setLineSpacing(dp(3), 1f); queueStatus.setAccessibilityLiveRegion(View.ACCESSIBILITY_LIVE_REGION_POLITE); results.addView(queueStatus);
        showSelected(); if (!batch.isEmpty()) schedulePoll(batch);
    }
    private void moveSelected(int direction) { if (current == null || current.items.size() < 2) return; selected = (selected + direction + current.items.size()) % current.items.size(); showSelected(); }
    private void enableSwipe(View view) {
        final float[] start = new float[2];
        view.setOnTouchListener((v, event) -> {
            if (event.getActionMasked() == MotionEvent.ACTION_DOWN) { start[0] = event.getX(); start[1] = event.getY(); return true; }
            if (event.getActionMasked() == MotionEvent.ACTION_MOVE) {
                float dx = event.getX() - start[0], dy = event.getY() - start[1];
                if (Math.abs(dx) > dp(12) && Math.abs(dx) > Math.abs(dy) * 1.2f) v.getParent().requestDisallowInterceptTouchEvent(true);
                return true;
            }
            if (event.getActionMasked() == MotionEvent.ACTION_UP) {
                float dx = event.getX() - start[0], dy = event.getY() - start[1];
                if (Math.abs(dx) > dp(45) && Math.abs(dx) > Math.abs(dy) * 1.2f) moveSelected(dx < 0 ? 1 : -1);
                else v.performClick();
                v.getParent().requestDisallowInterceptTouchEvent(false); return true;
            }
            if (event.getActionMasked() == MotionEvent.ACTION_CANCEL) v.getParent().requestDisallowInterceptTouchEvent(false);
            return true;
        });
    }
    private void showSelected() {
        if (current == null) return; InstagramLookup.Item item = current.items.get(selected);
        counter.setText(current.items.size() > 1 ? (selected + 1) + " / " + current.items.size() : "1 item");
        mediaKind.setText(item.type.equals("video") ? "VIDEO" : "PHOTO"); direct.setText(item.url); preview.setImageDrawable(null); preview.setContentDescription("Loading media preview");
        final int token = ++imageGeneration; String url = item.thumbnail; if (url.isEmpty()) url = item.type.equals("photo") ? item.url : "";
        if (!MediaRules.allowedUrl(url)) { preview.setContentDescription("Preview unavailable"); return; } final String target = url;
        imageIo.execute(() -> { Bitmap bitmap = loadPreview(target); runOnUiThread(() -> {
            if (token == imageGeneration && !isFinishing() && preview != null) {
                if (bitmap != null) { preview.setAlpha(0f); preview.setImageBitmap(bitmap); preview.animate().alpha(1f).setDuration(180).start(); preview.setContentDescription("Media preview"); }
                else preview.setContentDescription("Preview unavailable");
            }
        }); });
    }
    private Bitmap loadPreview(String url) {
        HttpURLConnection c = null;
        try {
            for (int i = 0; i < 5; i++) {
                if (!MediaRules.allowedUrl(url)) return null; c = (HttpURLConnection) new URL(url).openConnection(); c.setInstanceFollowRedirects(false); c.setConnectTimeout(7000); c.setReadTimeout(7000);
                int status = c.getResponseCode();
                if (status >= 300 && status < 400) { String next = c.getHeaderField("Location"); if (next == null) return null; url = new URL(new URL(url), next).toString(); c.disconnect(); c = null; continue; }
                if (status != 200 || c.getContentLengthLong() > 8_000_000) return null;
                try (InputStream in = c.getInputStream(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
                    byte[] buf = new byte[8192]; int n, total = 0; while ((n = in.read(buf)) != -1) { total += n; if (total > 8_000_000) return null; out.write(buf, 0, n); }
                    byte[] data = out.toByteArray(); BitmapFactory.Options options = new BitmapFactory.Options(); options.inJustDecodeBounds = true; BitmapFactory.decodeByteArray(data, 0, data.length, options);
                    options.inSampleSize = Math.max(1, Math.max(options.outWidth, options.outHeight) / 1200); options.inJustDecodeBounds = false; return BitmapFactory.decodeByteArray(data, 0, data.length, options);
                }
            }
        } catch (Exception ignored) { } finally { if (c != null) c.disconnect(); }
        return null;
    }
    private void enqueue(boolean all) {
        if (current == null) return; List<InstagramLookup.Item> list = new ArrayList<>(); if (all) list.addAll(current.items); else list.add(current.items.get(selected));
        String newBatch = "dlsta-batch-" + UUID.randomUUID(); List<OneTimeWorkRequest> jobs = new ArrayList<>(); Constraints network = new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build(); boolean multi = current.total > 1 || current.items.size() > 1;
        for (InstagramLookup.Item item : list) {
            String filename = "instagram_" + shortcode + (multi ? "_" + item.position : "");
            if (!MediaRules.allowedUrl(item.url) || !MediaRules.allowedFilename(filename)) { queueStatus.setText("Unsupported media link."); return; }
            Data data = new Data.Builder().putString("url", item.url).putString("filename", filename).build();
            jobs.add(new OneTimeWorkRequest.Builder(DownloadWorker.class).setInputData(data).setConstraints(network).setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 20, TimeUnit.SECONDS).addTag(newBatch).build());
        }
        try {
            WorkContinuation chain = WorkManager.getInstance(this).beginUniqueWork("dlsta-download-queue", ExistingWorkPolicy.APPEND_OR_REPLACE, jobs.get(0));
            for (int i = 1; i < jobs.size(); i++) chain = chain.then(jobs.get(i)); chain.enqueue(); batch = newBatch;
            queueStatus.setText("Queued " + jobs.size() + " file(s) for Downloads / dlsta."); schedulePoll(newBatch);
        } catch (Exception e) { queueStatus.setText("Could not queue downloads. Please try again."); }
    }
    private void schedulePoll(String id) { int token = ++pollGeneration; handler.postDelayed(() -> pollBatch(id, token), 1000); }
    private void pollBatch(String id, int token) {
        if (id.isEmpty() || !id.equals(batch) || token != pollGeneration) return;
        queueIo.execute(() -> {
            try {
                List<WorkInfo> info = WorkManager.getInstance(this).getWorkInfosByTag(id).get(10, TimeUnit.SECONDS); int saved = 0, existing = 0, failed = 0, waiting = 0;
                for (WorkInfo work : info) { if (!work.getState().isFinished()) { waiting++; continue; } String outcome = work.getOutputData().getString("outcome"); if ("downloaded".equals(outcome)) saved++; else if ("existing".equals(outcome)) existing++; else failed++; }
                final int s = saved, e = existing, f = failed, w = waiting, total = info.size();
                runOnUiThread(() -> { if (isFinishing() || !id.equals(batch) || token != pollGeneration) return;
                    if (queueStatus != null) queueStatus.setText((w > 0 || total == 0 ? "Processing " + (total - w) + " of " + total + " · " : "Finished · ") + s + " saved · " + e + " already saved · " + f + " failed\nDownloads / dlsta");
                    if (w > 0 || total == 0) handler.postDelayed(() -> pollBatch(id, token), 1500);
                });
            } catch (Exception ignored) { runOnUiThread(() -> { if (token == pollGeneration && queueStatus != null) queueStatus.setText("Unable to check download progress."); }); }
        });
    }
    @Override protected void onDestroy() { generation++; imageGeneration++; pollGeneration++; handler.removeCallbacksAndMessages(null); lookupIo.shutdownNow(); imageIo.shutdownNow(); queueIo.shutdownNow(); super.onDestroy(); }
}
