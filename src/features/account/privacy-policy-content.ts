import { ONTRACK_SUPPORT_EMAIL } from '@/constants/legal';

import type { LegalSection } from './legal-document-screen';

export const PRIVACY_POLICY_INTRO =
  'onTrack (“we”, “us”) provides a local-first daily life app for schedules, food, fitness, health, plants, travel, checklists, and related tools. This Privacy Policy explains what information we collect, how we use it, and the choices you have.';

export const PRIVACY_POLICY_SECTIONS: readonly LegalSection[] = [
  {
    title: 'Information you provide',
    paragraphs: [
      'Account information when you sign in with Apple or Google (such as a name and email address provided by that provider).',
      'Content you create in the app, including activities, meals, workouts, plant profiles, travel plans, checklists, vehicles, vision-board items, notes, and photos you attach.',
      'Optional profile details such as a display name, home location for weather, nutrition preferences, and a profile photo or icon.',
    ],
  },
  {
    title: 'Information collected automatically',
    paragraphs: [
      'Approximate location when you allow it, used for local weather and travel departure suggestions.',
      'Device and app diagnostics needed to operate sync, notifications, and crash recovery. We do not sell personal information.',
      'Optional product usage analytics (on by default; turn off in Profile → Usage Analytics) record approximate time spent on app areas such as Travel or Today. These rollups help us improve the product and support. They do not include Health notes, meal contents, messages, or other private text. When you are signed in, daily totals may sync with your account so we can understand overall engagement. Guests keep usage data on the device only.',
      'On signed-in devices, cloud sync stores your account data so it can follow you across devices you authorize.',
    ],
  },
  {
    title: 'Photos, camera, and media',
    paragraphs: [
      'Camera and photo library access are used only when you choose to capture or attach images (for example meals, plants, vision board, or avatars).',
      'App-owned copies of images may be stored on your device and, when you are signed in, in private cloud storage tied to your account. System photo-library originals are not deleted when you sign out or reset local data.',
    ],
  },
  {
    title: 'AI features',
    paragraphs: [
      'Optional AI features (such as meal analysis, plant identification, recipe import, daily summaries, or mood action ideas) send only the content you explicitly submit for analysis to our processing providers.',
      'Mood action ideas send only selected feeling labels, intensities, selected factor names, and desired feelings after a separate disclosure. Mood notes, Apple Health metrics, mood history, and identifiers are not included.',
      'AI results are informational estimates, not medical, nutritional, horticultural, or professional advice. You can turn AI summaries off in Profile.',
    ],
  },
  {
    title: 'Health and mood data',
    paragraphs: [
      'When you choose to connect Apple Health, onTrack reads only the activity, workout, heart-rate, sleep, and optional State of Mind types you authorize. Apple controls these permissions and you can change them in Apple Health.',
      'Apple Health summaries, mood check-ins, notes, factors, and personal playbooks stay in a separate encrypted store on this device and are not uploaded through onTrack cloud sync.',
      'If you explicitly enable State of Mind sync, onTrack can read authorized State of Mind entries and save compatible labels, associations, and an overall pleasantness value to Apple Health. Private notes, custom labels, and playbooks are never written there.',
    ],
  },
  {
    title: 'Collaboration and sharing',
    paragraphs: [
      'When you share a trip, checklist, vehicle, or invite link, recipients you authorize can see the shared content needed to collaborate.',
      'Invitation landing pages on our hosting domain help friends open or install the app; they do not grant access to your private account data without the invite capability.',
    ],
  },
  {
    title: 'Third-party services',
    paragraphs: [
      'We use service providers to operate the app, including authentication and database hosting (Supabase), sign-in providers (Apple, Google), hosting (Expo), and optional analysis or search providers (for example OpenAI, USDA FoodData Central, TMDB, Amadeus) when those features are enabled.',
      'Those providers process data only to provide their services to us under their own terms and privacy policies.',
    ],
  },
  {
    title: 'Guest mode',
    paragraphs: [
      'Guest mode keeps data on the device until you sign in. If you create a new account, you can keep guest plans (upload them) or start fresh. If you sign into an existing account, you can merge device-only plans into your cloud account or use cloud data only — cloud stays the source of truth and is never silently replaced by guest data.',
    ],
  },
  {
    title: 'Retention and deletion',
    paragraphs: [
      'You can reset local data on a device from Profile. Signing out of a device removes account-owned local copies on that device; it does not delete your cloud account.',
      'Signed-in users can permanently delete their account from Profile. Account deletion removes your cloud account, synced app data, and app-owned cloud media associated with that account, subject to short-term backups and legal retention where required.',
      'Shared resources you own (such as a checklist or trip you host) are removed or become unavailable to collaborators when your account is deleted.',
    ],
  },
  {
    title: 'Children',
    paragraphs: [
      'onTrack is not directed to children under 13, and we do not knowingly collect personal information from children under 13.',
    ],
  },
  {
    title: 'Changes',
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
