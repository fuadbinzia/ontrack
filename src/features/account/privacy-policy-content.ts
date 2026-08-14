import { ONTRACK_SUPPORT_EMAIL } from '@/constants/legal';

import type { LegalSection } from './legal-document-screen';

export const PRIVACY_POLICY_INTRO =
  'onTrack (“we”, “us”) provides a local-first daily life app for schedules, food, fitness, health, finance, plants, travel, checklists, social features, and related tools. This Privacy Policy explains what information we collect, how we use and share it, and the choices you have.';

export const PRIVACY_POLICY_SECTIONS: readonly LegalSection[] = [
  {
    title: 'Information You Provide',
    paragraphs: [
      'Account information when you sign in with Apple or Google (such as a name and email address provided by that provider).',
      'Content you create in the app, including activities, followed events, meals, recipes, pantry items, workouts, plant profiles, travel plans and chat, checklists, vehicles, financial records, E-ZPass activity, vision-board items, notes, and files or photos you attach.',
      'Optional profile details such as a display name, home location for weather, nutrition preferences, allergies, dietary preferences, and a profile photo or icon.',
      'Email addresses you enter to invite friends or collaborators are used to address and deliver those invitations. Collaboration views use display names and account identifiers and do not disclose another member’s email address.',
    ],
  },
  {
    title: 'How We Use Information',
    paragraphs: [
      'We use information to provide the features you request, maintain your account, save and sync your data, enable sharing, deliver notifications and support, personalize app views, protect the Service, and improve reliability.',
      'We do not sell personal information or use private app content for advertising.',
    ],
  },
  {
    title: 'Location, Notifications, and Device Services',
    paragraphs: [
      'Approximate location when you allow it, used for local weather and travel departure suggestions.',
      'When you enable notifications, we and our delivery providers may process a push token, platform, app state, and your alert preferences to deliver reminders, calendar updates, or travel-chat alerts. Notification previews can be visible on a locked device depending on your system settings.',
      'When you use Siri or Android voice actions, onTrack keeps an app-private device snapshot of checklist names and open item titles so your assistant can add or read items. Apple or Google may process your spoken request and response under their own privacy terms; voice-list snapshots are not uploaded by onTrack solely for this feature.',
    ],
  },
  {
    title: 'Photos, Files, and Media',
    paragraphs: [
      'Camera, photo library, and document access are used only when you choose to capture, import, or attach content (for example meals, ingredient labels, plants, travel confirmations, E-ZPass statements, tax documents, vision-board items, or avatars).',
      'App-owned copies of images may be stored on your device and, when you are signed in, in private cloud storage tied to your account. System photo-library originals are never deleted by onTrack.',
      'Tax-preparation attachments are copied into app-controlled device storage. When you export a tax package or use a system share sheet, the files and summaries go to the destination you choose and that destination’s practices apply.',
    ],
  },
  {
    title: 'AI Features',
    paragraphs: [
      'Optional AI features (such as meal or ingredient analysis, plant identification, recipe import and ideas, travel-confirmation import or translation, E-ZPass statement parsing, finance-tip wording, daily summaries, or mood action ideas) send the content needed for the request to our processing providers.',
      'E-ZPass AI parsing sends the statement images or PDF you choose to submit. The structured result is designed to omit names, addresses, account and tag numbers, license plates, and payment-card details, but the source file itself may contain those details and is processed by the AI provider.',
      'Finance coaching is calculated from your records on your device. When AI wording is available, onTrack sends the locally generated tip text and a reference savings rate for rewriting, not your raw transaction ledger.',
      'Mood action ideas send only selected feeling labels, intensities, selected factor names, and desired feelings after a separate disclosure. Mood notes, Apple Health metrics, mood history, and identifiers are not included.',
      'AI results are informational estimates, not medical, nutritional, financial, tax, investment, horticultural, or other professional advice. You can turn AI summaries off in Profile; other AI tools run only when you choose to use them.',
    ],
  },
  {
    title: 'Health, Mood, and Food Profile Data',
    paragraphs: [
      'When you choose to connect Apple Health, onTrack reads only the activity, workout, heart-rate, sleep, and optional State of Mind types you authorize. Apple controls these permissions and you can change them in Apple Health.',
      'Apple Health summaries, mood check-ins, notes, factors, and personal playbooks stay in a separate encrypted store on this device and are not uploaded through onTrack cloud sync.',
      'If you explicitly enable State of Mind sync, onTrack can read authorized State of Mind entries and save compatible labels, associations, and an overall pleasantness value to Apple Health. Private notes, custom labels, and playbooks are never written there.',
      'Food profile details, including allergies, intolerances, avoided ingredients, dietary preferences, and nutrition priorities, are private by default. Community posts do not include them unless you separately enable the applicable sharing choice; allergy severity and private notes are never included in a community profile preview.',
    ],
  },
  {
    title: 'Finance and Linked Accounts',
    paragraphs: [
      'The optional Finance add-on can store records you enter or import, including institution and account names, account masks, balances, transactions, holdings, bills and subscriptions, savings goals, businesses and properties, credit-score history, tax-preparation metadata, and notes. Signed-in finance records are included in onTrack cloud sync.',
      'When you choose to link an account, Plaid (the current primary provider) or Teller handles the connection and provides only the accounts and data scopes you authorize, such as balances, transactions, or investment holdings. onTrack does not receive your financial-institution login credentials. Provider access credentials are encrypted and stored in a server-only vault.',
      'Disconnecting an institution revokes onTrack’s stored connection and removes records imported through that connection from onTrack. Plaid, Teller, and your financial institution may retain information under their own terms and privacy policies.',
      'onTrack does not initiate bank transfers, card payments, securities trades, credit-score pulls, or tax filings. Links to credit, tax, or financial sites open services operated by third parties.',
    ],
  },
  {
    title: 'E-ZPass Imports and Sharing',
    paragraphs: [
      'E-ZPass CSV, spreadsheet, and supported text imports are parsed on your device. Images and PDFs may use device text recognition or, when you choose AI parsing, be sent to our AI provider as described above. Imported activity can include transaction date and time, facility description, amount, activity type, and a generated duplicate-detection fingerprint.',
      'If you enable E-ZPass collaboration, selected friends can view the shared ledger’s activity dates, times, descriptions, amounts, types, member display names, and assignments. The original statement files, account numbers, tag numbers, license plates, and payment-card details are not included in the shared ledger.',
    ],
  },
  {
    title: 'Google Calendar',
    paragraphs: [
      'When you choose to connect Google Calendar, onTrack reads and writes calendar events so titles, notes, dates, times, updates, and deletions can sync in both directions. Google Calendar access is optional and is separate from signing in with Google.',
      'Google OAuth refresh credentials are encrypted and stored server-side. onTrack does not use Google Calendar data for advertising or AI training.',
      'You can disconnect while keeping existing events, or disconnect and remove Google events imported into onTrack and onTrack events exported to Google. Deleting your onTrack account also removes the stored connection credential.',
    ],
  },
  {
    title: 'StraiAway',
    paragraphs: [
      'When you choose to connect StraiAway, onTrack links your accounts and can send or import stay details you choose: property name, address, check-in and check-out, confirmation code, guest display name, booking link, and notes.',
      'Flights, expenses, trip chat, and StraiAway host operations are not shared. Partner tokens are stored server-side. You can disconnect at any time; existing stays remain in each app.',
    ],
  },
  {
    title: 'Collaboration, Community, and Sharing',
    paragraphs: [
      'When you share a trip, checklist, vehicle, E-ZPass ledger, or invite link, recipients you authorize can see the shared content and member identity needed to collaborate. Trip members can see trip-wide itinerary content and chat messages, reactions, and read state.',
      'Food community posts can be read by signed-in users and may show your display identity, caption, selected recipe or media, and dietary or allergy labels you explicitly choose to share. Content you send through the device share sheet leaves onTrack and is controlled by the receiving app or person.',
      'Invitation landing pages on our hosting domain help friends open or install the app; they do not grant access to your private account data without the invite capability.',
    ],
  },
  {
    title: 'Diagnostics and Usage Analytics',
    paragraphs: [
      'If an app screen fails, you can choose Send Crash Report. The report includes the app version and build, platform, device brand and model, operating-system version, screen context when known, error message, and technical stack trace. It is sent through our server and email delivery provider (Resend) to support. Error text or a stack trace could contain information related to what you were doing, so review this choice before sending.',
      'Optional product usage analytics (on by default; turn off in Profile → Usage Analytics) record approximate time spent on app areas plus anonymous route visits, transitions, success or failure outcomes, and coarsened page-load or named-action durations. A server-generated anonymous device label groups these aggregate actions by app installation for up to 90 days; it does not include a device name, advertising ID, Apple or Google identifier, account ID, IP address, or the raw installation ID. Route parameters, Health notes, financial records, meal contents, messages, and other private text are never included. Consenting guest and signed-in installs may upload these anonymous flow aggregates. Turning analytics off stops collection and clears pending flow events.',
    ],
  },
  {
    title: 'Third-Party Services',
    paragraphs: [
      'We use service providers to operate the app, including authentication, database, and realtime hosting (Supabase); sign-in and device services (Apple and Google); app and web hosting (Expo); email delivery (Resend); financial connections (Plaid and Teller, with Cloudflare infrastructure for Teller); and optional AI, analysis, search, mapping, weather, entertainment, sports, travel, and reference-data providers when those features are enabled.',
      'Examples include OpenAI, Google Gemini, USDA FoodData Central, TMDB, TheSportsDB, Ticketmaster, Amadeus, AeroDataBox, iNaturalist, Open-Meteo, Photon, NHTSA, and public currency or travel-data services. A search or lookup may send the query, relevant location or date, and standard network information such as an IP address to the provider.',
      'Their processing is governed by their own terms and privacy policies. Some providers act on our behalf, while others may process information for their own disclosed purposes, such as account security, fraud prevention, or legal compliance.',
      `Third-party company, product, service, team, league, event, venue, financial-institution, and toll-authority names or logos may appear for identification or visual presentation. Their appearance does not imply affiliation, sponsorship, endorsement, or an official partnership with onTrack. Rights holders may request review or removal by contacting ${ONTRACK_SUPPORT_EMAIL}.`,
    ],
  },
  {
    title: 'Guest Mode and Cloud Sync',
    paragraphs: [
      'Guest mode keeps data on the device until you sign in. If you create a new account, you can keep guest plans (upload them) or start fresh. If you sign into an existing account, you can merge device-only plans into your cloud account or use cloud data only — cloud stays the source of truth and is never silently replaced by guest data.',
      'On signed-in devices, cloud sync stores supported account data so it can follow you across devices you authorize. Apple Health and mood data remain outside onTrack cloud sync as described above; app-private voice snapshots and local tax-document files also remain on the device unless you explicitly export or share them.',
    ],
  },
  {
    title: 'Retention and Deletion',
    paragraphs: [
      'You can use Reset All Data from Profile to permanently remove app data and app-owned files from the device. When signed in, the same action also removes synced cloud data while retaining your account. Signing out removes account-owned local copies from that device but does not delete cloud data.',
      'Signed-in users can permanently delete their account from Profile. Account deletion removes your cloud account, synced app data, app-owned cloud media, calendar and partner credentials, and stored financial-connection credentials associated with that account, subject to short-term backups and legal retention where required.',
      'Shared resources you own (such as a checklist, trip, or E-ZPass ledger you host) are removed or become unavailable to collaborators when your account is deleted. Copies already exported, sent to another app, or retained by another person or third-party provider are outside onTrack’s control.',
      'Anonymous flow analytics are retained for up to 90 days as described above. Support crash reports and related email delivery records are retained only as reasonably needed to investigate the issue, provide support, secure the Service, or meet legal obligations.',
    ],
  },
  {
    title: 'Security',
    paragraphs: [
      'We use access controls, encrypted provider credentials, private cloud storage, and transport security designed to protect information. No storage or transmission method is completely secure, so we cannot guarantee absolute security.',
    ],
  },
  {
    title: 'Children',
    paragraphs: [
      'onTrack is not directed to children under 13, and we do not knowingly collect personal information from children under 13.',
    ],
  },
  {
    title: 'Changes to This Policy',
    paragraphs: [
      'We may update this Privacy Policy as the product changes. The “Last updated” date at the top will change when we do. Continued use after an update means you accept the revised policy.',
    ],
  },
  {
    title: 'Contact',
    paragraphs: [
      `For privacy questions or deletion requests, contact ${ONTRACK_SUPPORT_EMAIL}.`,
    ],
  },
];
