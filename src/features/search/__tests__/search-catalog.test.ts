import mockAsyncStorage from '@react-native-async-storage/async-storage/jest/async-storage-mock';

import { ALL_ADDONS_ON, DEFAULT_ADDON_STATE } from '@/addons/registry';
import { useChecklists } from '@/store/todos';

import { catalogSearchScreens } from '../search-screens';
import { buildSearchDocuments, groupSearchDocuments } from '../search-documents';

jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);

describe('app search catalog', () => {
  beforeEach(() => {
    useChecklists.getState().reset();
  });

  it('includes core screens and hides disabled add-ons', () => {
    const core = catalogSearchScreens(DEFAULT_ADDON_STATE);
    const titles = core.map((item) => item.title);
    expect(titles).toEqual(expect.arrayContaining(['Today', 'Calendar', 'Checklists', 'Overview', 'Profile', 'More']));
    expect(titles).not.toContain('Travel');
    expect(titles).not.toContain('Finance');

    const allOn = catalogSearchScreens(ALL_ADDONS_ON);
    expect(allOn.map((item) => item.title)).toEqual(
      expect.arrayContaining(['Travel', 'Plants', 'Finance', 'Journal']),
    );
  });

  it('gates Health through the existing iOS tracker rule', () => {
    const source = require('node:fs').readFileSync(
      require('node:path').join(process.cwd(), 'src/features/search/search-screens.ts'),
      'utf8',
    );
    expect(source).toContain('isTrackerRouteEnabled');
    expect(source).toContain('MORE_TAB_ROUTE');
  });

  it('returns only screens for an empty query', () => {
    const documents = buildSearchDocuments({
      enabledAddons: DEFAULT_ADDON_STATE,
      query: '',
    });
    expect(documents.every((item) => item.kind === 'screen')).toBe(true);
    expect(groupSearchDocuments(documents).map((group) => group.domain)).toEqual(['screen']);
  });

  it('matches typed entities alongside screens', () => {
    const list = useChecklists.getState().createList('Groceries');
    expect(list).toBeDefined();
    useChecklists.getState().addTask(list!.id, 'Oat milk');

    const documents = buildSearchDocuments({
      enabledAddons: DEFAULT_ADDON_STATE,
      query: 'oat milk',
    });
    expect(documents.some((item) => item.kind === 'entity' && item.title === 'Oat milk')).toBe(
      true,
    );
    expect(groupSearchDocuments(documents).map((group) => group.domain)).toEqual(
      expect.arrayContaining(['todos']),
    );
  });
});
