# Data retention policy

**Status:** DRAFT — REQUIRES LEGAL REVIEW  
**As of:** 17 August 2026

| Data | Retention in product | Delete path |
|---|---|---|
| Signed-in cloud rows | Until account delete or user edit | Profile → Delete Account → `purge_user_data` |
| Auth user | Until delete | Supabase Auth admin delete after purge |
| Storage objects owned by user | Until delete | Purge + bucket policies |
| Guest local stores | Until Reset Data / uninstall | `resetAll` / OS app delete |
| Health / journal | Until user deletes entries or resets / uninstalls | Local only; optional export |
| `content_reports` | Until purge of reporter or operator cleanup | **REQUIRES BUSINESS DECISION** for operator retention |
| `user_blocks` | Until unblock or purge | Profile → Blocked Users |
| Push tokens | Until device unregister or purge | Chat device table |
| Google Drive backup files | Controlled by the user’s Drive | User must delete in Drive; disconnect does not delete the file |
| OpenAI / other model logs | Vendor-side; app requests `store:false` on shared helper | Vendor retention **UNKNOWN — INSUFFICIENT EVIDENCE** |
| Usage analytics rollups | Only if toggle on | Toggle off stops new collection; historical cloud rows **REQUIRES BUSINESS DECISION** |

Server backups / PITR: **REQUIRES EXTERNAL CONFIGURATION** (Supabase dashboard). Not claimed here.

Legal holds and export-for-litigation: **REQUIRES LEGAL REVIEW**.
