#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import ts from 'typescript';

const AUDIT_VERSION = 1;
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx']);
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const LARGE_IMAGE_BYTES = 1.25 * 1024 * 1024;
const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 };
const argv = new Set(process.argv.slice(2));
const jsonOutput = argv.has('--json');
const strict = argv.has('--strict');
const fix = argv.has('--fix');
const projectRoot = process.cwd();
const appliedFixes = [];

function walkFiles(directory, accepts, ignoredDirectoryNames = new Set()) {
  if (!fs.existsSync(directory)) return [];
  const files = [];
  const pending = [directory];
  while (pending.length > 0) {
    const current = pending.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.name.startsWith('.') || ignoredDirectoryNames.has(entry.name)) {
        continue;
      }
      const absolutePath = path.join(current, entry.name);
      if (entry.isDirectory()) pending.push(absolutePath);
      else if (entry.isFile() && accepts(absolutePath)) files.push(absolutePath);
    }
  }
  return files.sort();
}

function toProjectPath(absolutePath) {
  return path.relative(projectRoot, absolutePath).split(path.sep).join('/');
}

function isProductionSource(filePath) {
  const normalized = filePath.split(path.sep).join('/');
  return (
    SOURCE_EXTENSIONS.has(path.extname(filePath)) &&
    !normalized.includes('/__tests__/') &&
    !/\.(?:test|spec)\.[^.]+$/.test(normalized) &&
    !normalized.endsWith('.d.ts')
  );
}

function sourceFileFor(filePath) {
  return ts.createSourceFile(
    filePath,
    fs.readFileSync(filePath, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
}

function lineFor(sourceFile, node) {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
}

function jsxTagName(node) {
  const tagName = node.tagName;
  return ts.isIdentifier(tagName) ? tagName.text : tagName.getText();
}

function jsxAttribute(openingElement, name) {
  return openingElement.attributes.properties.find(
    (property) => ts.isJsxAttribute(property) && property.name.text === name,
  );
}

function expressionForAttribute(attribute) {
  if (!attribute?.initializer || !ts.isJsxExpression(attribute.initializer)) {
    return undefined;
  }
  return attribute.initializer.expression;
}

function callChainIncludes(expression, names) {
  let found = false;
  function visit(node) {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      names.has(node.expression.name.text)
    ) {
      found = true;
      return;
    }
    if (!found) ts.forEachChild(node, visit);
  }
  visit(expression);
  return found;
}

function isInsideFunction(node) {
  let current = node.parent;
  while (current) {
    if (ts.isFunctionLike(current)) return true;
    current = current.parent;
  }
  return false;
}

function resolveSourceModule(fromFile, moduleName) {
  let basePath;
  if (moduleName.startsWith('@/')) {
    basePath = path.join(projectRoot, 'src', moduleName.slice(2));
  } else if (moduleName.startsWith('.')) {
    basePath = path.resolve(path.dirname(fromFile), moduleName);
  } else {
    return undefined;
  }
  const candidates = [
    `${basePath}.ts`,
    `${basePath}.tsx`,
    path.join(basePath, 'index.ts'),
    path.join(basePath, 'index.tsx'),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate));
}

function countExports(sourceFile) {
  let count = 0;
  for (const statement of sourceFile.statements) {
    if (ts.isExportDeclaration(statement)) {
      if (!statement.exportClause) count += 10;
      else if (ts.isNamedExports(statement.exportClause)) {
        count += statement.exportClause.elements.length;
      }
      continue;
    }
    const modifiers = ts.canHaveModifiers(statement)
      ? ts.getModifiers(statement)
      : undefined;
    if (modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) {
      count += 1;
    }
  }
  return count;
}

function loadAppConfig() {
  const appJsonPath = path.join(projectRoot, 'app.json');
  if (!fs.existsSync(appJsonPath)) return undefined;
  try {
    return JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
  } catch {
    return undefined;
  }
}

