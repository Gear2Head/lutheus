# Lutheus Project Analysis & Bug Report
**Date:** 2026-05-04
**Status:** Alpha/Stabilization Phase

## 🔴 CRITICAL BUGS (Resolved)

### 1. Pointtrain Performance & Resource Leak [FIXED]
- **Resolution:** Refactored `runPointtrainScan` to reuse existing Discord tabs via `findDiscordTab` and optimized the scan loop.
- **File:** `src/background/service_worker.js`

### 2. Admin UI Null Pointer Risks [FIXED]
- **Resolution:** Implemented a `Proxy`-based `safeDOM` layer in `admin.js` that provides dummy elements for missing IDs, preventing script crashes.
- **File:** `src/dashboard/admin.js`

### 3. Deduplication Key Inconsistency [FIXED]
- **Resolution:** Normalized `createdAt` to a numeric timestamp in `network_listener.js` before key generation.
- **File:** `src/content/network_listener.js`

---

## 🟡 MEDIUM ISSUES (UX & Stability)

### 4. Volatile Deduplication Cache
- **Issue:** `seenIds` in `network_listener.js` is an in-memory `Set`.
- **Impact:** Refreshing the Sapphire Dashboard tab clears this cache, causing the interceptor to re-send all visible punishments to the service worker, triggering redundant storage writes.
- **File:** `src/content/network_listener.js` (line 10)

### 5. CUK Editor State Synchronization
- **Issue:** `commitRuleEditor` handles category name changes but doesn't handle collisions effectively if two categories are named similarly during editing.
- **Impact:** Potential loss of rule configurations when renaming categories.
- **File:** `src/dashboard/admin.js` (line 870)

### 6. Storage Scalability
- **Issue:** The extension stores all cases in a single `cases` array in `chrome.storage.local`.
- **Impact:** As the database grows (10,000+ records), serialization/deserialization will become a bottleneck, leading to "Extension is slowing down" warnings.
- **File:** `src/background/service_worker.js` (line 287)

---

## 🟢 LOW ISSUES (Refactoring & Polish)

### 7. Redundant Avatar Fallbacks
- **Issue:** `bindAvatarFallbacks()` is called repeatedly in every render loop (`renderTable`, `renderManagement`).
- **Impact:** Minor performance hit. Should be handled via a single delegated error listener on the container.
- **File:** `src/dashboard/admin.js` (line 539)

### 8. Message Listener Error Noise
- **Issue:** `chrome.runtime.sendMessage` in `service_worker.js` uses `.catch?.(() => undefined)`.
- **Impact:** While it prevents crashes, it masks real communication issues between the dashboard and service worker during debug sessions.
- **File:** `src/background/service_worker.js` (line 112)

---

## 📝 RECOMMENDATIONS
1. **Refactor Pointtrain:** Use a single persistent tab for Discord queries and implement a batching mechanism.
2. **Harden DOM Registry:** Update the `DOM` object in `admin.js` to use a proxy or a helper that returns a dummy element if the ID is missing to prevent `textContent` of null errors.
3. **Normalize Dates:** Ensure all `createdAt` values are converted to Unix timestamps in `network_listener.js` before generating the deduplication key.
4. **Storage Migration:** Consider moving from `chrome.storage.local` to `IndexedDB` for the punishment database to handle large datasets more efficiently.
