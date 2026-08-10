import type { TodoInvite } from '@/store/todos';
import { useTodos } from '@/store/todos';

import {
  authenticatedClient,
  messageFrom,
  TodoCollaborationError,
} from './collaboration-core';
import { loadTodoListSnapshot } from './collaboration-mutations';

export async function loadTodoInvites(): Promise<TodoInvite[]> {
  const client = await authenticatedClient();
  const { data, error } = await client.rpc('list_todo_email_invites');
  if (error) {
    throw new TodoCollaborationError(
      messageFrom(error, 'Invitations could not be loaded.'),
    );
  }
  const invites: TodoInvite[] = Array.isArray(data)
    ? data.flatMap((row) => {
        if (!row || typeof row !== 'object') return [];
        const item = row as Record<string, unknown>;
        if (
          typeof item.id !== 'string' ||
          typeof item.list_id !== 'string' ||
          typeof item.list_name !== 'string' ||
          typeof item.inviter_name !== 'string' ||
          typeof item.invitee_email !== 'string'
        ) {
          return [];
        }
        return [{
          id: item.id,
          listId: item.list_id,
          listName: item.list_name,
          inviterName: item.inviter_name,
          inviteeEmail: item.invitee_email,
          code: item.id,
          createdAt:
            typeof item.created_at === 'string'
              ? item.created_at
              : new Date().toISOString(),
        }];
      })
    : [];
  useTodos.getState().replaceInvites(invites);
  return invites;
}

export async function createTodoEmailInvite(
  listId: string,
  email: string,
): Promise<void> {
  const client = await authenticatedClient();
  const { error } = await client.rpc('create_todo_email_invite', {
    requested_list_id: listId,
    requested_email: email.trim().toLowerCase(),
  });
  if (error) {
    throw new TodoCollaborationError(
      messageFrom(error, 'The invitation could not be created.'),
    );
  }
}

export interface PendingTodoEmailInvite {
  id: string;
  email: string;
  createdAt: string;
}

export async function loadTodoListPendingInvites(
  listId: string,
): Promise<PendingTodoEmailInvite[]> {
  const client = await authenticatedClient();
  const { data, error } = await client.rpc('todo_list_pending_invites', {
    requested_list_id: listId,
  });
  if (error) {
    throw new TodoCollaborationError(
      messageFrom(error, 'Pending invitations could not be loaded.'),
    );
  }
  return Array.isArray(data)
    ? data.flatMap((row) =>
        row &&
        typeof row.id === 'string' &&
        typeof row.invitee_email === 'string'
          ? [{
              id: row.id,
              email: row.invitee_email,
              createdAt:
                typeof row.created_at === 'string'
                  ? row.created_at
                  : new Date().toISOString(),
            }]
          : [],
      )
    : [];
}

export async function revokeTodoEmailInvite(inviteId: string): Promise<void> {
  const client = await authenticatedClient();
  const { error } = await client.rpc('revoke_todo_email_invite', {
    invite_id: inviteId,
  });
  if (error) {
    throw new TodoCollaborationError(
      messageFrom(error, 'The invitation could not be revoked.'),
    );
  }
}

export async function acceptTodoEmailInvite(inviteId: string): Promise<string> {
  const client = await authenticatedClient();
  const { data, error } = await client.rpc('accept_todo_email_invite', {
    invite_id: inviteId,
  });
  if (error || typeof data !== 'string') {
    throw new TodoCollaborationError(
      messageFrom(error, 'The invitation could not be accepted.'),
    );
  }
  await loadTodoListSnapshot(data);
  await loadTodoInvites();
  return data;
}

export async function createTodoShareLink(listId: string): Promise<string> {
  const client = await authenticatedClient();
  const { data, error } = await client.rpc('create_todo_share_link', {
    requested_list_id: listId,
  });
  if (error || typeof data !== 'string') {
    throw new TodoCollaborationError(
      messageFrom(error, 'A share link could not be created.'),
    );
  }
  useTodos.getState().setShareCode(listId, data);
  return data;
}

