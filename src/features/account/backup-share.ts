import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Share } from 'react-native';

import {
  backupFileName,
  buildBackup,
  parseBackup,
  serializeBackup,
  type OnTrackBackup,
} from './backup-archive';
import { packBackupMedia } from './backup-media';

export async function writeBackupFile(backup?: OnTrackBackup): Promise<{
  file: File;
  name: string;
  json: string;
}> {
  const packed = await packBackupMedia(backup ?? buildBackup());
  const json = serializeBackup(packed);
  const name = backupFileName(new Date(packed.createdAt));
  const file = new File(Paths.cache, name);
  file.create({ overwrite: true, intermediates: true });
  file.write(json);
  return { file, name, json };
}

/** Write the backup JSON and open the system share sheet (Files, Drive, AirDrop). */
export async function downloadBackup(): Promise<{ name: string }> {
  const { file, name, json } = await writeBackupFile();
  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/json',
      dialogTitle: 'Save onTrack Backup',
      UTI: 'public.json',
    });
    return { name };
  }
  await Share.share({
    message: json,
    title: name,
  });
  return { name };
}

export async function pickBackupFile(): Promise<OnTrackBackup | undefined> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'public.json', '*/*'],
    copyToCacheDirectory: true,
  });
  if (result.canceled || !result.assets[0]?.uri) return undefined;
  const file = new File(result.assets[0].uri);
  const json = await file.text();
  return parseBackup(json);
}
