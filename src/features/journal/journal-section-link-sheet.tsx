import { StyleSheet, View } from 'react-native';

import { ActionChip, SheetScaffold } from '@/components/primitives';
import { useResponsive } from '@/hooks/use-responsive';
import { AgentUiIds } from '@/utils/agent-ui';

import type { JournalSectionLink } from './types';

export function JournalSectionLinkSheet({
  visible,
  links,
  onClose,
  onSelect,
}: {
  visible: boolean;
  links: readonly JournalSectionLink[];
  onClose: () => void;
  onSelect: (link: JournalSectionLink) => void;
}) {
  const { spacing } = useResponsive();

  return (
    <SheetScaffold
      visible={visible}
      title="Link a Section"
      subtitle="Jump from this page to another part of onTrack."
      onClose={onClose}
      closeTestID={AgentUiIds.journal.sectionSheet.close}
      backdropTestID={AgentUiIds.journal.sectionSheet.sheet}
      fitContent>
      <View style={[styles.wrap, { gap: spacing.sm }]}>
        {links.map((link) => (
          <ActionChip
            key={link.section}
            label={link.label}
            testID={AgentUiIds.journal.sectionSheet.option(link.section)}
            onPress={() => onSelect(link)}
          />
        ))}
      </View>
    </SheetScaffold>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});
