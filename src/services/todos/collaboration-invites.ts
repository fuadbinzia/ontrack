import type { ChecklistInvite } from '@/store/todos';
import { useChecklists } from '@/store/todos';

import {
  authenticatedClient,
  messageFrom,
  ChecklistCollaborationError,
} from './collaboration-core';
import { loadChecklistSnapshot } from './collaboration-mutations';

export async function loadChecklistInvites(): Promise<ChecklistInvite[]> {
  const client = await authenticatedClient();
  const { data, error } = await client.rpc('list_todo_email_invites');
  if (error) {
    throw new ChecklistCollaborationError(
      messageFrom(error, 'Invitations could not be loaded.'),
    );
  }
  const invites: ChecklistInvite[] = Array.isArray(data)
    ? data.flatMap((row) => {
        if (!row || typeof row !== 'object') return [];
        const item = row as Record<string, unknown>;
        if (
          typeof item.id !== 'string' ||
          typeof item.list_id !== 'string' ||
          typeof item.list_name !== 'string' ||
          typeof item.inviter_name !== 'string'
        ) {
          return [];
        }
        return [{
          id: item.id,
          listId: item.list_id,
          listName: item.list_name,
          inviterName: item.inviter_name,
          code: item.id,
          createdAt:
            typeof item.created_at === 'string'
              ? item.created_at
              : new Date().toISOString(),
        }];
      })
    : [];
  useChecklists.getState().replaceInvites(invites);
  return invites;
}

export async function createChecklistEmailInvite(
  listId: string,
  email: string,
): Promise<void> {
  const client = await authenticatedClient();
  const { error } = await client.rpc('create_todo_email_invite', {
    requested_list_id: listId,
    requested_email: email.trim().toLowerCase(),
  });
  if (error) {
    throw new ChecklistCollaborationError(
      messageFrom(error, 'The invitation could not be created.'),
    );
  }
}

export interface PendingChecklistEmailInvite {
  id: string;
  createdAt: string;
}

export async function loadChecklistPendingInvites(
  listId: string,
): Promise<PendingChecklistEmailInvite[]> {
  const client = await authenticatedClient();
  const { data, error } = await client.rpc('todo_list_pending_invites', {
    requested_list_id: listId,
  });
  if (error) {
    throw new ChecklistCollaborationError(
      messageFrom(error, 'Pending invitations could not be loaded.'),
    );
  }
  return Array.isArray(data)
    ? data.flatMap((row) =>
        row &&
        typeof row.id === 'string'
          ? [{
              id: row.id,
              createdAt:
                typeof row.created_at === 'string'
                  ? row.created_at
                  : new Date().toISOString(),
            }]
          : [],
      )
    : [];
}

export async function revokeChecklistEmailInvite(inviteId: string): Promise<void> {
  const client = await authenticatedClient();
  const { error } = await client.rpc('revoke_todo_email_invite', {
    invite_id: inviteId,
  });
  if (error) {
    throw new ChecklistCollaborationError(
      messageFrom(error, 'The invitation could not be revoked.'),
    );
  }
}

export async function acceptChecklistEmailInvite(inviteId: string): Promise<string> {
  const client = await authenticatedClient();
  const { data, error } = await client.rpc('accept_todo_email_invite', {
    invite_id: inviteId,
  });
  if (error || typeof data !== 'string') {
    throw new ChecklistCollaborationError(
      messageFrom(error, 'The invitation could not be accepted.'),
    );
  }
  await loadChecklistSnapshot(data);
  await loadChecklistInvites();
  return data;
}

export async function createChecklistShareLink(listId: string): Promise<string> {
  const client = await authenticatedClient();
  const { data, error } = await client.rpc('create_todo_share_link', {
    requested_list_id: listId,
  });
  if (error || typeof data !== 'string') {
    throw new ChecklistCollaborationError(
      messageFrom(error, 'A share link could not be created.'),
    );
  }
  useChecklists.getState().setShareCode(listId, data);
  return data;
}

export async function revokeChecklistShareLink(listId: string): Promise<void> {
  const client = await authenticatedClient();
  const { error } = await client.rpc('revoke_todo_share_link', {
    requested_list_id: listId,
  });
  if (error) {
    throw new ChecklistCollaborationError(
      messageFrom(error, 'The share link could not be revoked.'),
    );
  }
  useChecklists.getState().setShareCode(listId, undefined);
}

export async function resolveChecklistShareLink(
  code: string,
): Promise<{ listId: string; listName: string; ownerName: string } | undefined> {
  const client = await authenticatedClient();
  const { data, error } = await client.rpc('resolve_todo_share_link', {
    link_code: code,
  });
  if (error) {
    throw new ChecklistCollaborationError(
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

export async function acceptChecklistShareLink(code: string): Promise<string> {
  const client = await authenticatedClient();
  const { data, error } = await client.rpc('accept_todo_share_link', {
    link_code: code,
  });
  if (error || typeof data !== 'string') {
    throw new ChecklistCollaborationError(
      messageFrom(error, 'This list link is no longer open. Ask the owner for a fresh invite.'),
    );
  }
  await loadChecklistSnapshot(data);
  return data;
}

export async function createChecklistCollaboratorLink(listIds: string[]): Promise<string> {
  const client = await authenticatedClient();
  const { data, error } = await client.rpc('create_todo_collaborator_link', {
    requested_list_ids: listIds,
  });
  if (error || typeof data !== 'string') {
    throw new ChecklistCollaborationError(
      messageFrom(error, 'A collaborator link could not be created.'),
    );
  }
  return data;
}

export async function revokeChecklistCollaboratorLink(code: string): Promise<void> {
  const client = await authenticatedClient();
  const { error } = await client.rpc('revoke_todo_collaborator_link', {
    link_code: code,
  });
  if (error) {
    throw new ChecklistCollaborationError(
      messageFrom(error, 'The collaborator link could not be revoked.'),
    );
  }
}

export async function resolveChecklistCollaboratorLink(
  code: string,
): Promise<{ inviterName: string; listNames: string[] } | undefined> {
  const client = await authenticatedClient();
  const { data, error } = await client.rpc('resolve_todo_collaborator_link', {
    link_code: code,
  });
  if (error) {
    throw new ChecklistCollaborationError(
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

export async function acceptChecklistCollaboratorLink(code: string): Promise<string[]> {
  const client = await authenticatedClient();
  const { data, error } = await client.rpc('accept_todo_collaborator_link', {
    link_code: code,
  });
  const listIds = Array.isArray(data)
    ? data.filter((id: unknown): id is string => typeof id === 'string')
    : [];
  if (error || !listIds.length) {
    throw new ChecklistCollaborationError(
      messageFrom(error, 'This collaborator link is no longer open. Ask the owner for a fresh invite.'),
    );
  }
  await Promise.all(listIds.map((listId) => loadChecklistSnapshot(listId)));
  return listIds;
}
