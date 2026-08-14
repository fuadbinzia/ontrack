import { NativeModule, requireOptionalNativeModule } from 'expo';

type TravelDocumentReaderEvents = {
  onDocumentOpened(event: { url: string }): void;
};

declare class TravelDocumentReaderModule extends NativeModule<TravelDocumentReaderEvents> {
  recognizeTextAsync(uri: string): Promise<string>;
  previewDocumentsAsync(uris: string[]): Promise<void>;
  takePendingDocumentUrlAsync?: () => Promise<string | null>;
}

// Keep screens that offer document import usable in binaries that were built
// before this optional native module was linked. The caller can then show an
// actionable message instead of crashing while the screen bundle is evaluated.
export default requireOptionalNativeModule<TravelDocumentReaderModule>(
  'TravelDocumentReader',
);