function applySafeProjectFixes() {
  const appJsonPath = path.join(projectRoot, 'app.json');
  if (!fs.existsSync(appJsonPath)) return;
  try {
    const appConfig = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
    if (appConfig?.expo?.experiments?.reactCompiler !== true) return;
    appConfig.expo ??= {};
    appConfig.expo.experiments ??= {};
    // The currently distributed native runtime does not provide the compiler
    // memo-cache function consistently. Enabling this in an OTA caused the
    // first compiled auth component to crash before the app became usable.
    appConfig.expo.experiments.reactCompiler = false;
    fs.writeFileSync(appJsonPath, `${JSON.stringify(appConfig, null, 2)}\n`);
    appliedFixes.push({
      rule: 'react-compiler-ota-unsafe',
      file: 'app.json',
      message: 'Disabled React Compiler for compatibility with the distributed native runtime.',
    });
  } catch {
    // Invalid or dynamic configs stay audit-only; do not risk rewriting them.
  }
}

if (fix) applySafeProjectFixes();
const appConfig = loadAppConfig();
const reactCompilerEnabled = appConfig?.expo?.experiments?.reactCompiler === true;

const sourceFiles = walkFiles(
  path.join(projectRoot, 'src'),
  isProductionSource,
  new Set(['node_modules', 'dist', 'build']),
);
const parsedSources = new Map(
  sourceFiles.map((filePath) => [filePath, sourceFileFor(filePath)]),
);
const findings = [];
const barrelConsumers = new Map();

function addFinding(finding) {
  findings.push({
    ...finding,
    file: finding.file ? toProjectPath(finding.file) : undefined,
  });
}

