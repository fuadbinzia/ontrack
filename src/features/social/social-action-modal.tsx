import { Modal, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AppText,
  Button,
  GlassPlate,
  SheetGrabber,
  Symbol,
  useScreenAtmosphereChrome,
} from '@/components/primitives';
import { radii } from '@/design-system';
import { socialChrome, socialShadow } from '@/features/social/social-chrome';
import type { SocialPlaceholder } from '@/features/social/social-types';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { AgentUiIds } from '@/utils/agent-ui';

export function SocialActionModal({
  content,
  onClose,
  onPrimary,
}: {
  content?: SocialPlaceholder;
  onClose: () => void;
  onPrimary?: () => void;
}) {
  const theme = useTheme();
  const chrome = socialChrome(theme);
  const insets = useSafeAreaInsets();
  const { spacing, s } = useResponsive();
  useScreenAtmosphereChrome(Boolean(content));

  return (
    <Modal
      visible={Boolean(content)}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}>
      <View
        style={[
          styles.root,
          {
            paddingTop: insets.top + spacing.sm,
            paddingBottom: insets.bottom + spacing.lg,
            paddingHorizontal: spacing.lg,
          },
        ]}>
        <View style={[styles.header, { gap: spacing.md }]}>
          <SheetGrabber
            testID={AgentUiIds.social.actionModal.close}
            accessibilityLabel="Close social action"
            onPress={onClose}
          />
          <View style={styles.headerCopy}>
            <AppText variant="overline" style={{ color: chrome.primary }} fit>
              Social
            </AppText>
          </View>
        </View>

        {content ? (
          <View style={[styles.center, { gap: spacing.lg }]}>
            <View
              style={[
                styles.iconPlate,
                {
                  width: Math.max(76, s(84)),
                  height: Math.max(76, s(84)),
                  borderRadius: Math.max(24, s(28)),
                  backgroundColor: chrome.mint,
                },
              ]}>
              <Symbol name={content.icon} size="xl" color={chrome.primary} />
            </View>
            <View style={[styles.copy, { gap: spacing.sm }]}>
              <AppText variant="heading" align="center" bold>
                {content.title}
              </AppText>
              <AppText variant="body" color="secondary" align="center">
                {content.message}
              </AppText>
            </View>
            <GlassPlate
              style={[
                styles.statusCard,
                {
                  padding: spacing.lg,
                  ...socialShadow(chrome.shadow, 'raised'),
                },
              ]}>
              <View style={[styles.statusDot, { backgroundColor: chrome.primary }]} />
              <View style={styles.statusCopy}>
                <AppText variant="callout" bold fit>
                  {content.statusTitle ?? 'Nothing waiting yet'}
                </AppText>
                <AppText variant="caption" color="secondary">
                  {content.statusMessage ??
                    'When your circle starts sharing, the latest update will be ready here.'}
                </AppText>
              </View>
            </GlassPlate>
          </View>
        ) : null}

        <Button
          testID={AgentUiIds.social.actionModal.primary}
          disabled={!content}
          onPress={() => {
            if (onPrimary) onPrimary();
            else onClose();
          }}
          style={{ backgroundColor: chrome.primary }}>
          {content?.primaryLabel ?? 'Done'}
        </Button>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    alignSelf: 'stretch',
  },
  headerCopy: {
    alignSelf: 'stretch',
    minWidth: 0,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconPlate: {
    alignItems: 'center',
    justifyContent: 'center',
    borderCurve: 'continuous',
  },
  copy: {
    maxWidth: 330,
  },
  statusCard: {
    width: '100%',
    maxWidth: 360,
    minHeight: 76,
    borderRadius: radii.lg,
    borderCurve: 'continuous',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  statusDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    marginTop: 5,
  },
  statusCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
});
