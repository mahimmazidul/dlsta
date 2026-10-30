import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read = file => readFile(new URL('../' + file, import.meta.url), 'utf8');

test('Cloudflare configuration and package use dlsta and route host-aware paths', async () => {
  const config = await read('wrangler.toml');
  const pkg = JSON.parse(await read('package.json'));
  assert.equal(pkg.name, 'dlsta');
  assert.match(config, /^name\s*=\s*"dlsta"\s*$/m);
  assert.match(config, /^main\s*=\s*"worker\/index\.js"\s*$/m);
  assert.match(config, /binding\s*=\s*"ASSETS"/);
  assert.match(config, /binding\s*=\s*"RATE_LIMIT"/);
  const routes = config.match(/^run_worker_first\s*=\s*\[(.+)\]/m)?.[1];
  assert.ok(routes);
  for (const route of ['/', '/index.html', '/sitemap.xml', '/robots.txt', '/api/*']) assert.ok(routes.includes(`"${route}"`), route);
  assert.ok(!routes.includes('"/*"'), 'static assets should not all invoke the Worker');
});

test('deployment documentation distinguishes dashboard Worker name and automatic KV provisioning', async () => {
  const readme = await read('README.md');
  const report = await read('RESEARCH.md');
  assert.match(readme, /Workers Builds can override/);
  assert.match(readme, /does not rename or delete an existing `insta-dl` Worker/);
  assert.doesNotMatch(report, /`insta-dl` remains the Cloudflare Worker service name/);
});

test('Cloudflare GitHub Action tests and deploys only using repository secrets', async () => {
  const workflow = await read('.github/workflows/cloudflare.yml');
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /branches:\s*\[main\]/);
  assert.match(workflow, /run: npm ci/);
  assert.match(workflow, /run: npm test/);
  assert.match(workflow, /uses: cloudflare\/wrangler-action@v4/);
  assert.match(workflow, /command: deploy/);
  assert.match(workflow, /secrets\.CLOUDFLARE_API_TOKEN/);
  assert.match(workflow, /secrets\.CLOUDFLARE_ACCOUNT_ID/);
  assert.ok(workflow.indexOf('run: npm test') < workflow.indexOf('uses: cloudflare/wrangler-action@v4'));
  assert.doesNotMatch(workflow, /pull_request:/);
});
