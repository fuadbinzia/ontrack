import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function source(path: string) {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

describe('collaboration email privacy', () => {
  const migration = source(
    'supabase/migrations/202608140003_collaboration_email_privacy.sql',
  );

  it('does not return another account email from collaboration APIs', () => {
    const friendsResult = migration.match(
      /create function public\.list_friends\(\)[\s\S]*?\$\$;/,
    )?.[0];
    const requestsResult = migration.match(
      /create function public\.list_friend_requests\(\)[\s\S]*?\$\$;/,
    )?.[0];
    const rosterResult = migration.match(
      /create or replace function public\.list_travel_trip_roster[\s\S]*?\nend;\n\$\$;/,
    )?.[0];

    expect(friendsResult).toBeDefined();
    expect(requestsResult).toBeDefined();
    expect(rosterResult).toBeDefined();
    expect(friendsResult).not.toMatch(/\bemail\b/);
    expect(requestsResult).not.toMatch(/other_email|profile\.email|request\.to_email\s+as/);
    expect(rosterResult).not.toMatch(/'email'|auth\.users|invitee_email\s+as/);
  });

  it('keeps email input-only when inviting an accepted friend', () => {
    const friendInvite = migration.match(
      /create or replace function public\.create_travel_friend_invite[\s\S]*?\nend;\n\$\$;/,
    )?.[0];

    expect(friendInvite).toMatch(/public\.friendships/);
    expect(friendInvite).toMatch(/invitee_user_id uuid/);
    expect(friendInvite).toMatch(/public\.create_travel_invite/);
    expect(friendInvite).not.toMatch(/jsonb_build_object|returns table/);
  });

  it('renders collaborator identities by name while retaining self email in Profile', () => {
    const friendsModal = source('src/features/social/social-friends-modal.tsx');
    const peoplePicker = source('src/features/social/people-picker.tsx');
    const joinPanel = source('src/features/travel/travel-friends-join-panels.tsx');
    const inviteInbox = source('src/features/todos/todo-invites-screen.tsx');
    const authScreen = source('src/features/auth/auth-screen.tsx');
    const profile = source('src/features/account/cloud-account-card.tsx');

    expect(friendsModal).not.toMatch(/friend\.email|request\.otherEmail/);
    expect(peoplePicker).not.toMatch(/friend\.email|name-and-email/);
    expect(joinPanel).not.toMatch(/request\.requesterEmail/);
    expect(inviteInbox).not.toMatch(/user\.email/);
    expect(authScreen).not.toMatch(/Signed in as \$\{lockedEmail\}/);
    expect(profile).toMatch(/user\?\.email/);
  });

  it('keeps friend-list emails hidden and renders every identity name at one text size', () => {
    const friendsModal = source('src/features/social/social-friends-modal.tsx');
    const identityName = friendsModal.match(
      /function SocialIdentityName[\s\S]*?\n}/,
    )?.[0];

    expect(identityName).toBeDefined();
    expect(identityName).toMatch(/variant="callout"/);
    expect(identityName).toMatch(/numberOfLines=\{1}/);
    expect(identityName).not.toMatch(/\bfit\b|adjustsFontSizeToFit/);
    expect(friendsModal.match(/<SocialIdentityName>/g)).toHaveLength(3);
    expect(friendsModal).not.toMatch(/friend\.email|request\.otherEmail/);
  });
});
