import fs from 'node:fs';
import path from 'node:path';

describe('write batching', () => {
  it('sends cloud domains in a multi-row upsert', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'src/services/cloud/sync-session.ts'),
      'utf8',
    );
    expect(source).toContain('async function pushDomains');
    expect(source).toContain('rows.slice(start, start + CLOUD_WRITE_BATCH_SIZE)');
    expect(source).not.toContain(
      'Promise.all(domains.map((domain) => pushDomain',
    );
  });

  it('chunks pending to-do mutations into one transactional RPC', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'src/services/todos/collaboration-mutations.ts'),
      'utf8',
    );
    const migration = fs.readFileSync(
      path.join(
        process.cwd(),
        'supabase/migrations/202607280003_performance_batches.sql',
      ),
      'utf8',
    );
    expect(source).toContain('pendingMutations.slice(0, TODO_MUTATION_BATCH_SIZE)');
    expect(source).toContain("client.rpc('apply_todo_mutations'");
    expect(migration).toContain('jsonb_array_length(mutations) > 50');
    expect(migration).toContain('perform public.apply_todo_mutation');
    expect(migration).toContain('from jsonb_array_elements');
  });
});
