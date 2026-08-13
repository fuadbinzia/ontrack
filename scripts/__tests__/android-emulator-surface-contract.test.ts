import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

function read(relative: string): string {
  return readFileSync(join(root, relative), 'utf8');
}

describe('Android emulator surface contract', () => {
  it('heals a blank headed SurfaceView before finish_app_up', () => {
    const emu = read('scripts/lib/android-emulator.sh');
    const host = read('scripts/lib/agent-ui-host.sh');
    const surface = read('scripts/lib/android_emu_surface.py');
    expect(emu).toContain('android_emu_ensure_app_surface');
    expect(emu).toContain('android_emu_mark_ready');
    expect(emu).toContain('Relaunching');
    expect(emu).toContain('blank/white SurfaceView');
    expect(host).toContain('android_emu_want_app_surface');
    expect(host).toContain('android_emu_ensure_app_surface');
    expect(host).toContain('app surface still blank/white');
    expect(surface).toContain('near_white_pct');
    expect(surface).toContain('is-blank');

    const surfacePy = join(root, 'scripts/lib/android_emu_surface.py');
    const script = [
      'from pathlib import Path',
      'import tempfile',
      'from PIL import Image',
      'import importlib.util',
      'spec = importlib.util.spec_from_file_location("android_emu_surface", ' +
        JSON.stringify(surfacePy) +
        ')',
      'mod = importlib.util.module_from_spec(spec)',
      'spec.loader.exec_module(mod)',
      'td = tempfile.mkdtemp()',
      'white = Path(td) / "white.png"',
      'cream = Path(td) / "cream.png"',
      'Image.new("RGB", (64, 64), (255, 255, 255)).save(white)',
      'Image.new("RGB", (64, 64), (231, 220, 204)).save(cream)',
      'assert mod.near_white_pct(white.read_bytes()) >= 85',
      'assert mod.near_white_pct(cream.read_bytes()) < 85',
    ].join('\n');
    execFileSync('python3', ['-c', script], {
      encoding: 'utf8',
      timeout: 15_000,
    });
  });
});
