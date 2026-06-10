import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const srcDir = fileURLToPath(new URL('../src', import.meta.url));

const bannedPatterns = [
  { pattern: /\bcoming soon\b/i, reason: 'unfinished feature copy' },
  { pattern: /\bTODO\b/i, reason: 'todo marker in frontend source' },
  { pattern: /user-uuid|User ID/i, reason: 'raw user id workflow' },
  {
    pattern: /API online|Last sync 2 min|Critical lab callback due now|waiting in Room/i,
    reason: 'stale hard-coded operational copy',
  },
  { pattern: /onClick=\{\(\) => \{\}\}/, reason: 'empty click handler' },
  { pattern: /disabled=\{true\}/, reason: 'permanently disabled frontend control' },
];

const requiredFiles = [
  'lib/demo-api.ts',
  'lib/ui-state.tsx',
  'router/routes/__root.tsx',
  'router/routes/index.tsx',
  'router/routes/login.tsx',
  'router/routes/patients/index.tsx',
  'router/routes/patients/$patientId.tsx',
  'router/routes/tasks/index.tsx',
  'router/routes/scheduling/index.tsx',
  'router/routes/faxes/index.tsx',
  'router/routes/messaging/index.tsx',
];

const requiredSnippets = [
  ['lib/demo-api.ts', 'DEMO_STORAGE_KEY'],
  ['lib/demo-api.ts', "path === '/patients'"],
  ['lib/demo-api.ts', "path === '/tasks'"],
  ['lib/demo-api.ts', "path === '/schedule'"],
  ['lib/demo-api.ts', "path === '/faxes'"],
  ['lib/demo-api.ts', "path === '/messages'"],
  ['lib/ui-state.tsx', 'LoadingState'],
  ['lib/ui-state.tsx', 'EmptyState'],
  ['lib/ui-state.tsx', 'ErrorState'],
  ['lib/assistant-tools.ts', 'getAssistantCopilotActionDescriptors'],
  ['lib/assistant-tools.ts', 'ASSISTANT_TOOL_IDS'],
  ['lib/copilot-runtime.tsx', 'CopilotRuntimeProvider'],
  ['lib/copilot-runtime-provider-inner.tsx', 'CopilotKitProvider'],
  ['lib/copilot-tools.tsx', 'useFrontendTool'],
  ['router/routes/__root.tsx', 'CommandPalette'],
  ['router/routes/__root.tsx', 'SettingsPanel'],
  ['router/routes/__root.tsx', 'MobileNav'],
  ['router/routes/index.tsx', 'CommandCenterPage'],
  ['router/routes/patients/$patientId.tsx', "type Tab = 'summary' | 'demographics' | 'documents'"],
  ['router/routes/patients/$patientId.tsx', 'Medication Reconciliation'],
  ['router/routes/patients/$patientId.tsx', 'Outside Documents'],
  ['router/routes/messaging/index.tsx', 'RECIPIENTS'],
];

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(path)));
    } else if (/\.(tsx?|mjs)$/.test(entry.name)) {
      files.push(path);
    }
  }
  return files;
}

function relative(file) {
  return file.replace(`${srcDir}/`, '');
}

const failures = [];
const files = await walk(srcDir);
const contents = new Map();

for (const file of files) {
  const text = await readFile(file, 'utf8');
  contents.set(relative(file), text);
  for (const { pattern, reason } of bannedPatterns) {
    if (pattern.test(text)) {
      failures.push(`${relative(file)}: ${reason} (${pattern})`);
    }
  }
}

for (const requiredFile of requiredFiles) {
  if (!contents.has(requiredFile)) {
    failures.push(`${requiredFile}: required frontend source file is missing`);
  }
}

for (const [file, snippet] of requiredSnippets) {
  if (!contents.get(file)?.includes(snippet)) {
    failures.push(`${file}: missing required frontend capability marker "${snippet}"`);
  }
}

if (failures.length > 0) {
  console.error('Frontend audit failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Frontend audit passed for ${files.length} source files`);
