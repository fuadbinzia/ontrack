import { View } from 'react-native';

import { AppText, Card, GlassPlate, PanelTitle, Symbol } from '@/components/primitives';
import { appIconSections, type AppIconName } from '@/design-system';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { AgentTestId, AgentUiIds } from '@/utils/agent-ui';
import { formatCount } from '@/utils/grammar';

export function DesignSystemIconsPanel() {
  const { spacing } = useResponsive();

  return (
    <View style={{ gap: spacing.lg }}>
      <AppText variant="callout" color="secondary">
        Named icons used in the app. Prefer these keys over raw SF Symbol / Material names.
      </AppText>

      {appIconSections.map((section) => (
        <IconSection
          key={section.id}
          id={section.id}
          title={section.title}
          description={section.description}
          icons={section.icons}
        />
      ))}
    </View>
  );
}

function IconSection({
  id,
  title,
  description,
  icons,
}: {
  id: string;
  title: string;
  description: string;
  icons: readonly AppIconName[];
}) {
  const theme = useTheme();
  const { spacing, s, layout } = useResponsive();
  const cellMin = Math.max(72, s(76));

  return (
    <AgentTestId
      testID={AgentUiIds.designSystem.iconSection(id)}
      label={title}
      style={{ gap: spacing.md }}>
      <Card airy style={{ gap: spacing.md }}>
        <View style={{ gap: spacing.xs }}>
          <PanelTitle>{title}</PanelTitle>
          <AppText variant="caption" color="secondary">
            {description}
          </AppText>
          <AppText variant="caption" color="tertiary" fit>
            {formatCount(icons.length, 'icon')}
          </AppText>
        </View>

        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: spacing.sm,
          }}>
          {icons.map((name) => (
            <AgentTestId
              key={name}
              testID={AgentUiIds.designSystem.icon(name)}
              label={name}
              style={{ width: cellMin }}>
              <GlassPlate
                mist
                style={{
                  minHeight: Math.max(layout.minTapTarget, s(72)),
                  borderRadius: s(14),
                  padding: spacing.sm,
                  gap: spacing.xs,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Symbol name={name} size="lg" color={theme.accentPrimary} />
                <AppText
                  variant="caption"
                  color="secondary"
                  fit
                  style={{ width: '100%', textAlign: 'center' }}>
                  {name}
                </AppText>
              </GlassPlate>
            </AgentTestId>
          ))}
        </View>
      </Card>
    </AgentTestId>
  );
}