export async function revokeTodoShareLink(listId: string): Promise<void> {
  const client = await authenticatedClient();
  const { error } = await client.rpc('revoke_todo_share_link', {
    requested_list_id: listId,
  });
  if (error) {
    throw new TodoCollaborationError(
      messageFrom(error, 'The share link could not be revoked.'),
    );
  }
  useTodos.getState().setShareCode(listId, undefined);
}

export async function resolveTodoShareLink(
  code: string,
): Promise<{ listId: string; listName: string; ownerName: string } | undefined> {
  const client = await authenticatedClient();
  const { data, error } = await client.rpc('resolve_todo_share_link', {
    link_code: code,
  });
  if (error) {
    throw new TodoCollaborationError(
      messageFrom(error, 'This list link could not be opened.'),
    );
  }
  const row = Array.isArray(data) ? data[0] : undefined;
  if (
    !row ||
    typeof row.list_id !== 'string' ||
    typeof row.list_name !== 'string' ||
    typeof row.owner_name !== 'string'
  ) {
    return undefined;
  }
  return {
    listId: row.list_id,
    listName: row.list_name,
    ownerName: row.owner_name,
  };
}

export async function acceptTodoShareLink(code: string): Promise<string> {
  const client = await authenticatedClient();
  const { data, error } = await client.rpc('accept_todo_share_link', {
    link_code: code,
  });
  if (error || typeof data !== 'string') {
    throw new TodoCollaborationError(
      messageFrom(error, 'This list link is invalid or has been revoked.'),
    );
  }
  await loadTodoListSnapshot(data);
  return data;
}

export async function createTodoCollaboratorLink(listIds: string[]): Promise<string> {
  const client = await authenticatedClient();
  const { data, error } = await client.rpc('create_todo_collaborator_link', {
    requested_list_ids: listIds,
  });
  if (error || typeof data !== 'string') {
    throw new TodoCollaborationError(
      messageFrom(error, 'A collaborator link could not be created.'),
    );
  }
  return data;
}

export async function revokeTodoCollaboratorLink(code: string): Promise<void> {
  const client = await authenticatedClient();
  const { error } = await client.rpc('revoke_todo_collaborator_link', {
    link_code: code,
  });
  if (error) {
    throw new TodoCollaborationError(
      messageFrom(error, 'The collaborator link could not be revoked.'),
    );
  }
}

export async function resolveTodoCollaboratorLink(
  code: string,
): Promise<{ inviterName: string; listNames: string[] } | undefined> {
  const client = await authenticatedClient();
  const { data, error } = await client.rpc('resolve_todo_collaborator_link', {
    link_code: code,
  });
  if (error) {
    throw new TodoCollaborationError(
      messageFrom(error, 'This collaborator link could not be opened.'),
    );
  }
  const row = Array.isArray(data) ? data[0] : undefined;
  if (
    !row ||
    typeof row.inviter_name !== 'string' ||
    !Array.isArray(row.list_names)
  ) {
    return undefined;
  }
  const listNames = row.list_names.filter(
    (name: unknown): name is string => typeof name === 'string',
  );
  return listNames.length ? { inviterName: row.inviter_name, listNames } : undefined;
}

export async function acceptTodoCollaboratorLink(code: string): Promise<string[]> {
  const client = await authenticatedClient();
  const { data, error } = await client.rpc('accept_todo_collaborator_link', {
    link_code: code,
  });
  const listIds = Array.isArray(data)
    ? data.filter((id: unknown): id is string => typeof id === 'string')
    : [];
  if (error || !listIds.length) {
    throw new TodoCollaborationError(
      messageFrom(error, 'This collaborator link is invalid or has been revoked.'),
    );
  }
  await Promise.all(listIds.map((listId) => loadTodoListSnapshot(listId)));
  return listIds;
}
