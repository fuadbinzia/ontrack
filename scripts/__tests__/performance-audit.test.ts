import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

type PerformanceAuditReport = {
  version: number;
  scannedFiles: number;
  counts: { high: number; medium: number; low: number };
  findings: { rule: string; severity: string }[];
};

describe('performance audit CLI', () => {
  it('emits a machine-readable report for production source', () => {
    const output = execFileSync(
      process.execPath,
      [path.join(process.cwd(), 'scripts/performance-audit.mjs'), '--json'],
      { cwd: process.cwd(), encoding: 'utf8' },
    );
    const report = JSON.parse(output) as PerformanceAuditReport;

    expect(report.version).toBe(1);
    expect(report.scannedFiles).toBeGreaterThan(0);
    expect(report.findings).toHaveLength(
      report.counts.high + report.counts.medium + report.counts.low,
    );
    expect(report.findings.every((finding) => finding.rule.length > 0)).toBe(
      true,
    );
  });

  it('disables the compiler when fix mode finds an OTA-unsafe configuration', () => {
    const fixtureRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'ontrack-performance-audit-'),
    );
    try {
      fs.mkdirSync(path.join(fixtureRoot, 'src'));
      fs.writeFileSync(
        path.join(fixtureRoot, 'app.json'),
        JSON.stringify({ expo: { experiments: { reactCompiler: true } } }),
      );
      const output = execFileSync(
        process.execPath,
        [
          path.join(process.cwd(), 'scripts/performance-audit.mjs'),
          '--fix',
          '--json',
        ],
        { cwd: fixtureRoot, encoding: 'utf8' },
      );
      const report = JSON.parse(output) as PerformanceAuditReport & {
        appliedFixes: { rule: string }[];
      };
      const config = JSON.parse(
        fs.readFileSync(path.join(fixtureRoot, 'app.json'), 'utf8'),
      ) as { expo: { experiments: { reactCompiler: boolean } } };

      expect(config.expo.experiments.reactCompiler).toBe(false);
      expect(report.appliedFixes).toEqual([
        expect.objectContaining({ rule: 'react-compiler-ota-unsafe' }),
      ]);
    } finally {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });
});
