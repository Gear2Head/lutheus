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

## Current Task
[ ] Awaiting new user instructions.

## Key Contracts (do not break these)
calculatePunishmentDuration(userId: string, ruleId: string) -> number [calculates punishment time based on history]
CukRuleEditor [UI Component for editing CUK rules]
PointTrainDashboard [UI Component for viewing PT stats]

## Open Decisions / Assumptions
ASSUME: No further Firebase architectural setup required for this scope unless user requests index deployment.
