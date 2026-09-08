#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const root = process.cwd();
const requested = process.argv[2];
const candidates = requested ? [requested] : ['test-results/results.json', 'test-results/ui-results.json'];
const resultFile = candidates.map((file) => path.resolve(root, file)).find(fs.existsSync);
const outDir = path.resolve(root, 'test-results');
const memoryDir = path.resolve(root, 'agent-data');
const historyFile = path.join(memoryDir, 'diagnosis-history.json');

function readResult(file) {
  if (!file) return { error: 'No Playwright JSON result file was found.' };
  try {
    return { value: JSON.parse(fs.readFileSync(file, 'utf8')) };
  } catch (error) {
    return { error: 'Cannot parse ' + path.relative(root, file) + ': ' + error.message };
  }
}

function collectFailures(suites, output) {
  for (const suite of suites || []) {
    for (const spec of suite.specs || []) {
      for (const test of spec.tests || []) {
        const failed = (test.results || []).filter((item) =>
          ['failed', 'timedOut', 'interrupted'].includes(item.status));
        if (failed.length) {
          const last = failed[failed.length - 1];
          output.push({
            file: spec.file || suite.file || 'unknown',
            title: spec.title || 'Unnamed test',
            status: last.status,
            errors: failed.flatMap((item) => (item.errors || [])
              .map((error) => error.message || error.value || String(error))),
            screenshots: failed.flatMap((item) => (item.attachments || [])
              .filter((item) => item.contentType === 'image/png')
              .map((item) => item.path)
              .filter(Boolean))
          });
        }
      }
    }
    collectFailures(suite.suites, output);
  }
}

function classify(item) {
  if (item.type === 'RESULT_ARTIFACT_ERROR') return 'RESULT_ARTIFACT_ERROR';
  const text = item.errors.join('\n').toLowerCase();
  if (item.status === 'timedOut' || /timeout|timed out|polling timeout/.test(text)) return 'TIMEOUT_OR_ASYNC';
  if (/econnrefused|net::err|socket hang up|fetch failed|status.*5\d\d/.test(text)) return 'ENVIRONMENT_OR_SERVICE';
  if (/locator|expected.*visible|strict mode|element/.test(text)) return 'UI_LOCATOR_OR_RENDERING';
  if (/expected.*to(be|equal)|assert|expect/.test(text)) return 'ASSERTION_OR_CONTRACT';
  if (/status.*4\d\d|api.*failed|response/.test(text)) return 'API_CONTRACT_OR_DATA';
  return 'UNKNOWN';
}

function advice(type) {
  const values = {
    RESULT_ARTIFACT_ERROR: 'Result JSON is invalid. Regenerate the affected Playwright report before investigating product behavior.',
    TIMEOUT_OR_ASYNC: 'Check service readiness, polling conditions and product latency before increasing a timeout.',
    ENVIRONMENT_OR_SERVICE: 'Check frontend/backend processes, BASE_URL, database, Redis and server logs before changing tests.',
    UI_LOCATOR_OR_RENDERING: 'Compare screenshot and DOM. Confirm rendering first; then prefer a stable data-testid selector.',
    ASSERTION_OR_CONTRACT: 'Compare assertion, API response and product requirement. Do not weaken the assertion without confirmation.',
    API_CONTRACT_OR_DATA: 'Inspect endpoint response and fixture lifecycle before changing tests or application code.',
    UNKNOWN: 'Review original error, screenshot and service logs together; deterministic evidence is insufficient.'
  };
  return values[type];
}

function regression(file) {
  if (!file || file === 'unknown') return [];
  const base = path.basename(file);
  const uiFile = path.resolve(root, 'tests', 'ui', base);
  const apiFile = path.resolve(root, 'tests', base);
  if (fs.existsSync(uiFile)) return ['tests/ui/' + base];
  if (fs.existsSync(apiFile)) return ['tests/' + base];
  return [];
}

function loadHistory() {
  try {
    return JSON.parse(fs.readFileSync(historyFile, 'utf8'));
  } catch {
    return [];
  }
}

