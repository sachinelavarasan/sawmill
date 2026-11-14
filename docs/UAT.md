# TimberTrail — Acceptance test checklist (web app)

For the mill owner and the accountant to check the web app before it goes live.
Use the **test site** with real-looking entries — not the live site. Each test says what
to do and what you should see. Tick **OK**, or write what happened in **Notes**.

**Before you start**

- Two logins: one **Owner**, one **Accountant** (the owner creates the accountant in test 1.2).
- Two browser windows side by side — one for each person — makes approvals easy to follow.
- A calculator for checking CFT.
- Test once in English and once in தமிழ் (button at the top right).

---

## 1. Login and users

| # | Who | Do this | You should see | OK | Notes |
|---|---|---|---|---|---|
| 1.1 | Owner | Log in | Owner dashboard with profit, stock and charts | ☐ | |
| 1.2 | Owner | Users → Add user: an accountant with a password | Accountant appears in the list | ☐ | |
| 1.3 | Accountant | Log in | Accountant dashboard; no Accounts, Suppliers, Clients, Users or Settings in the menu | ☐ | |
| 1.4 | Accountant | Log out, then type a wrong password 5 times, then the right one | "Too many wrong passwords…"; login works again after 15 minutes | ☐ | |
| 1.5 | Owner | Users → Reset password for the accountant | Accountant is logged out at their next click and must use the new password | ☐ | |
| 1.6 | Owner | Disable the accountant, then enable again | Disabled accountant cannot log in; works again after enabling | ☐ | |
| 1.7 | Both | Switch language to தமிழ் | All screens in Tamil; numbers and dates still correct | ☐ | |

## 2. Import a lorry and measure logs

| # | Who | Do this | You should see | OK | Notes |
|---|---|---|---|---|---|
| 2.1 | Accountant | Imports → New Import: lorry number, wood type | Import created with an ID like IMP-2026-0001, status Draft | ☐ | |
| 2.2 | Accountant | Add unloading: start and end time | Hours and charges worked out from the mill's rate | ☐ | |
| 2.3 | Accountant | Log Measurement: enter girth 24, length 10 | CFT **2.500** (24 × 24 × 10 ÷ 2304) | ☐ | |
| 2.4 | Accountant | Enter 10 more logs using only the keyboard | Each log adds a row; running total and log count update | ☐ | |
| 2.5 | Accountant | Edit one log, delete another | Totals update | ☐ | |
| 2.6 | Accountant | Submit for approval | Status Pending; the import can no longer be changed | ☐ | |
| 2.7 | Owner | Approvals → approve it | Raw stock goes up by the import's total CFT | ☐ | |
| 2.8 | Owner | Open the import → Purchase details: supplier, rate, paid | Saved; the accountant never sees these figures | ☐ | |

## 3. Production

| # | Who | Do this | You should see | OK | Notes |
|---|---|---|---|---|---|
| 3.1 | Accountant | Production → New: pick the approved import, raw CFT used | Run created as Draft | ☐ | |
| 3.2 | Accountant | Add finished sizes, e.g. 4 × 2 × 8 ft, 20 pieces | CFT **8.889** (4 × 2 × 8 × 20 ÷ 144); waste and recovery % shown | ☐ | |
| 3.3 | Accountant | Submit; Owner approves | Raw stock goes down, finished stock goes up | ☐ | |
| 3.4 | Accountant | Try a run that uses more raw CFT than is left | Refused with a clear message | ☐ | |

## 4. Stock

| # | Who | Do this | You should see | OK | Notes |
|---|---|---|---|---|---|
| 4.1 | Both | Stock → Raw and Finished tabs | Balances match the approved entries above | ☐ | |
| 4.2 | Both | History tab | Every change listed with what caused it | ☐ | |
| 4.3 | Accountant | Adjustments → new adjustment (e.g. −2 pieces, "damaged"), submit; Owner approves | Stock changes only after approval | ☐ | |

## 5. Exports and sales

| # | Who | Do this | You should see | OK | Notes |
|---|---|---|---|---|---|
| 5.1 | Accountant | Exports → New: lorry, wood type | Export created (EXP-…) | ☐ | |
| 5.2 | Accountant | Add lines picked from finished stock | Only sizes in stock can be picked; CFT worked out | ☐ | |
| 5.3 | Accountant | Try to send more pieces than are in stock | Refused | ☐ | |
| 5.4 | Accountant | Submit; Owner approves | Finished stock goes down | ☐ | |
| 5.5 | Owner | Open the export → Sale details: client, rate, received | Saved; not visible to the accountant | ☐ | |

## 6. Approvals and settings (Owner)

| # | Do this | You should see | OK | Notes |
|---|---|---|---|---|
| 6.1 | Have the accountant submit 3 different entries | Approvals shows them oldest first; the menu badge shows the count | ☐ | |
| 6.2 | Reject one with a reason | Accountant sees it as Rejected, can fix it and submit again | ☐ | |
| 6.3 | Settings: change unloading rate and the language for new users | New unloading entries and new users use the new values | ☐ | |

## 7. Accounts and reports (Owner)

| # | Do this | You should see | OK | Notes |
|---|---|---|---|---|
| 7.1 | Accounts → add an expense (e.g. diesel ₹2,000) | Profit goes down by ₹2,000 | ☐ | |
| 7.2 | Change the period (this month, last month, custom) | Figures change to that period | ☐ | |
| 7.3 | Check "Suppliers are owed" and "Clients owe" | Match purchase/sale amounts minus what was paid/received | ☐ | |
| 7.4 | Reports → open each report | Rows and totals match the screens above | ☐ | |
| 7.5 | Download Excel | Opens in Excel with title, period and totals | ☐ | |
| 7.6 | Print / Save as PDF (also in Tamil) | All rows printed, Tamil text readable | ☐ | |
| 7.7 | Accountant: open Reports | Only Import, Production, Export and Stock reports. Registers show only their own entries; stock is for the whole mill | ☐ | |

## 8. Everyday use

| # | Do this | You should see | OK | Notes |
|---|---|---|---|---|
| 8.1 | Open the app on a phone browser | Everything usable; menu opens from the ☰ button | ☐ | |
| 8.2 | Lists with many entries | Page buttons at the bottom; rows per page can be changed | ☐ | |
| 8.3 | Dark mode button | Screens readable in dark mode | ☐ | |
| 8.4 | Owner → Audit Log | Every login, change, approval and rejection is listed with who and when | ☐ | |

---

## Sign-off

Problems found: ______ (list them with the test number)

| | Name | Signature | Date |
|---|---|---|---|
| Mill owner | | | |
| Accountant | | | |
| Developer | | | |

The app goes live once every test is OK, or the owner has accepted the remaining notes.
