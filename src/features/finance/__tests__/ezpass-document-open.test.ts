import fs from 'node:fs';
import path from 'node:path';

import {
  ezPassAssetFromDocumentUrl,
  incomingEzPassDocumentDestination,
  nextIncomingEzPassDocumentUri,
} from '../ezpass-document-open';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { patchAppDelegate } = require('../../../../plugins/with-ontrack-document-open');

describe('E-ZPass document open handoff', () => {
  it('routes an iOS-opened CSV directly to the E-ZPass importer', () => {
    const uri = 'file:///Documents/Inbox/Transaction_Report_20260814.csv';
    expect(ezPassAssetFromDocumentUrl(uri)).toEqual({
      uri,
      name: 'Transaction_Report_20260814.csv',
      mimeType: 'text/csv',
    });
    expect(incomingEzPassDocumentDestination(uri)).toEqual({
      pathname: '/(tabs)/finance/ezpass-import',
      params: { source: 'document', uri },
    });
  });

  it.each([
    ['file:///Documents/report.tsv', 'text/tab-separated-values'],
    ['file:///Documents/report.xls', 'application/vnd.ms-excel'],
    ['file:///Documents/report.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    ['file:///Documents/report.pdf', 'application/pdf'],
  ])('accepts supported document %s', (uri, mimeType) => {
    expect(ezPassAssetFromDocumentUrl(uri)?.mimeType).toBe(mimeType);
  });

  it('routes an iOS-opened PDF directly to the E-ZPass importer', () => {
    const uri = 'file:///Documents/Inbox/Transaction_Report_20260814.pdf';
    expect(incomingEzPassDocumentDestination(uri)).toEqual({
      pathname: '/(tabs)/finance/ezpass-import',
      params: { source: 'document', uri },
    });
  });

  it('starts each distinct opened document while suppressing only the same URI', () => {
    const csv = 'file:///Documents/Inbox/report.csv';
    const pdf = 'file:///Documents/Inbox/report.pdf';
    expect(nextIncomingEzPassDocumentUri('document', csv, undefined)).toBe(csv);
    expect(nextIncomingEzPassDocumentUri('document', csv, csv)).toBeUndefined();
    expect(nextIncomingEzPassDocumentUri('document', pdf, csv)).toBe(pdf);
    expect(nextIncomingEzPassDocumentUri(undefined, pdf, csv)).toBeUndefined();
  });

  it('rejects web links and unrelated document types', () => {
    expect(ezPassAssetFromDocumentUrl('https://example.com/report.csv')).toBeUndefined();
    expect(ezPassAssetFromDocumentUrl('file:///Documents/report.zip')).toBeUndefined();
  });

  it('registers supported document types and the durable native handoff plugin', () => {
    const root = path.resolve(__dirname, '../../../..');
    const appConfig = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));
    const documentTypes = appConfig.expo.ios.infoPlist.CFBundleDocumentTypes;
    expect(documentTypes[0].LSItemContentTypes).toEqual(expect.arrayContaining([
      'public.comma-separated-values-text',
      'public.tab-separated-values-text',
      'org.openxmlformats.spreadsheetml.sheet',
      'com.adobe.pdf',
    ]));
    expect(appConfig.expo.ios.infoPlist.LSSupportsOpeningDocumentsInPlace).toBe(false);
    expect(appConfig.expo.plugins).toContain('./plugins/with-ontrack-document-open.js');
  });

  it('always forwards iOS document opens to React Native before Expo handles them', () => {
    const appDelegate = patchAppDelegate(`func application() -> Bool {
    return super.application(app, open: url, options: options) || RCTLinkingManager.application(app, open: url, options: options)
  }`);
    const linkingCall = appDelegate.indexOf(
      'let linkingResult = RCTLinkingManager.application(app, open: url, options: options)',
    );
    const expoCall = appDelegate.indexOf(
      'let expoResult = super.application(app, open: url, options: options)',
    );
    expect(linkingCall).toBeGreaterThan(-1);
    expect(expoCall).toBeGreaterThan(linkingCall);
    expect(appDelegate).toContain('return expoResult || linkingResult');
  });

  it('keeps a native pending document until JavaScript is ready to receive it', () => {
    const root = path.resolve(__dirname, '../../../..');
    const moduleConfig = JSON.parse(fs.readFileSync(
      path.join(root, 'modules/travel-document-reader/expo-module.config.json'),
      'utf8',
    ));
    expect(moduleConfig.apple.appDelegateSubscribers).toContain(
      'TravelDocumentReaderAppDelegateSubscriber',
    );
    const subscriber = fs.readFileSync(
      path.join(
        root,
        'modules/travel-document-reader/ios/TravelDocumentReaderAppDelegateSubscriber.swift',
      ),
      'utf8',
    );
    expect(subscriber).toContain('UserDefaults.standard.set(url.absoluteString');
    expect(subscriber).toContain('TravelDocumentInbox.capture(url)');
    const nativeModule = fs.readFileSync(
      path.join(root, 'modules/travel-document-reader/ios/TravelDocumentReaderModule.swift'),
      'utf8',
    );
    expect(nativeModule).toContain('AsyncFunction("takePendingDocumentUrlAsync")');
    expect(nativeModule).toContain('Events("onDocumentOpened")');
  });
});
