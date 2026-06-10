import { spawn } from 'node:child_process';

const port = 4174;
const baseUrl = `http://127.0.0.1:${port}`;
const routes = [
  '/',
  '/roles',
  '/login',
  '/patient-portal',
  '/patients',
  '/tasks',
  '/scheduling',
  '/portal-intake',
  '/portal-mock',
  '/billing',
  '/faxes',
  '/messaging',
  '/integrations',
  '/reports',
  '/assistant-review',
  '/clicky',
  '/operations',
  '/setup',
  '/staff',
  '/patients/00000000-0000-4000-8000-000000000101',
];

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(child) {
  const started = Date.now();
  while (Date.now() - started < 10_000) {
    if (child.exitCode !== null) {
      throw new Error(`vite preview exited before serving routes`);
    }
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return;
    } catch {
      await wait(250);
    }
  }
  throw new Error(`vite preview did not respond on ${baseUrl}`);
}

async function assertRoute(route) {
  const response = await fetch(`${baseUrl}${route}`);
  if (!response.ok) {
    throw new Error(`${route} returned ${response.status}`);
  }
  const html = await response.text();
  if (!html.includes('<div id="root"></div>')) {
    throw new Error(`${route} did not return the app shell`);
  }
  if (!html.includes('type="module"')) {
    throw new Error(`${route} did not include a module script`);
  }
  return html;
}

async function assertAssets(html) {
  const assetMatches = [...html.matchAll(/src="([^"]+\.js)"/g)].map((match) => match[1]);
  if (assetMatches.length === 0) {
    throw new Error('No built JavaScript assets found');
  }
  for (const assetPath of assetMatches) {
    const response = await fetch(`${baseUrl}${assetPath}`);
    if (!response.ok) {
      throw new Error(`${assetPath} returned ${response.status}`);
    }
  }
}

const child = spawn(
  'pnpm',
  ['exec', 'vite', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
  {
    cwd: new URL('..', import.meta.url),
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  }
);

let stderr = '';
child.stderr.on('data', (chunk) => {
  stderr += chunk.toString();
});

try {
  await waitForServer(child);
  let firstHtml = '';
  for (const route of routes) {
    const html = await assertRoute(route);
    if (!firstHtml) firstHtml = html;
  }
  await assertAssets(firstHtml);
  console.log(`Smoke checked ${routes.length} routes from ${baseUrl}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  if (stderr.trim()) console.error(stderr.trim());
  process.exitCode = 1;
} finally {
  if (child.pid) {
    try {
      process.kill(-child.pid);
    } catch {
      child.kill();
    }
  }
}
