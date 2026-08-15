import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const modal = readFileSync(
  join(process.cwd(), 'src/features/social/social-friends-modal.tsx'),
  'utf8',
);
const hub = readFileSync(
  join(process.cwd(), 'src/features/social/social-hub-screen.tsx'),
  'utf8',
);

describe('social friends modal polish', () => {
  it('moves invite controls into an in-tree bottom sheet over atmosphere-backed glass', () => {
    expect(modal).toContain('<ScreenAtmosphere />');
    expect(modal).toMatch(/<SheetScaffold\s+host="route"\s+visible/);
    expect(modal).toMatch(/<GlassPlate\s+inverted\s+tintColor=\{chrome\.primaryDeep}/);
    expect(modal).toMatch(/<GlassPlate mist style=\{styles\.inviteUrlPlate}/);
  });

  it('keeps the friends list primary and opens invite tools from the top-right icon', () => {
    const mainModal = modal.match(
      /export function SocialFriendsModal[\s\S]*?function SocialInviteToolsSheet/,
    )?.[0];

    expect(mainModal).toBeDefined();
    expect(mainModal).toMatch(
      /testID=\{AgentUiIds\.social\.friends\.openInviteTools}[\s\S]*?icon="invite"/,
    );
    expect(mainModal).toMatch(/AgentUiIds\.social\.friends\.listSection/);
    expect(mainModal?.indexOf('listSection')).toBeLessThan(
      mainModal?.indexOf('props.incoming') ?? 0,
    );
    expect(mainModal).not.toContain('testID={AgentUiIds.social.friendEmail}');
  });

  it('shows friend names without the redundant connection subtitle', () => {
    const mainModal = modal.match(
      /export function SocialFriendsModal[\s\S]*?function SocialInviteToolsSheet/,
    )?.[0];

    expect(mainModal).toBeDefined();
    expect(mainModal).not.toContain('Connected through onTrack');
    expect(mainModal).toContain(
      '<SocialIdentityName>{friend.displayName}</SocialIdentityName>',
    );
    expect(mainModal).toContain('Wants to connect');
    expect(mainModal).toContain('Request pending');
  });

  it('keeps trip invitations inside Travel instead of friend rows', () => {
    expect(modal).not.toContain('Add to Trip');
    expect(modal).not.toContain('onAddToTrip');
    expect(modal).not.toContain('friendAddToTrip');
    expect(hub).toMatch(
      /if \(action === 'invite-trip'\) \{[\s\S]*?router\.push\('\/\(tabs\)\/travel'/,
    );
    expect(hub).not.toContain('shareTravelPlanWithFriend');
    expect(hub).not.toContain('chooseTripForFriend');
  });

  it('gives an empty friend list a playful path into the same invite sheet', () => {
    expect(modal).toContain('Your Circle Is Ready for a Plot Twist');
    expect(modal).toContain('Add Your First Friend');
    expect(modal).toMatch(
      /actionTestID=\{AgentUiIds\.social\.friends\.emptyAdd}[\s\S]*?setInviteToolsVisible\(true\)/,
    );
  });

  it('does not paint rectangular fills behind rounded invite buttons', () => {
    const inviteControls = modal.match(
      /testID=\{AgentUiIds\.social\.friendSend}[\s\S]*?Share Invite Link/,
    )?.[0];

    expect(inviteControls).toBeDefined();
    expect(inviteControls).not.toMatch(/style=\{\{ backgroundColor:/);
    expect(inviteControls).not.toMatch(/fieldBackground="rgba/);
  });

  it('keeps the share URL compact and copyable beside a single primary action', () => {
    expect(modal).toMatch(
      /accessibilityLabel="Copy invite link"[\s\S]*?numberOfLines=\{1}[\s\S]*?ellipsizeMode="middle"/,
    );
    expect(modal.match(/testID=\{AgentUiIds\.social\.inviteShare}/g)).toHaveLength(1);
  });
});
