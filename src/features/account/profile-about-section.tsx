import {
  SettingsActionRow,
  SettingsGroup,
  SettingsRow,
} from '@/components/primitives';
import { ProfileSection } from '@/features/account/profile-section';
import { useResponsive } from '@/hooks/use-responsive';
import { AgentTestId, AgentUiIds } from '@/utils/agent-ui';

type ProfileAboutSectionProps = {
  versionDetail: string;
  onOpenPrivacy: () => void;
  onOpenTerms: () => void;
};

/** Legal and version in one About stack. */
export function ProfileAboutSection({
  versionDetail,
  onOpenPrivacy,
  onOpenTerms,
}: ProfileAboutSectionProps) {
  const { spacing } = useResponsive();

  return (
    <ProfileSection testID={AgentUiIds.profile.section.about} title="About">
      <AgentTestId
        testID={AgentUiIds.profile.section.legal}
        label="Legal"
        style={{ gap: spacing.sm }}>
        <SettingsGroup>
          <SettingsActionRow
            label="Privacy Policy"
            detail="How onTrack handles your data"
            icon="shield"
            testID={AgentUiIds.profile.privacy}
            onPress={onOpenPrivacy}
            accessibilityLabel="Privacy Policy"
          />
          <SettingsActionRow
            label="Terms of Use"
            detail="Rules for using onTrack"
            icon="note"
            testID={AgentUiIds.profile.terms}
            onPress={onOpenTerms}
            accessibilityLabel="Terms of Use"
          />
        </SettingsGroup>
      </AgentTestId>
      <AgentTestId
        testID={AgentUiIds.profile.section.appInformation}
        label="App Information">
        <SettingsGroup>
          <SettingsRow
            label="Version"
            detail={versionDetail}
            icon="settings"
            testID={AgentUiIds.profile.version}
            accessibilityLabel="App version"
          />
        </SettingsGroup>
      </AgentTestId>
    </ProfileSection>
  );
}
