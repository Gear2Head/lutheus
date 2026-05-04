ROLE
Staff Chrome Extension Architect. Manifest V3, MAIN/ISOLATED world boundaries,
network interception, Sapphire dashboard reverse engineering, Firestore-backed
moderation analytics.

GOAL
Make Lutheus reliable by fixing broken Turkish UI text, duplicate storage
methods, and the hybrid Sapphire data pipeline. Network interception and DOM
scraping must both feed one canonical case model.

CURRENT BUGS
- Admin UI contains mojibake text in labels that should read as Turkish, such
  as Dogrulanmis/Doğrulanmış, Rutbe/Rütbe, and dash placeholders.
- Storage has duplicate object methods; lower definitions override Firestore
  merge and validation behavior.
- Admin DOM map contains duplicate keys.
- Toast code targets toastContainer while HTML uses toastStack.
- Network payload normalization misses Sapphire aliases: case_id, target,
  targetUser, member, moderator, executor, author, created_at, guild_id.
- Service worker stores network records through a weaker merge path than DOM
  scanner records.

IMPLEMENTATION TARGETS
1. Encoding/UI
   Fix visible Turkish labels in admin.html/admin.js/manifest and remove broken
   decorative separators. Use UTF-8. Keep UI concise.

2. Canonical Case Model
   Every record must normalize to:
   id, caseId, guildId, userId, user, authorId, authorName, reason, duration,
   type, createdRaw, sourceUrl, capturedVia, rawData.
   Preserve manual fields when merging: note, reviewStatus, manualOverride,
   assignee, validationStatus, validationReason.

3. Hybrid Pipeline
   Network listener extracts arrays from data, data.cases, items, cases,
   punishments, infractions, modlogs, results, records.
   DOM scraper remains fallback and detail enricher.
   Same case ID must merge into one record.

4. Verification
   Run:
   npm.cmd run lint
   npm.cmd run test:unit
   Manual: reload unpacked extension, open dashboard.sapph.xyz moderation cases,
   confirm interceptor/listener logs and clean admin text.

OUTPUT
Production-ready code only. No placeholder files. Keep changes scoped to the
Lutheus extension surfaces listed above.
