import fs from 'node:fs';
import path from 'node:path';

describe('optimistic network actions', () => {
  it('renders a trip message before sending and restores the draft on failure', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'src/features/travel/use-travel-chat-actions.ts'),
      'utf8',
    );
    const optimisticUpdate = source.indexOf(
      'setMessages((current) => [...current, optimisticMessage])',
    );
    const serverSend = source.indexOf('await sendTravelChatMessage');

    expect(optimisticUpdate).toBeGreaterThan(-1);
    expect(optimisticUpdate).toBeLessThan(serverSend);
    expect(source).toContain(
      'current.filter((item) => item.id !== optimisticId)',
    );
    expect(source).toContain('setDraft((current) => current || body)');
    expect(source).toContain('Message not sent. Your draft was restored.');
  });

  it('removes shared lists before the request and rolls back failed removals', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'src/services/todos/collaboration-members.ts'),
      'utf8',
    );
    for (const functionName of ['leaveTodoList', 'deleteSharedTodoList']) {
      const start = source.indexOf(`export async function ${functionName}`);
      const end = source.indexOf('\nexport ', start + 1);
      const implementation = source.slice(start, end);
      expect(implementation.indexOf('removeSharedList(listId)')).toBeLessThan(
        implementation.indexOf('await authenticatedClient()'),
      );
      expect(implementation).toContain('restoreSharedListRollback(listId, rollback');
    }
  });

  it('recovers from photo persistence failures while adding an itinerary item', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'src/features/travel/use-travel-plan-detail-add-item.ts'),
      'utf8',
    );
    expect(source).toContain("console.warn('[addTravelItineraryItem]', caught)");
    expect(source).toContain('Couldn’t save this itinerary item. Check its photos and try again.');
    expect(source).toContain('stopAddItem();\n      form.setError(');
  });
});
