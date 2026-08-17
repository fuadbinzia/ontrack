# AI governance

**Status:** DRAFT — REQUIRES LEGAL REVIEW  
**As of:** 17 August 2026

## TECHNICALLY VERIFIED

- Model keys are server-only. Client never embeds `OPENAI_API_KEY`.
- Paid routes use JWT + per-bucket in-process rate limits (`api-gate.ts`, `api-rate-limit.ts`).
- Shared OpenAI helper sets `store: false` on Responses/Images where `src/services/ai/vision-transport.ts` is used. Meal photos strip EXIF / use `store:false` on generated images (food vision path).
- `safety_identifier` is `sha256(secret:userId).slice(0,32)` (`openai-safety-id.ts`), wired on finance coach, rewards import, E-ZPass parse, health suggestions, and travel translator.
- Product copy: AI features are informational, not professional advice (`terms-of-use-content.ts`).
- Usage analytics is first-party screen-time only and default **off** for new installs. Not an ad SDK.

## PARTIALLY IMPLEMENTED

- No retained prompt/response store in Supabase for model output. Some routes may still log errors with truncated bodies — review `reportOperationalFailure` call sites before claiming zero logging.
- No human review queue for model output. UGC (chat) has a denylist, not an LLM moderator.
- EU AI Act role (provider vs deployer) and risk class: **REQUIRES LEGAL REVIEW**. The app uses general-purpose models for nutrition, travel, finance education, and mood suggestions — not a medical device in code, but labels can still be overclaimed.

## Residuals

- In-process rate limits are per instance.
- Hashed safety ids are stable for a given secret; rotating `ANALYTICS_INSTALL_HASH_SECRET` / `OPENAI_SAFETY_HASH_SECRET` changes the vendor-visible token.