function fingerprint(item) {
  const evidence = item.errors.join(' ').replace(/\s+/g, ' ').slice(0, 240);
  return Buffer.from([item.file, item.title, item.status, evidence].join('|')).toString('base64');
}

const parsed = readResult(resultFile);
const failures = [];
let stats = {};
if (parsed.error) {
  failures.push({
    type: 'RESULT_ARTIFACT_ERROR',
    file: resultFile ? path.relative(root, resultFile) : 'not-found',
    title: 'Playwright result artifact is invalid',
    status: 'artifact-error',
    errors: [parsed.error],
    screenshots: []
  });
} else {
  collectFailures(parsed.value.suites || [], failures);
  stats = parsed.value.stats || {};
}

const history = loadHistory();
const diagnoses = failures.map((item) => {
  const type = classify(item);
  const id = fingerprint(item);
  const previous = history.filter((entry) => entry.fingerprint === id);
  return {
    fingerprint: id,
    file: item.file,
    title: item.title,
    status: item.status,
    failureType: type,
    severity: type === 'RESULT_ARTIFACT_ERROR' || type === 'TIMEOUT_OR_ASYNC' ? 'HIGH' : 'MEDIUM',
    evidence: item.errors,
    screenshots: item.screenshots,
    suggestedFix: advice(type),
    regressionTests: regression(item.file),
    occurrences: previous.length + 1,
    previouslySeen: previous.length > 0,
    previousSeenAt: previous.length ? previous[previous.length - 1].createdAt : null,
    requiresHumanApproval: true
  };
});

const report = {
  agent: 'TestDiagnosisAgent',
  createdAt: new Date().toISOString(),
  resultFile: resultFile ? path.relative(root, resultFile) : null,
  summary: {
    expected: stats.expected || 0,
    unexpected: stats.unexpected || diagnoses.length,
    flaky: stats.flaky || 0,
    diagnosedFailures: diagnoses.length,
    repeatedFailures: diagnoses.filter((item) => item.previouslySeen).length
  },
  diagnoses,
  nextAction: diagnoses.length
    ? 'Review the report and confirm the suggested regression tests before any rerun.'
    : 'No failed tests found in the parsed artifact.'
};

const lines = [
  '# Test Diagnosis Agent Report',
  '',
  'Generated: ' + report.createdAt,
  'Result artifact: ' + (report.resultFile || 'not found'),
  '',
  '## Summary',
  '',
  '- Expected: ' + report.summary.expected,
  '- Unexpected: ' + report.summary.unexpected,
  '- Diagnosed failures: ' + report.summary.diagnosedFailures,
  '- Repeated failures: ' + report.summary.repeatedFailures
];
for (const item of diagnoses) {
  lines.push('', '## ' + item.title, '', '- Type: ' + item.failureType,
    '- Severity: ' + item.severity, '- Test file: ' + item.file,
    '- Occurrences: ' + item.occurrences,
    '- Suggested action: ' + item.suggestedFix,
    '- Regression: ' + (item.regressionTests.join(', ') || 'manual selection required'));
  for (const evidence of item.evidence.slice(0, 3)) {
    lines.push('- Evidence: ' + evidence.replace(/\s+/g, ' ').slice(0, 500));
  }
}

fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(memoryDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'agent-report.json'), JSON.stringify(report, null, 2));
fs.writeFileSync(path.join(outDir, 'agent-report.md'), lines.join('\n') + '\n');
const historyEntries = diagnoses.map((item) => ({
  fingerprint: item.fingerprint,
  createdAt: report.createdAt,
  file: item.file,
  title: item.title,
  failureType: item.failureType,
  severity: item.severity,
  suggestedFix: item.suggestedFix
}));
fs.writeFileSync(historyFile, JSON.stringify([...history, ...historyEntries].slice(-200), null, 2));
console.log('TestDiagnosisAgent wrote test-results/agent-report.json and test-results/agent-report.md');
console.log('Agent memory: agent-data/diagnosis-history.json');
console.log('Diagnosed failures: ' + report.summary.diagnosedFailures);
