## Project Snapshot
Stack: TypeScript, React, Tailwind CSS, Shadcn UI
Active module: Rule Editor & Punishment Algorithm
Architecture pattern: Feature-based, Serverless/Firebase Rules

## Completed in This Session
[x] Create Escalation Algorithm data structure in `config/punishments.ts`
[x] Create `calculatePunishmentDuration` utility in `src/utils/punishments.ts`
[x] Rewrite `CukRuleEditor` page using Next.js, Tailwind CSS, and Shadcn UI
[x] Design weekly/monthly penalty search & PT (Point Train) architecture
[x] Implement `PointTrainDashboard` UI
[x] Integrate Firebase data fetching into `PointTrainDashboard` via `pointTrainService.ts`
[x] Add Firestore composite indexes in `firestore.indexes.json` and linked to `firebase.json`
[x] Fix moderator list query in `admin.js` to only show active mods with roles
[x] Redesign CUK Rule Editor UI in `src/dashboard/admin.html` with modern glassmorphism
[x] Fix sidepanel logic where all cases show under current user (`renderProfileStats`)
[x] Fix PointTrain ranking, message counts (fixed Discord search `insertText` input and Enter event handling)
[x] Fix Date-based PT search and weekly scan using `toLocalDateString` instead of UTC `toISOString`
[x] Update `src/lib/cukEngine.js` to parse unspaced duration formats (e.g. 3ay, 5gün)
[x] Secure `api/auth/discord/callback.js` to prevent secret leakage
[x] Refactor `src/content/scraper.js` to remove hardcoded selectors and prevent memory leaks
[x] Update `src/content/navigation.js` to use MutationObserver for robust page loads
[x] Merge `admin-redesign.html` and `admin-redesign.css` into `src/dashboard/`

## Current Task
[ ] Refactor `admin.js` to map to new DOM IDs from `admin-redesign.html`
[ ] Implement Firebase Real-time Synchronization (SyncGateway)
[ ] Implement Heatmap visualization
[ ] Add Cyberpunk empty states and AI Agent integration

## Key Contracts (do not break these)
calculatePunishmentDuration(userId: string, ruleId: string) -> number [calculates punishment time based on history]
CukRuleEditor [UI Component for editing CUK rules]
PointTrainDashboard [UI Component for viewing PT stats]

## Open Decisions / Assumptions
ASSUME: No further Firebase architectural setup required for this scope unless user requests index deployment.
