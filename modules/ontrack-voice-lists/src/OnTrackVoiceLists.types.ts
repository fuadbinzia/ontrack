export type VoiceKindHint = 'checklist' | 'grocery';

export type VoiceListSnapshotItem = {
  id: string;
  name: string;
  kind: VoiceKindHint;
  canEdit: boolean;
  updatedAt: string;
  openTitles: string[];
};

export type VoiceListSnapshot = {
  lists: VoiceListSnapshotItem[];
};

export type VoicePendingOp = {
  id: string;
  title: string;
  listId?: string;
  listName?: string;
  kindHint?: VoiceKindHint;
  createdAt: string;
};
