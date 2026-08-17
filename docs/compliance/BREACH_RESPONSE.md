# Breach response

**Status:** DRAFT — REQUIRES LEGAL REVIEW  
**As of:** 17 August 2026  
Not a notification template. Counsel decides whether an event is a “breach” under applicable law.

## When to open this doc

Any event where a person other than the account holder may have seen, copied, or been sent:

- another user’s chat, email, financial account data, health/journal, precise location, or auth token
- a storage object from `profile-avatars` or other user buckets
- a Drive backup that was not theirs

## Engineering facts to gather (do not publish)

- UTC start/end
- systems (`travel_chat_messages`, Plaid items, avatars, EAS logs)
- whether the path was authenticated
- count of distinct `user_id` values possibly exposed (aggregate only)
- whether a vendor (OpenAI, Plaid, Teller, Google) also processed the payload

## Product facts already true in code

- Health/journal are not in cloud sync, so a Supabase-only incident does not automatically include those domains.
- Chat push defaults to generic lock-screen text (`notify_travel_chat_members`).
- Account delete + `purge_user_data` cannot recall Drive copies or collaborator screenshots.

## Notifications

Statutory clocks (GDPR 72 hours, some US state laws shorter/longer) are **REQUIRES LEGAL REVIEW**.  
User-facing copy and regulator filings are **REQUIRES LEGAL REVIEW**.
