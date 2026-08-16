import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (relative: string) => readFileSync(join(root, relative), 'utf8');

describe('high-traffic overlays use held sheet exits', () => {
  it('migrates social, parts, anatomy, and photo viewers off slide/fade Modals', () => {
    for (const relative of [
      'src/features/social/social-friends-modal.tsx',
      'src/features/social/social-action-modal.tsx',
      'src/features/vehicles/vehicle-parts-search-sheet.tsx',
      'src/features/workouts/exercise-anatomy-demo.tsx',
      'src/features/travel/travel-photo-lightbox.tsx',
    ]) {
      const source = read(relative);
      expect(source).toContain('SheetScaffold');
      expect(source).not.toContain('animationType="slide"');
      expect(source).not.toContain('animationType="fade"');
    }
  });
});
