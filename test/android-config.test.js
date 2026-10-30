import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Android APK workflow is manual only, builds and runs emulator checks', async () => {
  const action=await read('.github/workflows/android.yml');
  assert.match(action,/workflow_dispatch:/);
  assert.doesNotMatch(action,/^  (push|pull_request):/m);
  assert.match(action,/testDebugUnitTest/);
  assert.match(action,/lintDebug/);
  assert.match(action,/connectedDebugAndroidTest/);
  assert.match(action,/assembleRelease/);
  assert.match(action,/actions\/upload-artifact@v4/);
  assert.match(action,/secrets\.ANDROID_DLSTA_KEYSTORE/);
});

test('Android WebView bridge limits origins and native queue preserves direct CDN storage', async () => {
  const activity=await read('android/app/src/main/java/com/mahimmazidul/dlsta/MainActivity.java');
  const worker=await read('android/app/src/main/java/com/mahimmazidul/dlsta/DownloadWorker.java');
  const manifest=await read('android/app/src/main/AndroidManifest.xml');
  assert.match(activity,/WebViewCompat\.addWebMessageListener/);
  assert.match(activity,/!mainFrame/);
  assert.match(activity,/appassets\.androidplatform\.net/);
  assert.match(activity,/MediaRules\.allowedUrl/);
  assert.match(activity,/APPEND_OR_REPLACE/);
  assert.match(worker,/MediaRules\.allowedUrl\(link\)/);
  assert.match(worker,/MediaStore\.Downloads/);
  assert.match(worker,/"existing"/);
  assert.match(manifest,/usesCleartextTraffic="false"/);
  assert.doesNotMatch(manifest,/MANAGE_EXTERNAL_STORAGE|READ_MEDIA_IMAGES|READ_EXTERNAL_STORAGE/);
});
