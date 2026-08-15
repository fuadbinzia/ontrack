export type JournalBlockKind = 'text' | 'voice' | 'link';

type JournalBlockTimes = {
  createdAt: string;
  updatedAt: string;
};

export type JournalTextBlock = JournalBlockTimes & {
  id: string;
  kind: 'text';
  text: string;
};

export type JournalVoiceBlock = JournalBlockTimes & {
  id: string;
  kind: 'voice';
  uri: string;
  durationMs: number;
};

export type JournalLinkBlock = JournalBlockTimes & {
  id: string;
  kind: 'link';
  section: string;
  label: string;
};

export type JournalBlock = JournalTextBlock | JournalVoiceBlock | JournalLinkBlock;

export type JournalPage = {
  id: string;
  dateKey: string;
  blocks: JournalBlock[];
  createdAt: string;
  updatedAt: string;
};

export type JournalSectionLink = {
  section: string;
  label: string;
  href: string;
};