for (const [filePath, sourceFile] of parsedSources) {
  const storeHooks = new Set();
  const boundedCollectionIdentifiers = new Set();

  function collectBoundedCollections(node) {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer
    ) {
      let initializer = node.initializer;
      while (ts.isAsExpression(initializer) || ts.isSatisfiesExpression(initializer)) {
        initializer = initializer.expression;
      }
      if (ts.isArrayLiteralExpression(initializer)) {
        boundedCollectionIdentifiers.add(node.name.text);
      }
    }
    ts.forEachChild(node, collectBoundedCollections);
  }
  collectBoundedCollections(sourceFile);

  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) {
      continue;
    }
    const moduleName = statement.moduleSpecifier.text;
    const importClause = statement.importClause;
    if (moduleName === 'react-native' && importClause?.namedBindings && ts.isNamedImports(importClause.namedBindings)) {
      const imageImport = importClause.namedBindings.elements.find(
        (element) => (element.propertyName?.text ?? element.name.text) === 'Image',
      );
      if (imageImport) {
        addFinding({
          rule: 'prefer-expo-image',
          severity: 'high',
          file: filePath,
          line: lineFor(sourceFile, imageImport),
          message: 'React Native Image bypasses expo-image caching and recycling optimizations.',
          suggestion: 'Use expo-image unless this call site requires a React Native Image-only API.',
        });
      }
    }

    if (moduleName.startsWith('@/store/') || /(?:^|\/)store(?:\/|$)/.test(moduleName)) {
      if (importClause?.name?.text.startsWith('use')) {
        storeHooks.add(importClause.name.text);
      }
      if (importClause?.namedBindings && ts.isNamedImports(importClause.namedBindings)) {
        for (const element of importClause.namedBindings.elements) {
          if (element.name.text.startsWith('use')) storeHooks.add(element.name.text);
        }
      }
    }

    const resolvedModule = resolveSourceModule(filePath, moduleName);
    if (resolvedModule && /\/index\.tsx?$/.test(resolvedModule)) {
      const consumers = barrelConsumers.get(resolvedModule) ?? new Set();
      consumers.add(filePath);
      barrelConsumers.set(resolvedModule, consumers);
    }
  }

  function visit(node) {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      storeHooks.has(node.expression.text) &&
      node.arguments.length === 0
    ) {
      addFinding({
        rule: 'zustand-selector',
        severity: 'high',
        file: filePath,
        line: lineFor(sourceFile, node),
        message: `${node.expression.text} subscribes to the entire store and can re-render on unrelated changes.`,
        suggestion: 'Select only the fields this component needs.',
      });
    }

    if (
      ts.isNewExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === 'Intl' &&
      !filePath.endsWith(`${path.sep}utils${path.sep}intl-cache.ts`) &&
      isInsideFunction(node)
    ) {
      addFinding({
        rule: 'hoist-intl-constructor',
        severity: 'medium',
        file: filePath,
        line: lineFor(sourceFile, node),
        message: `${node.expression.getText()} is constructed inside a function and repeats on every call.`,
        suggestion: 'Hoist stable formatters or cache locale-dependent instances on frequently called paths.',
      });
    }

    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      const openingElement = ts.isJsxElement(node) ? node.openingElement : node;
      const tagName = jsxTagName(openingElement);
      if (tagName === 'ScrollView' && ts.isJsxElement(node)) {
        const eagerMaps = [];
        function findMaps(child) {
          if (
            child !== node &&
            ts.isJsxElement(child) &&
            jsxTagName(child.openingElement) === 'ScrollView'
          ) {
            return;
          }
          if (
            ts.isCallExpression(child) &&
            ts.isPropertyAccessExpression(child.expression) &&
            child.expression.name.text === 'map' &&
            !ts.isArrayLiteralExpression(child.expression.expression) &&
            !(
              ts.isIdentifier(child.expression.expression) &&
              boundedCollectionIdentifiers.has(child.expression.expression.text)
            )
          ) {
            eagerMaps.push(child);
            return;
          }
          ts.forEachChild(child, findMaps);
        }
        for (const child of node.children) findMaps(child);
        if (eagerMaps.length > 0) {
          addFinding({
            rule: 'virtualize-scroll-collection',
            severity: 'medium',
            file: filePath,
            line: lineFor(sourceFile, eagerMaps[0]),
            message: `ScrollView eagerly renders ${eagerMaps.length === 1 ? 'a collection' : `${eagerMaps.length} collections`}.`,
            suggestion: 'Use FlashList/FlatList when the collection can grow beyond a small fixed set.',
          });
        }
      }

      if (tagName === 'FlatList' || tagName === 'SectionList' || tagName === 'FlashList') {
        const renderItem = expressionForAttribute(jsxAttribute(openingElement, 'renderItem'));
        if (
          !reactCompilerEnabled &&
          renderItem &&
          (ts.isArrowFunction(renderItem) || ts.isFunctionExpression(renderItem))
        ) {
          addFinding({
            rule: 'stable-list-renderer',
            severity: 'medium',
            file: filePath,
            line: lineFor(sourceFile, renderItem),
            message: `${tagName} receives an inline renderItem function.`,
            suggestion: 'Move the renderer outside render or stabilize it when profiling confirms row churn.',
          });
        }
        const data = expressionForAttribute(jsxAttribute(openingElement, 'data'));
        if (data && callChainIncludes(data, new Set(['filter', 'map', 'sort']))) {
          addFinding({
            rule: 'stable-list-data',
            severity: 'medium',
            file: filePath,
            line: lineFor(sourceFile, data),
            message: `${tagName} transforms data inline, creating a new collection during render.`,
            suggestion: 'Derive the collection outside the list prop and avoid recomputation when inputs are unchanged.',
          });
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
}

for (const [barrelPath, consumers] of barrelConsumers) {
  const sourceFile = parsedSources.get(barrelPath) ?? sourceFileFor(barrelPath);
  const exportCount = countExports(sourceFile);
  if (exportCount < 10 || consumers.size < 3) continue;
  addFinding({
    rule: 'wide-barrel-import',
    severity: exportCount >= 30 ? 'high' : 'medium',
    file: barrelPath,
    line: 1,
    message: `${exportCount}+ exports are imported through this barrel by ${consumers.size} production files.`,
    suggestion: 'Measure module evaluation cost and prefer direct imports on startup/navigation hot paths.',
  });
}

const rootLayoutPath = path.join(projectRoot, 'src/app/_layout.tsx');
const rootLayout = parsedSources.get(rootLayoutPath);
if (rootLayout) {
  const bootCriticalFeatureModules = new Set([
    '@/features/auth/app-boot-loader',
    '@/features/auth/auth-provider',
    '@/features/auth/guest-dirty-tracking',
    '@/features/auth/welcome-preview',
    '@/features/travel/travel-atmosphere',
    '@/features/travel/travel-atmosphere-model',
  ]);
  const featureImports = rootLayout.statements.filter(
    (statement) =>
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text.startsWith('@/features/') &&
      !bootCriticalFeatureModules.has(statement.moduleSpecifier.text),
  );
  if (featureImports.length > 0) {
    addFinding({
      rule: 'root-layout-feature-imports',
      severity: 'high',
      file: rootLayoutPath,
      line: lineFor(rootLayout, featureImports[0]),
      message: `The root layout eagerly imports ${featureImports.length} non-critical feature module${featureImports.length === 1 ? '' : 's'} before the first screen is interactive.`,
      suggestion: 'Keep only boot-critical providers at root; move route-specific work and imports behind the relevant layout.',
    });
  }
}

if (appConfig?.expo?.experiments?.reactCompiler === true) {
  addFinding({
    rule: 'react-compiler-ota-unsafe',
    severity: 'high',
    file: path.join(projectRoot, 'app.json'),
    line: 1,
    message: 'React Compiler requires a compatible native runtime and has crashed the distributed iOS build during auth rendering.',
    suggestion: 'Keep it disabled until a native build is validated before distribution.',
  });
}

const largeImages = walkFiles(
  path.join(projectRoot, 'assets'),
  (filePath) =>
    IMAGE_EXTENSIONS.has(path.extname(filePath).toLowerCase()) &&
    fs.statSync(filePath).size > LARGE_IMAGE_BYTES,
);
for (const imagePath of largeImages) {
  const sizeMiB = fs.statSync(imagePath).size / LARGE_IMAGE_BYTES;
  addFinding({
    rule: 'large-raster-asset',
    severity: 'medium',
    file: imagePath,
    line: 1,
    message: `Raster asset is ${sizeMiB.toFixed(1)} MiB and can increase decode/load time and memory pressure.`,
    suggestion: 'Confirm rendered dimensions; npm run optimize automatically recompresses oversized raster assets.',
  });
}

findings.sort((left, right) => {
  const severity = SEVERITY_ORDER[left.severity] - SEVERITY_ORDER[right.severity];
  if (severity !== 0) return severity;
  const file = (left.file ?? '').localeCompare(right.file ?? '');
  return file !== 0 ? file : (left.line ?? 0) - (right.line ?? 0);
});

const counts = findings.reduce(
  (result, finding) => {
    result[finding.severity] += 1;
    return result;
  },
  { high: 0, medium: 0, low: 0 },
);
const report = {
  version: AUDIT_VERSION,
  scannedFiles: sourceFiles.length,
  counts,
  appliedFixes,
  findings,
  note: 'Static findings are optimization candidates, not timing proof. Validate high-impact changes with release-build traces and the in-app performance monitor.',
};

if (jsonOutput) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} else {
  process.stdout.write('\nPerformance audit\n');
  if (fix) {
    process.stdout.write(
      appliedFixes.length > 0
        ? `Applied ${appliedFixes.length} safe fix${appliedFixes.length === 1 ? '' : 'es'}.\n`
        : 'Safe fixes are already applied.\n',
    );
  }
  process.stdout.write(
    `Scanned ${report.scannedFiles} production source files: ${counts.high} high, ${counts.medium} medium, ${counts.low} low.\n\n`,
  );
  let currentSeverity;
  for (const finding of findings) {
    if (finding.severity !== currentSeverity) {
      currentSeverity = finding.severity;
      process.stdout.write(`${currentSeverity.toUpperCase()}\n`);
    }
    const location = finding.file
      ? `${finding.file}${finding.line ? `:${finding.line}` : ''}`
      : 'project config';
    process.stdout.write(`- ${location} [${finding.rule}] ${finding.message}\n`);
    process.stdout.write(`  ${finding.suggestion}\n`);
  }
  if (findings.length === 0) process.stdout.write('No static performance risks found.\n');
  process.stdout.write(`\n${report.note}\n`);
  process.stdout.write('Use `npm run --silent optimize:audit -- --json` for machine-readable output.\n\n');
}

if (strict && counts.high > 0) process.exitCode = 2;
