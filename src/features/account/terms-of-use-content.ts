import { ONTRACK_SUPPORT_EMAIL } from '@/constants/legal';

import type { LegalSection } from './legal-document-screen';

export const TERMS_OF_USE_INTRO =
  'These Terms of Use govern your use of the onTrack mobile application, its optional add-ons, and related websites (together, the “Service”). By using the Service, you agree to these terms and acknowledge the Privacy Policy.';

export const TERMS_OF_USE_SECTIONS: readonly LegalSection[] = [
  {
    title: 'The Service',
    paragraphs: [
      'onTrack helps you organize daily plans and optional add-ons such as food tracking and community features, fitness and health summaries, finance tools, plant care, travel planning and chat, checklists, vehicles, event discovery, games, and a vision board.',
      'Features may change over time. Some capabilities require an internet connection, a signed-in account, or third-party services.',
      'Add-ons can be enabled or disabled without deleting their saved data. You are responsible for maintaining your own copies of content that is important to you. Profile → Backup can download a copy or save one to Google Drive that you control.',
    ],
  },
  {
    title: 'Accounts and Guest Use',
    paragraphs: [
      'You must be at least 13 years old to use onTrack. If you are under 18, you may use the Service only with a parent or guardian’s permission where required by law.',
      'You may use guest mode on a single device or sign in with Apple or Google. You are responsible for activity under your account and for keeping your sign-in provider secure.',
      'Guest data is tied to that device unless you choose to upload or merge it into a signed-in account. Do not rely on guest mode as your only backup.',
      'You may delete your account from Profile. Deletion is permanent and removes cloud account data as described in the Privacy Policy.',
    ],
  },
  {
    title: 'Your Content',
    paragraphs: [
      'You retain ownership of content you create. You grant us a limited, worldwide, non-exclusive license to host, copy, process, transmit, and display that content only as needed to operate, secure, support, and improve the Service features you request, including sync, AI processing, exports, and collaboration you enable.',
      'You represent that you have the rights and permissions needed for content you submit, including photos, documents, messages, recipes, financial statements, and information about other people.',
      'Do not upload unlawful, infringing, deceptive, harassing, abusive, dangerous, or privacy-invasive content. We may remove content or restrict accounts when reasonably necessary to protect users, comply with law, or enforce these terms.',
    ],
  },
  {
    title: 'Collaboration and Community Features',
    paragraphs: [
      'When you share a trip, checklist, vehicle, E-ZPass ledger, community post, chat message, or invite, the people or audience you select can view and may act on the shared content. Choose recipients carefully and do not share another person’s personal, health, location, or financial information without permission.',
      'Collaborators may change or delete shared content when their role allows it. Copies that another person exports, screenshots, or sends outside onTrack may remain after you remove the original or close your account.',
      'You may report a person, message, or post from inside the app, and you may block someone so their messages no longer appear for you. Blocking also removes an existing friendship. onTrack does not promise to monitor every post, message, or collaboration in advance.',
      'We have zero tolerance for objectionable content, including harassment, threats, hate, sexual exploitation, content involving minors, illegal activity, scams, doxxing, and impersonation. We may remove content, restrict features, or terminate accounts that violate these terms. Repeated or severe abuse can result in a permanent ban.',
    ],
  },
  {
    title: 'AI and Informational Tools',
    paragraphs: [
      'Meal, ingredient, plant, recipe, travel, E-ZPass, finance-coach, mood, workout, and similar AI or reference features may be incomplete, inaccurate, or unsuitable. Review generated or imported content before relying on it.',
      'These tools provide estimates and general information only. They are not medical, dietary, mental-health, veterinary, financial, tax, investment, legal, horticultural, or other professional advice and do not create a professional or fiduciary relationship.',
      'Always use your own judgment and consult a qualified professional when needed. Exercise and nutrition features are for general education; stop any activity that causes pain or concern. Health and mood tools are not for diagnosis, treatment, crisis response, or emergency services.',
    ],
  },
  {
    title: 'Finance Tools and Linked Accounts',
    paragraphs: [
      'onTrack is not a bank, broker, investment adviser, credit bureau, tax preparer, payment processor, or money transmitter. Finance dashboards, forecasts, categories, rates, credit-score tracking, savings suggestions, and coaching are educational organizational tools and may be delayed, estimated, or incorrect.',
      'Plaid or Teller connections provide read-only account data within the scopes you authorize. onTrack does not initiate transfers, payments, trades, credit inquiries, or tax filings. You remain responsible for checking records against official statements, protecting financial documents, and making all financial and tax decisions.',
      'Tax tools prepare summaries and files for export or filing elsewhere; they do not determine eligibility, calculate a complete return, or e-file. Credit-provider and filing links open third-party sites whose terms, fees, and practices apply.',
      'E-ZPass imports can misread dates, descriptions, amounts, or duplicate activity. Verify imports against the official statement. onTrack is not affiliated with E-ZPass or any toll agency and does not pay tolls, dispute charges, or manage toll accounts.',
    ],
  },
  {
    title: 'Travel, Events, and Third Parties',
    paragraphs: [
      'Flight, stay, event, sports, movie, weather, map, exchange-rate, and similar results may come from third-party providers and can be delayed, incomplete, test, or limited data depending on configuration. Prices, schedules, locations, availability, and alerts are not guaranteed.',
      'Bookings and payments completed on third-party sites are between you and that provider. onTrack does not process travel card payments inside the app for those checkouts.',
      'Connected services such as Google Calendar, Plaid, Teller, and StraiAway have separate terms and privacy practices. You authorize onTrack to access and act on the data scopes you select. Disconnecting from onTrack does not necessarily delete information retained independently by that provider.',
      'Voice-assistant requests and spoken responses may be processed by Apple or Google and may be audible to people nearby. Review sensitive checklist content before using voice read-out features.',
    ],
  },
  {
    title: 'Acceptable Use',
    paragraphs: [
      'Do not misuse the Service, attempt unauthorized access, disrupt or overload it, bypass rate limits or security controls, scrape it unreasonably, introduce malware, reverse engineer it except where allowed by law, impersonate others, send spam, or use it to violate anyone’s rights or applicable law.',
      'Do not use AI, community, collaboration, invitation, financial-import, or sharing features to expose secrets, credentials, payment-card data, private health information, or another person’s personal information without authorization.',
    ],
  },
  {
    title: 'Third-Party Services and Links',
    paragraphs: [
      'Third-party services, websites, app stores, operating-system features, and data providers are not controlled by onTrack. Their availability, content, security, fees, terms, and privacy practices are their responsibility.',
      'Your use of a connected provider may require a separate account and acceptance of that provider’s terms. We may change, suspend, or remove an integration if the provider changes or access is no longer available.',
    ],
  },
  {
    title: 'Third-Party Names, Logos, and Trademarks',
    paragraphs: [
      'Company, product, service, team, league, event, venue, financial-institution, toll-authority, and other third-party names, logos, artwork, and trademarks displayed in the Service belong to their respective owners. They are used only to identify or visually represent referenced third-party content, data, or services.',
      'Unless we expressly state otherwise, displaying a third party’s name, logo, or trademark does not mean that onTrack is affiliated with, sponsored by, endorsed by, or an official partner of that third party.',
      `If you are a rights holder and believe a name, logo, trademark, or other brand material should be changed or removed, contact ${ONTRACK_SUPPORT_EMAIL}. We will review the request and, where appropriate, remove or replace the material.`,
    ],
  },
  {
    title: 'Disclaimers',
    paragraphs: [
      'THE SERVICE IS PROVIDED “AS IS” AND “AS AVAILABLE” WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT, TO THE MAXIMUM EXTENT PERMITTED BY LAW.',
    ],
  },
  {
    title: 'Limitation of Liability',
    paragraphs: [
      'TO THE MAXIMUM EXTENT PERMITTED BY LAW, ONTRACK AND ITS SUPPLIERS ARE NOT LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF DATA, PROFITS, OR GOODWILL, ARISING FROM YOUR USE OF THE SERVICE.',
    ],
  },
  {
    title: 'Termination',
    paragraphs: [
      'You may stop using the Service at any time and may delete your account. We may suspend or terminate access, remove content, or limit features if you violate these terms, create risk or legal exposure, misuse third-party services, or if we discontinue the Service.',
    ],
  },
  {
    title: 'Changes to These Terms',
    paragraphs: [
      'We may update these Terms of Use. The “Last updated” date will change when we do. Continued use after an update means you accept the revised terms.',
    ],
  },
  {
    title: 'Contact',
    paragraphs: [`Questions about these terms: ${ONTRACK_SUPPORT_EMAIL}.`],
  },
];
