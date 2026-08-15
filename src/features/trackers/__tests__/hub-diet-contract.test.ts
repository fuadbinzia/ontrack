import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '../../../..');

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

describe('hub first-viewport diet', () => {
  it('keeps Food, Fitness, and Finance secondary chrome behind More', () => {
    const food = read('src/app/(tabs)/food/index.tsx');
    const workouts = read('src/app/(tabs)/workouts.tsx');
    const finance = read('src/features/finance/finance-screen.tsx');

    expect(food).toContain('CollapsibleSection');
    expect(food).toContain('More in Food');
    expect(food).toContain('AgentUiIds.food.home.more');

    expect(workouts).toContain('CollapsibleSection');
    expect(workouts).toContain('Explore Muscles');
    expect(workouts).toContain('AgentUiIds.workouts.exploreMuscles');

    expect(finance).toContain('CollapsibleSection');
    expect(finance).toContain('More in Finance');
    expect(finance).toContain('AgentUiIds.finance.more');
  });
});
