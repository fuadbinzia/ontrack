import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Card, CollapsibleSection, GlassPlate, Symbol } from '@/components/primitives';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import type { SavedEzPassStatement } from '@/store/finance-ezpass-statements';
import { AgentUiIds } from '@/utils/agent-ui';
import { formatDateLong } from '@/utils/date';

import { openEzPassStatement, resolveEzPassStatementUri } from './ezpass-statements';

export function FinanceEzPassStatementFiles({
  statements,
}: {
  statements: SavedEzPassStatement[];
}) {
  const theme = useTheme();
  const { spacing, layout } = useResponsive();
  if (!statements.length) return null;
  const fileCount = `${statements.length} ${statements.length === 1 ? 'File' : 'Files'}`;

  return (
    <Card variant="sunken" testID={AgentUiIds.finance.ezpass.statements}>
      <CollapsibleSection
        title="Uploaded Statements"
        detail={fileCount}
        description={`${fileCount} Saved On This Device`}
        testID={AgentUiIds.finance.ezpass.statementsToggle}
      >
        {statements.map((statement) => {
          const canOpen = statement.uris.some((uri) => Boolean(resolveEzPassStatementUri(uri)));
          return (
            <Pressable
              key={statement.id}
              accessibilityRole={canOpen ? 'link' : undefined}
              accessibilityLabel={`Open ${statement.name}`}
              disabled={!canOpen}
              onPress={() => void openEzPassStatement(statement.uris)}
              testID={AgentUiIds.finance.ezpass.statement(statement.id)}
              style={({ pressed }) => ({ opacity: pressed && canOpen ? 0.82 : 1 })}>
              <GlassPlate
                mist
                style={[
                  styles.row,
                  {
                    gap: spacing.sm,
                    minHeight: layout.minTapTarget,
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.sm,
                  },
                ]}>
                <Symbol name="receipt" size="sm" color={theme.accentPrimary} />
                <View style={styles.copy}>
                  <AppText variant="callout" color={canOpen ? 'accent' : 'primary'} fit>
                    {statement.name}
                  </AppText>
                  <AppText variant="caption" color="secondary" fit titleCase>
                    Saved {formatDateLong(statement.importedAt.slice(0, 10))}
                    {statement.uris.length > 1 ? ` · ${statement.uris.length} Files` : ''}
                  </AppText>
                </View>
                {canOpen ? <Symbol name="chevron-right" size="sm" color={theme.accentPrimary} /> : null}
              </GlassPlate>
            </Pressable>
          );
        })}
      </CollapsibleSection>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  copy: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
  },
});
