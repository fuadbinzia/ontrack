import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(path.join(__dirname, '..', 'appearance.tsx'), 'utf8');
const pickerSource = fs.readFileSync(
  path.resolve(__dirname, '../../../../features/account/avatar-color-picker.tsx'),
  'utf8',
);

describe('App Appearance preset grid', () => {
  it('renders the shared avatar color picker for custom theme tokens', () => {
    expect(source).toContain(
      "import { AvatarColorPicker } from '@/features/account/avatar-color-picker'",
    );
    expect(source).toMatch(/<AvatarColorPicker\s+[\s\S]*?color=\{normalizedDraft \?\? undefined\}/);
    expect(source).toContain('onChange={setDraft}');
    expect(source).toContain('onDragStart={() => setPickerDragging(true)}');
    expect(source).toContain('onDragEnd={() => setPickerDragging(false)}');
    expect(pickerSource).toContain('export function AvatarColorPicker');
    expect(pickerSource).toContain('onChange(next)');
  });

  it('renders six presets in three complete two-column rows', () => {
    expect(source).toContain('THEME_PRESETS.slice(0, 2)');
    expect(source).toContain('THEME_PRESETS.slice(2, 4)');
    expect(source).toContain('THEME_PRESETS.slice(4, 6)');
    expect(source).not.toContain('row.length === 1 ? <View style={styles.presetCell} /> : null');
  });

  it('gives both columns the same flex basis and keeps cards full-width', () => {
    expect(source).toMatch(/presetCell:\s*\{ flex: 1, minWidth: 0 \}/);
    expect(source).toMatch(/presetCard:\s*\{ width: '100%' \}/);
    expect(source).not.toMatch(/presetCard:\s*\{[^}]*flexGrow/);
  });
});
