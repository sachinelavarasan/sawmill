# Web changes of 21 Nov 2026: bring them to the mobile app

**Audience:** whoever brings these changes to `mobile/`, the Expo / React Native app.

**Starting point:** all of this shipped in the web app (`web/`) on 21 Nov 2026. This file covers what changed, where it lives in the web code, what the backend now provides, and what to build on mobile. Each section ends with checks that tell you the mobile version behaves like the web one.

**Already done for mobile:**
- **Backend:** every backend change is already live. Mobile calls the same API, so nothing new is needed there.
- **Labels:** every new text label is already in `packages/shared/src/i18n.ts`, which mobile also uses, in English and Tamil. Reuse the key names given below; don't write new strings.

**Contents**

1. [Background](#1-background)
2. [Backend changes (already live)](#2-backend-changes-already-live)
3. [Simple view (per-user setting)](#3-simple-view-per-user-setting)
4. [Settings: "My preferences"](#4-settings-my-preferences)
5. [Simple home](#5-simple-home)
6. [Navigation in the simple view](#6-navigation-in-the-simple-view)
7. [Load In](#7-load-in)
8. [Measure Logs (log measurement)](#8-measure-logs-log-measurement)
9. [Load Out](#9-load-out)
10. [Sawing (production)](#10-sawing-production)
11. [Stock (simple view)](#11-stock-simple-view)
12. [Moving between screens with a way back](#12-moving-between-screens-with-a-way-back)
13. [Feedback and safety on every action](#13-feedback-and-safety-on-every-action)
14. [Web-only changes (do not copy)](#14-web-only-changes-do-not-copy)
15. [New i18n keys](#15-new-i18n-keys)
16. [Suggested order of work](#16-suggested-order-of-work)

---

## 1. Background

Most people at the mill aren't comfortable with computers. The full app showed too many options at once, so the web app now opens in a **Simple view** by default:
- **Kept:** only the daily work (Load In, Measure Logs, Sawing, Load Out, Stock, Approve, money due), with big buttons and few words.
- **Hidden, not removed:** everything else is turned back on with one switch in Settings.

Staff also work the way they do with a hand calculator and a notebook. Measuring therefore uses a **calculator layout**: a keypad, the working shown with the typed numbers, and the list of entries beside it.

---

## 2. Backend changes (already live)

| What | Detail | Where |
|---|---|---|
| **`users.ui_mode`** column | `'simple' \| 'full'`, default `'simple'` (migration `0008_ui_mode.sql`). It's returned in the profile by `GET /auth/me` and at login. | `backend/src/db/schema.ts`, `auth.service.ts` |
| **`PATCH /auth/me/preferences`** | Body `{ uiMode?: 'simple'\|'full', preferredLanguage?: 'en'\|'ta', tourCompleted?: boolean }`. Any signed-in user can call it, for their own row only. It returns the updated profile. | `backend/src/auth/auth.controller.ts` |
| **`GET /imports/lorries`** | Every lorry seen on loads in **and** out, newest first: `{ items: [{ lorryNumber, driverName, driverMobile, lorryOwnerName, lorryOwnerMobile, trips, lastAt }] }`. Duplicates are merged ignoring spaces and case. | `backend/src/imports/imports.service.ts` |
| **`GET /stock`**: `pendingFinished` | Finished sizes from Sawing entries that are saved but not approved (DRAFT/SUBMITTED). Each row has `runId` and `runCode`. **These are not stock yet**; they become stock when the owner approves. | `backend/src/stock/stock.service.ts` |
| **`GET /stock`**: `pendingRaw` | Loads in that are measured but not approved (DRAFT/SUBMITTED, `totalCft > 0`): `{ importLoadId, importCode, woodType, arrivalAt, status, logs, cft }`. | same |
| **Sawing on an unapproved load in** | `POST /production` now accepts a load in that isn't approved yet. While it's unapproved, "raw CFT used" is checked against its **measured** CFT. **Approving the Sawing is refused** until the load in is approved: `409 "Approve load in IMP-… first — this sawing uses its logs"`. | `backend/src/production/production.service.ts` |
| **Duplicate unloading guard** | `POST /imports/:id/unloading` with the same vehicle starting within the same minute returns `409 "This unloading is already recorded"`. | `imports.service.ts` |

Nothing else in the API changed. Stock is still posted only when the owner approves.

---

## 3. Simple view (per-user setting)

**Web:**
- The setting is `user.uiMode` from `/auth/me`, cached in `localStorage` (`timbertrail.uiMode`) so a reload doesn't flash the full view.
- `useAuth()` exposes `simple: boolean` and `setUiMode(mode)`. The update is optimistic, followed by `PATCH /auth/me/preferences`.
- Code: `web/src/auth.tsx`. `web/src/index.css` also sets slightly larger text and touch targets when `html[data-simple]` is on.

**Mobile:**
- Read `uiMode` from the profile in `lib/session.tsx`. Add `simple` and `setUiMode` there, or in `services/preferences`, with the same optimistic update and PATCH.
- Cache it per user in AsyncStorage (`services/preferences/preference.storage.ts`) so the app opens in the right view offline.
- **Default is simple** for every user, including the owner.

**Language:** web now saves the chosen language on the user too (`PATCH /auth/me/preferences { preferredLanguage }`), and the server's value wins when the app opens. Do the same on mobile, so a language picked on the phone follows the user to the web and back.

**Checks:**
- [ ] A new or existing user opens in Simple view.
- [ ] Switching to "All features" on the phone shows the full app on the web after a reload, and the other way round.
- [ ] Changing language on one device shows on the other after sign-in.

---

## 4. Settings: "My preferences"

**Web** (`web/src/pages/Settings.tsx`):
- **Visibility:** Settings is open to **everyone**. Before, only the owner could open it; the mill settings inside it are still owner-only.
- **"My preferences" card** at the top, saved instantly:
  - **Screen view:** two big choice cards, **Simple** ("Only the daily work, with big buttons.") and **All features** ("Reports, accounts, users, history and every option."). Keys: `viewMode`, `simpleView`, `simpleViewSub`, `fullView`, `fullViewSub`.
  - **My language:** English / தமிழ்.
- **Where the switch lives:** the view switch is **only in Settings**, not in the sidebar or the profile menu.

**Mobile:** put the same two choice cards at the top of `app/(app)/preferences.tsx` (or under More › Settings), visible to everyone. `more/settings.tsx` stays the owner's mill settings.

**Checks:**
- [ ] The accountant can reach the view switch.
- [ ] The switch applies at once, with no Save button.

---

## 5. Simple home

**Web:** `web/src/pages/SimpleHome.tsx`, shown on `/` when `simple`. It reuses `/dashboard/owner` or `/dashboard/accountant`.

1. **Greeting band** with three numbers: **Loads in today**, **Loads out today**, and **Total stock CFT** (owner only).
2. **"What do you want to do?"**: big icon tiles. Owner: Load In · Measure Logs · Sawing · Load Out · Stock · Approve (with count badge) · Money Due. Accountant: the first five.
   - Labels are medium weight, not bold; icons are about 26px with a 1.75 stroke. A first version was too bold.
   - Component: `web/src/components/quick-actions.tsx` (`simple` prop).
3. **"Needs your action"**: up to 3 plain sentences, each with an **Open** button:
   - "N entries waiting for your approval" (owner).
   - "N entries sent back — please correct" (accountant).
   - "N loads still to measure". With exactly one load, it opens that load's measuring screen directly.

Keys: `whatToDo`, `needsAction`, `allDone`, `loadsInToday`, `loadsOutToday`, `nWaitingApproval`, `rejectedToFix`, `loadsToMeasure`, `simpleLoadIn`, `simpleMeasure`, `simpleCut`, `simpleLoadOut`, `simpleStock`, `simpleApprove`, `simpleDues`.

**Mobile:** the Home tab (`app/(app)/(tabs)/index.tsx`) shows this layout when `simple`. Use a 2-column tile grid on phones.

**Checks:**
- [ ] The owner sees 7 tiles and the accountant 5.
- [ ] The Approve tile shows the pending count.
- [ ] "All done" shows when nothing is waiting.

---

## 6. Navigation in the simple view

**Web** (`web/src/nav.ts`, `Layout.tsx`):
- **One flat list,** in the order the work is done, with plain names: Home · Load In · Measure Logs · Sawing · Load Out · Stock (Raw, Finished) · Approve · Clients · Suppliers, plus Settings.
- **Hidden in Simple view:** Reports, Accounts, Users, Change History, My Entries, Stock adjustments and movements, the global search and the "+ Create" menu.
- **Links still work:** a hidden page opened by link still opens, because permissions decide access, not the view.

**Mobile** (`lib/nav.ts`, `components/TabBar.tsx`, `more/index.tsx`):
- In Simple view, hide the same items from More.
- Consider the bottom bar **Home · Load In · Measure · Load Out · More**, with Sawing and Stock in More or as Home tiles. The web order is the reference.
- Use the plain names (`simple*` keys) in Simple view.

**Checks:**
- [ ] Nothing in Simple view leads to Reports, Accounts or Users.
- [ ] A deep link to one of them still opens if the user may see it.

---

## 7. Load In

### 7.1 Simple form (web: `web/src/pages/Imports.tsx` → `ImportFields`, `NewImportPage`)
- **Shown up front:** only **Lorry number** (large), **Wood type**, **Arrival date & time**, and **Supplier** (owner).
- **Folded away:** everything else (wood category, origin, driver, owner, notes, unloading) sits under **"More fields (optional)"**.
- **One big button:** **"Save & start measuring"** (`startMeasuring`) goes straight to measuring. "Save for later" is the quiet second option.
- **Field problems:** if a field inside a folded section fails the form check, the section opens itself and shows the message (web `Fold` in `components/page.tsx`). Mobile has no browser form checks, but the rule is the same: **never hide an error inside a closed section**.

### 7.2 Lorry number is a pick list (web: `web/src/components/lorry-picker.tsx`)
- **The list:** a searchable list from `GET /imports/lorries`, newest first, with the last driver shown beside each lorry. A **new number can be added** by typing it ("Add …"); it's upper-cased with single spaces and must be 4–20 characters.
- **Auto-fill:** picking a known lorry fills **driver name and mobile, owner name and mobile**, but only into fields that are still empty.
- **Load Out too:** the same picker is used on the New Load Out form.
- **Mobile:** replace the lorry text field in `components/ImportForm.tsx` and `ExportForm.tsx` with a searchable sheet list (there's already a bottom-sheet pattern) plus "Add new".

### 7.3 Started from Sawing
New Load In accepts `?wood=` (pre-fills the wood) and `?back=/production/new…`. After "Save & start measuring", the measuring page shows a **"Back to sawing"** button that returns to New Sawing with this load chosen. See §12.

**Checks:**
- [ ] Picking a known lorry fills the 4 people fields.
- [ ] Typing a new number adds it.
- [ ] A double tap on Save creates one load, not two (§13).

---

## 8. Measure Logs (log measurement)

**Web:** the shared component is `web/src/components/calc-pad.tsx`; it's used in `web/src/pages/ImportDetail.tsx` → `LogsSection`.

Mobile already has a keypad measuring screen (`app/(app)/imports/[id]/measure.tsx`) with a good idea: **the length is kept from the last log**. Keep that, and add the following to match the web.

| Web behaviour | Detail |
|---|---|
| **Length first, girth second** | The boxes are **Length (ft)** then **Girth (in)**. The cursor starts on Length, and after a save it returns to Length. Mobile keeps the length, so after a save focus can go to Girth. Either way, **Length is shown first**. |
| **Working shown with the numbers** | `12 × 48 × 48 ÷ 2304 = 12.000 CFT` (length × girth × girth ÷ 2304). Before typing, it shows the formula in words. Key: `cftFormulaLabel`. |
| **Keypad** | 7 8 9 ⌫ / 4 5 6 C / 1 2 3 = / 0 . "Clear all". **=** reads **Next →** until the last box, then **= Save**. Limits: max 2 decimals, max 6 digits. |
| **Key colours** | Number keys are white with a visible border. Function keys (⌫ C Clear all Next) are **soft orange with orange text**. **= Save** is solid brand orange when ready. When it can't save yet, it shows a **dashed orange outline**, not a grey block. Every key must be clearly visible on a light background. |
| **Entries beside the keypad** | The full list of saved logs, **newest first**, with total and count. Each row reads like `#12  8 ft × 9 in   5.625` and has **Edit** and **Delete**. On a phone, put the list below the keypad, or in a collapsible sheet that peeks above the keypad. Staff want to see the entries while they type. |
| **Edit from the list** | Loads the log into the keypad. An orange bar reads "Edit · Log #3 — Cancel". **=** saves the correction (PATCH). The "total after this log" line subtracts the old value. |
| **Measuring from the list** | Opening a load from **Measure Logs** keeps you in Measure Logs: the back button and the highlighted menu item both say Measure Logs, not Load In (§12). |
| **Measure Logs list (simple)** | Big cards, one per open lorry: lorry number, wood, logs so far, CFT so far, and a **Measure now** button. Key: `measureNow`. |
| **Record page order (simple)** | Measuring first, then **Send to owner**, then the purchase section (owner), then "More details" (details, unloading) folded away. The figures strip at the top is hidden, because the keypad shows them. |

**Checks:**
- [ ] Typing 12, Next, 48, = saves **length 12 ft, girth 48 in = 12.000 CFT**.
- [ ] Edit → change → = updates the log.
- [ ] Delete asks for confirmation, then removes the log.
- [ ] A fast double = saves one log, not two (§13).

---

## 9. Load Out

**Web:** `web/src/pages/ExportDetail.tsx` → `LinesSection` (calculator mode) and `web/src/pages/Exports.tsx` → `ExportFields`.

### 9.1 New Load Out form
- **Wood type is a pick list** of woods with sawn pieces in stock. Each option has a second line: `10 sizes · 739 pcs · 437.639 CFT` (key `stockSummaryLine`). The hint reads `exportWoodHint` ("Only woods with sawn pieces in stock are listed."), or `noSawnStock` when there are none.
- **"Take pieces from load (optional)"** (`defaultLoad`, `defaultLoadHint`):
  - It lists only loads of the chosen wood, each as `IMP-2026-0025 · Neem` over `5 sizes · 237 pcs · 129.056 CFT`.
  - After a load is picked, an **"In this load"** box (`inThisLoad`) shows its sizes as chips (`1 × 8 in × 10 ft · 61`), up to 8, then `+N more` (`moreSizes`).
  - Changing the wood clears a load that doesn't match.
- **`?wood=`** pre-fills the wood. It's used by the Stock "Load out" button (§11).

### 9.2 The calculator on the Load Out record
- **Fields:** Thickness (in) × Width (in) × Length (ft) × Pieces. The working is `T × W × L × pieces ÷ 144`. Pieces are whole numbers, so the "." key is disabled there.
- **Load filter row:** chips above the size chips, **"All loads · 17"** then each load with its number of sizes. It **starts on the load chosen for this Load Out**, so that load's sizes and pieces are seen together.
- **Size chips:** one chip per size with the total pieces (for the chosen load, or for all loads). Sizes waiting approval have a **dashed border** with a "Waiting approval" note. Tapping a chip fills the size and moves the cursor to **Pieces**.
- **"From load" row inside the calculator display** (`fromLoad`). This replaced a separate "Source load" box, which confused people:
  - It lists **only the loads that hold the typed size**, e.g. `IMP-2026-0015 · 12` and `IMP-2026-0020 · 110`. The chosen one is highlighted, and a different one can be tapped.
  - **Auto-choice:** the load shown in the filter (if it holds enough), else the current load, else the **oldest load with enough pieces**, else the one with the most. Typing more pieces than the current load holds switches to one that has enough.
  - **Size not in stock:** "This size is not in stock." (`sizeNotInStock`) plus an **Add sawing** button (`addSawing`), see §12.
  - **No size typed yet:** `loadAutoHint`.
- **Too many pieces:** if more pieces are typed than the load holds, "Only N pieces of this size are in stock." (`moreThanInStock`). The count includes pieces waiting approval.
- **"Not in stock? Add sawing"** (`notInStockAddSawing`): opens **New Sawing** with the wood and the typed size and pieces carried over, plus the way back (§12).
- **Entries list** beside the keypad: newest first, `1 × 8 in × 8 ft × 78`, with the source load underneath. Rows needing more than is in stock turn red. Edit and Delete work as in §8.

### 9.3 Record page order (simple)
Lines first, then **Send to owner**, then the sale section (owner), then "More details" folded away. The stat grid at the top is hidden.

**Checks:**
- [ ] A load out with a chosen load opens on that load's sizes.
- [ ] Typing 50 pieces of a size that has 12 in the oldest load and 110 in another switches to the 110 load.
- [ ] An unknown size shows "not in stock" with Add sawing.

---

## 10. Sawing (production)

**Web:** `web/src/pages/ProductionDetail.tsx`, `web/src/pages/Production.tsx` → `NewProductionPage`.

- **New Sawing, raw wood:**
  - The load list shows **approved raw stock first**, then **measured loads waiting approval**, marked "Waiting approval" (from `pendingRaw`). Choosing a waiting load shows `pendingRawHint`.
  - **"Not in stock? Load in new logs"** (`loadInNewLogs`) opens New Load In with the wood carried over (§12).
  - `?wood=` limits the list to that wood and pre-selects the only load if there's just one.
- **Record page (simple):**
  - **Top strip:** three plain numbers, **Raw CFT used**, **Finished CFT** and **Waste** (with recovery %). **Raw CFT used is typed right there** with a Save button, because submitting needs it and it used to be hidden under More details.
  - **Calculator for sizes:** as in §9, with T, W, L and pieces. After a save, thickness and width are kept and the cursor goes to **Length**. The entries list is beside the keypad.
  - **Order:** sizes, then Send to owner, then "More details".
- **Started from a Load Out:** the record shows a bar, "Sawing for load out EXP-…" (`sawingForLoadOut`), with a **"Back to load out EXP-…"** button (`backToLoadOut`). The size from the load out is already in the keypad, with the cursor on Pieces.
- **"Stock on save":** sizes saved in a Sawing entry appear straight away as **"Waiting approval"** stock (from `pendingFinished`) on Load Out and on Stock. They can be loaded out now. **Real stock still changes only on approval**, and the owner must approve the Sawing before the Load Out.

**Checks:**
- [ ] A Sawing entry on a waiting load in can be created and submitted.
- [ ] Approving it before the load in returns the "Approve load in … first" message.
- [ ] Its sizes show as "Waiting approval" on Load Out.

---

## 11. Stock (simple view)

**Web:** `web/src/pages/Stock.tsx` → `SimpleStock`, `RawCard`, `SizeCard`.

- **Two big switch cards** instead of tabs:
  - **Logs (raw):** `2,705.737 CFT`, `8 loads` (`stockLogs`, `loadsCount`).
  - **Sawn pieces:** `8,324 pieces`, `4,712.693 CFT` (`stockSawn`).
- **One wood filter:** chips "All · Neem · Pine · Sal · Teak" with counts. A search box appears only when there are more than 12 items.
- **Logs view:** one card per load with wood left, newest first.
  - Wood name, load code and log count.
  - **CFT left** in large type (`cftLeft`), with a fill bar and "of N received" (`ofReceived`).
  - A full-width **Saw this** button (`sawThis`) that opens New Sawing with that load chosen.
  - Waiting-approval loads (`pendingRaw`) appear in the same list with a **dashed border** and a "Waiting approval" tag.
- **Sawn view:** a heading per wood with its pieces and CFT, then a card per size.
  - The size, the **pieces** in large type, and the CFT.
  - **Tapping the card** shows which loads the pieces came from (`fromLoads`).
  - A **Load out** button (`loadOutThis`) opens New Load Out with the wood filled in.
  - Waiting sizes (`pendingFinished`) appear in the same list, dashed.
- **No tables and no paging.**
- **Empty lists:** "No logs in stock" with a Load In button (`noLogsInStock`), or "Nothing sawn yet" with a Sawing button (`nothingSawn`).

**Mobile:** `app/(app)/(tabs)/inventory.tsx` shows this layout in Simple view. The full view keeps today's tabs and tables, adjustments and movements.

---

## 12. Moving between screens with a way back

People often find that something is missing halfway through a job. The web app lets them fix it and come back to where they were:

| From | To | Carries | Back |
|---|---|---|---|
| Load Out record | New Sawing | `wood`, `t`, `w`, `l`, `pcs`, `back=/exports/:id`, `backCode` | The Sawing record shows "Back to load out EXP-…" |
| New Sawing | New Load In | `wood`, `back=/production/new?…` (the Sawing link, including its own `back`) | The measuring page shows "Back to sawing", which returns with `load=<new id>` added |
| Measure Logs list | Load In record | `from=measure` | Back goes to Measure Logs, and the menu highlight stays on Measure Logs |

**Rules:**
- **Validate the way back.** Web only accepts `back` values of the form `/exports/<uuid>` and `/production/new…` (`loadOutLink()` in `Production.tsx`, `sawingLink()` in `Imports.tsx`).
- **Chains work.** Load Out → Sawing → Load In → Sawing → Load Out returns to the original load out.

**Mobile:** pass the same values as Expo Router params, show the same "Back to …" bars, and use `router.replace` / `router.navigate` to return. Don't push a new copy of the screen.

---

## 13. Feedback and safety on every action

- **Toast after every change** (web `components/toast.tsx`, `useToast()`). Mobile has `components/toast.tsx`.

| Action | Key | Example message |
|---|---|---|
| Log saved | `logAddedToast` | "Log #12 saved · 5.625 CFT" |
| Log updated | `logUpdatedToast` | |
| Log deleted | `logDeletedToast` | |
| Load Out line added | `lineAddedToast` | "Line added · 4.167 CFT" |
| Line updated / deleted | `lineUpdatedToast`, `lineDeletedToast` | |
| Sawing size added | `sizeAddedToast` | "2 × 6 in × 10 ft × 5 added · 4.167 CFT" |
| Size updated / deleted | `sizeUpdatedToast`, `sizeDeletedToast` | |
| Unloading added / ended / deleted | `unloadingAddedToast`, `unloadingEndedToast`, `unloadingDeletedToast` | |
| Send to owner | `sentForApprovalToast` | |
| Approve | `approvedDoneToast` | "Approved. Stock is updated." |
| Reject | `sentBackToast` | |
| Details edited, raw CFT saved | `saved` | |

- **No double submits.** Every save, delete and approve sets a **ref lock synchronously** before awaiting the request, and releases it after. A `busy` state alone isn't enough, because it only takes effect on the next render. On the web this caused duplicate unloadings. Apply it to every mobile save button and keypad "=" as well. The server now also refuses a duplicate unloading (§2).
- **Confirm before delete** (mobile `components/confirm.tsx` already exists).
- **Confirmations and dialogs open above everything,** including a bottom sheet or quick view they were opened from. On the web, the Approve confirmation used to appear under the quick view's backdrop.

---

## 14. Web-only changes (do not copy)

These were desktop or browser styling, and don't apply to the phone app:

- **Desktop layout:**
  - A flat, edge-to-edge top bar and a flat full-height sidebar with one shared header shadow.
  - Centred page width up to 1800px.
  - The sidebar's active item (orange gradient pill, frosted icon chip, glossy top edge).
- **Browser scrollbars:** thin, macOS-style scrollbars on Windows and Linux.
- **Keyboard:** the keyboard-shortcuts row on the calculator. Phones have no keyboard, though a tablet with a keyboard could still use it.
- **Web stacking order:** row 55, quick view 60, dialogs 70, dropdowns 80, toasts 90. Mobile only needs the rule from §13: confirmations sit above the sheet that opened them.
- **Date pickers:** shadcn date and date-time pickers replaced native browser inputs. Mobile already has `components/calendar.tsx`.
- **Input colours:** white with a visible border instead of grey. **Do** check the same problem on mobile: idle chips, search boxes and inputs must stand out from the screen background, not blend into it.

---

## 15. New i18n keys

All of these are in `packages/shared/src/i18n.ts` in **English and Tamil**. Grep for the key to see the exact text.

| Area | Keys |
|---|---|
| **Simple view and settings** | `simpleLoadIn`, `simpleMeasure`, `simpleCut`, `simpleLoadOut`, `simpleStock`, `simpleApprove`, `simpleDues`, `showAllFeatures`, `showAllFeaturesHint`, `moreOptions`, `moreDetails`, `moreFields`, `secMyPreferences`, `secMyPreferencesSub`, `viewMode`, `simpleView`, `simpleViewSub`, `fullView`, `fullViewSub`, `millSettings` |
| **Home** | `needsAction`, `allDone`, `whatToDo`, `loadsInToday`, `loadsOutToday`, `nWaitingApproval`, `rejectedToFix`, `loadsToMeasure` |
| **Load In / measuring** | `lorryAndWood`, `measureNow`, `startMeasuring`, `cftFormulaLabel`, `pickOrAddLorry` |
| **Calculator** | `calculatorView`, `formView`, `entryView`, `calcTape`, `calcTapeEmpty`, `calcClearAll`, `calcEquals`, `kbdTitle`, `kbdNumbers`, `kbdNext`, `kbdDelete`, `kbdClear` |
| **Stock and waiting approval** | `pendingApproval`, `pendingStockHint`, `pendingRawHint`, `stockLogs`, `stockSawn`, `cftLeft`, `ofReceived`, `sawThis`, `loadOutThis`, `noLogsInStock`, `nothingSawn` |
| **Load Out** | `moreThanInStock`, `notInStockAddSawing`, `stockSummaryLine`, `inThisLoad`, `noSawnStock`, `moreSizes`, `fromLoad`, `loadAutoHint`, `sizeNotInStock`, `addSawing`, `pickSize` |
| **Ways back** | `sawingForLoadOut`, `backToLoadOut`, `loadInNewLogs`, `loadInForSawing`, `backToSawing` |
| **Toasts** | `sentForApprovalToast`, `approvedDoneToast`, `sentBackToast`, `logAddedToast`, `logUpdatedToast`, `logDeletedToast`, `lineAddedToast`, `lineUpdatedToast`, `lineDeletedToast`, `sizeAddedToast`, `sizeUpdatedToast`, `sizeDeletedToast`, `unloadingAddedToast`, `unloadingEndedToast`, `unloadingDeletedToast` |
| **Reworded** | `defaultLoad` ("Take pieces from load (optional)"), `defaultLoadHint`, `exportWoodHint`, `measureHint` ("Length in feet, then girth in inches…") |

---

## 16. Suggested order of work

1. **Simple view setting:** read `uiMode`, the switch in Preferences, and language saved on the user (§3, §4). Everything else depends on it.
2. **Double-submit locks and toasts** on existing save buttons (§13). Small, and immediately useful.
3. **Measure Logs:** length first, the working line, the entries list with edit and delete, and the key colours (§8).
4. **Load In:** simple form and lorry pick list (§7).
5. **Load Out:** wood and load pickers, the calculator with the load filter, "From load" and "not in stock" (§9).
6. **Sawing:** raw CFT strip, waiting loads, calculator (§10).
7. **Ways back** between Load Out, Sawing and Load In (§12).
8. **Simple Home, Stock and navigation** (§5, §6, §11).

**Testing:** after each step, run the same flow on the web and the phone, with the same account and the same load. The numbers, names and order should match.
