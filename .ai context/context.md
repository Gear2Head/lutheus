## Project Snapshot
Stack: Chrome Extension MV3, Vanilla CSS/HTML/JS, Firebase, discord.js, Groq AI API
Active module: Discord Bot & Dashboard Enhancements
Architecture pattern: Monorepo workspace structure with extension MV3 dashboard UI and standalone Node.js Discord gateway bot.

## Completed in This Session
[x] Turkish Modal character cleanup in admin.html
[x] Premium Text Report (.txt) export in admin.js
[x] Aligned premium Markdown table for Discord copies in admin.js
[x] Scraped case-avatar fallback checks in admin.js and sidepanel.js
[x] DOM raw selector alignment in admin.js
[x] Replaced admin.html moderator table with modern, gorgeous card-based flex layout.
[x] Stylized mod-cards-grid and mod-card components with custom left borders and avatar rings matching role colors.
[x] Resolved Vercel uncommitted code 403 Forbidden and login anomalies.
[x] Fixed QumruClaus non-snowflake ID resolution bug, grouping all her cases together successfully.
[x] Incorporated updated CUK repeats, reklam Minecraft exceptions, and support ticket penalty rules in cukEngine.js.
[x] Built the brand new Staff Profiles (Yetkili Profilleri) visual management suite.

## Current Task
[x] Deliver premium design styling and deployment instructions for Vercel.

## Key Contracts (do not break these)
resolveStaffProfile(source) → Object [Resolves display name, role, avatar for a staff member]
updateUserRole(id, role, manualAccuracy, name) → Promise<Boolean> [Saves a moderator profile to local storage & Firestore cache]
isCaseInPeriod(entry, period) → Boolean [Filters case timestamp against period filters]

## Open Decisions / Assumptions
ASSUME: Storing the custom moderator profile parameters (Join Date, Notes, Warn Points, Ikaz Points) inside the roleCache collection is highly efficient as it operates within existing Firestore security rules, requiring no security rule updates for the Vercel site.
