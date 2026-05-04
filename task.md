# Lutheus Implementation Checklist

## Fix Now
- Clean mojibake in admin UI, manifest description, comments that render in the app, and prompt docs.
- Remove duplicate `Storage` object methods so validated `saveCases`, merged `getCases`, and Firestore-aware `updateCases` are the only active implementations.
- Fix `Toast.init()` to use `toastStack`.
- Remove duplicate DOM keys in `src/dashboard/admin.js`.
- Expand `src/content/network_listener.js` aliases for Sapphire `/api/v2/guilds/...` payloads.
- Refine `src/content/interceptor.js` endpoint filters to API/case/modlog routes and exclude static assets.
- Make `src/background/service_worker.js` merge intercepted network records with DOM records using one canonical case shape.
- Keep DOM scraper as fallback and detail enrichment path.

## Canonical Case Shape
`id`, `caseId`, `guildId`, `userId`, `user`, `authorId`, `authorName`, `reason`, `duration`, `type`, `createdRaw`, `sourceUrl`, `capturedVia`, `rawData`.

## Preserve On Merge
`note`, `reviewStatus`, `manualOverride`, `assignee`, `validationStatus`, `validationReason`, useful avatar fields.

## Acceptance
- `npm.cmd run lint` passes.
- `npm.cmd run test:unit` passes.
- Admin panel text is readable Turkish.
- Network and DOM records with the same case ID do not duplicate.
- Unknown moderators are not collapsed into one fake staff row unless the source truly has no usable identity.
