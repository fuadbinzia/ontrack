const fs = require('node:fs');
const path = require('node:path');
const { randomBytes } = require('node:crypto');

function parseLocalEnv(source) {
  const values = {};
  for (const line of source.split(/\r?\n/)) {
    const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
    if (!match) continue;
    values[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
  return values;
}

function loadLocalEnvFile(fileName, environment = process.env, cwd = process.cwd()) {
  const target = path.resolve(cwd, fileName);
  if (!fs.existsSync(target)) return environment;
  for (const [key, value] of Object.entries(parseLocalEnv(fs.readFileSync(target, 'utf8')))) {
    if (!environment[key]) environment[key] = value;
  }
  return environment;
}

function ensureLocalAnalyticsHashSecret(fileName, cwd = process.cwd()) {
  const target = path.resolve(cwd, fileName);
  const source = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : '';
  const existing = parseLocalEnv(source).ANALYTICS_INSTALL_HASH_SECRET;
  if (existing && existing.length >= 32 && !/^\*+$/.test(existing)) {
    fs.chmodSync(target, 0o600);
    return false;
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const separator = !source || source.endsWith('\n') ? '' : '\n';
  fs.appendFileSync(target, `${separator}ANALYTICS_INSTALL_HASH_SECRET=${randomBytes(32).toString('hex')}\n`, { mode: 0o600 });
  fs.chmodSync(target, 0o600);
  return true;
}

module.exports = { ensureLocalAnalyticsHashSecret, loadLocalEnvFile, parseLocalEnv };
