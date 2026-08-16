import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/primitives';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';

import { useAuthCopyScale } from './auth-constellation';
import { authRingCopyType } from './auth-ring-copy-type';

/** Headline + intro inside the constellation planet. Type never fit-shrinks. */
export function AuthRingCopy({
  headline,
  intro,
}: {
  headline: string;
  intro: string;
}) {
  const theme = useTheme();
  const { s, typography } = useResponsive();
  const type = authRingCopyType(useAuthCopyScale(), typography);

  return (
    <>
      <AppText
        variant="display"
        align="center"
        style={{
          fontSize: type.headline.fontSize,
          lineHeight: type.headline.lineHeight,
        }}>
        {headline}
      </AppText>
      <View
        style={[
          styles.rule,
          {
            width: s(40) * type.ruleScale,
            height: Math.max(1, s(1.5)),
            backgroundColor: theme.accentPrimary,
          },
        ]}
      />
      <AppText
        variant="body"
        color="secondary"
        align="center"
        style={{
          fontSize: type.intro.fontSize,
          lineHeight: type.intro.lineHeight,
        }}>
        {intro}
      </AppText>
    </>
  );
}

const styles = StyleSheet.create({
  rule: { borderRadius: 1 },
});
