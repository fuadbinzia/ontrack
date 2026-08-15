/** Journal agent-ui testIDs (composed into AgentUiIds). */

export const agentUiIdsJournal = {
  journal: {
    screen: 'ontrack.journal.screen',
    back: 'ontrack.journal.back',
    prevDay: 'ontrack.journal.prevDay',
    nextDay: 'ontrack.journal.nextDay',
    today: 'ontrack.journal.today',
    earlier: 'ontrack.journal.section.earlier',
    earlierPage: (dateKey: string) => `ontrack.journal.earlier.${dateKey}`,
    empty: 'ontrack.journal.empty',
    undo: 'ontrack.journal.undo',
    redo: 'ontrack.journal.redo',
    editMode: 'ontrack.journal.editMode',
    dismissEdit: 'ontrack.journal.dismissEdit',
    block: (id: string) => `ontrack.journal.block.${id}`,
    blockEdit: (id: string) => `ontrack.journal.block.${id}.edit`,
    blockSave: (id: string) => `ontrack.journal.block.${id}.save`,
    blockDelete: (id: string) => `ontrack.journal.block.${id}.delete`,
    blockRemove: (id: string) => `ontrack.journal.block.${id}.remove`,
    voicePlay: (id: string) => `ontrack.journal.block.${id}.play`,
    link: (id: string) => `ontrack.journal.link.${id}`,
    composer: {
      input: 'ontrack.journal.composer.input',
      menu: 'ontrack.journal.composer.menu',
      send: 'ontrack.journal.composer.send',
      dictate: 'ontrack.journal.composer.dictate',
      voiceNote: 'ontrack.journal.composer.voiceNote',
      stop: 'ontrack.journal.composer.stop',
      link: 'ontrack.journal.composer.link',
    },
    sectionSheet: {
      sheet: 'ontrack.journal.sections.sheet',
      close: 'ontrack.journal.sections.close',
      option: (section: string) => `ontrack.journal.sections.${section.replace(/[^a-zA-Z0-9]+/g, '_')}`,
    },
  },
};
