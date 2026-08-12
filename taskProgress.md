2. A real bug I found reading the code — flag this before anything else
PAN/Aadhaar encryption is only half-wired. In crypto.rs, encrypt()/decrypt() exist and are correct AES‑GCM. But:

encrypt() is called exactly once, inside the one-time migration 007_encrypt_customer_data in db.rs, to retroactively encrypt whatever was in the table at that moment.
decrypt() is never called anywhere in commands.rs.
Every customer insert path (create_booking_and_receipt's new-customer branch, co-applicant insert) writes payload.customer.pan_number / aadhaar_number straight to the DB, unencrypted.
Every read path (get_receipt_history, get_booking_details_by_unit, search_customers, get_customer_profile) returns whatever is in the column without decrypting.
Net effect: customers that existed at migration time now have unreadable base64 ciphertext showing up on receipts/UI (since nothing decrypts it), and every customer created since then is stored in plain text — the exact risk Tier 1.5 was supposed to close. This needs a real fix (encrypt on every write path, decrypt on every read path, probably centralized in one repository-style helper) before you accept that 1.5 is "done." I'd treat this as the top priority, above anything in your proposal's sequencing.

3. Corrections to the specific architecture proposed
State management: You propose "zustand or Context" as a future decision — zustand is already the chosen and implemented store (useAppStore.ts). Nothing to decide here.
Domain/business logic layer in TypeScript (src/services/*): I'd push back on this. The app's actual pattern is to keep business logic (GST calc, booking validation, receipt numbering) in Rust commands, with TS doing input validation only (validators.ts). Adding a parallel TS services layer risks duplicating logic that already lives in Rust (e.g., you'd end up with GST math in two places that can drift). If anything, the real debt is the opposite direction — Rust logic should move out of the monolithic commands.rs (see below), not be duplicated in TS.
Repository pattern in Rust: this is the one part of your proposal that's a genuine, still-open gap. commands.rs is now 1,803 lines of raw sqlx queries — it has become the new App.tsx-style monolith the Tier 2 refactor was supposed to prevent. I'd prioritize splitting it into commands/projects.rs, commands/bookings.rs, commands/receipts.rs, commands/gst.rs, etc., with a thin repository layer underneath, before adding more features on top of it.
Encryption: as noted, don't move to SQLCipher — fix the wiring on the AES‑GCM implementation that already exists.
PDF/Print: update your doc to reflect headless_chrome, not printpdf/wkhtmltopdf — it's a heavier runtime dependency (spawns a headless Chrome process) worth knowing about if you're troubleshooting build size or install issues later.
Mockup image: the "Preview unavailable" placeholder in your write-up means that image never actually generated — worth regenerating or dropping that section before sharing with the team.
4. What the real remaining backlog looks like (from reading the code, not the roadmap)
This is materially shorter and different from your proposed sequencing:

Fix PAN/Aadhaar encryption wiring (above) — critical, live data-exposure bug.
Soft-delete is still not implemented — delete_project, delete_tower, delete_unit are all hard DELETE FROM ... WHERE id = ?, with ON DELETE CASCADE on the FKs. This directly contradicts the Admin Panel note in your own roadmap.md ("a project with linked bookings should never be hard-deleted") and your own implementation_planCurrent.md task list. Right now, deleting a project with active bookings will cascade-delete those bookings/receipts silently.
No customer edit or delete commands — search_customers and get_customer_profile exist (read-only); there's no update_customer/delete_customer. Also, PAN/Aadhaar masking-with-reveal-audit (explicitly called out in your roadmap's Admin Panel note) isn't implemented anywhere in the UI.
Document attachments (2.4) — genuinely not started at all (no table, no command, no UI). This is correctly still open in your proposal.
CSV/Excel export (2.3) is only partially done — ReportsTab.tsx exports the financial summary; there's no export for the receipt ledger or customer list, which was the original ask.
Payment-schedule ↔ receipt auto-reconciliation was never coded — your own implementation_planCurrent.md says "Implement automatic receipt-to-milestone reconciliation logic when new receipts are recorded," but create_additional_receipt never touches payment_schedules. Milestones only change status via manual update_milestone_status. Worth deciding if you want this automated or keep it manual.
Backup has no restore path and no retention/pruning — create_backup exists and runs on unlock, but there's no restore_from_backup command (roadmap 1.2 asked for one), and no "keep last N backups" logic — it will accumulate .db copies in the Documents folder indefinitely.
No audit_log table — you have created_at/updated_at columns, but no actor/action log for sensitive operations (void receipt, reveal PAN, unit status change), which your own roadmap flags as something to "consider."
GST/TDS shipped ahead of stakeholder sign-off — this is the one I'd flag most strongly. implementation_planCurrent.md explicitly lists GST rules as "User Review Required" (CGST/SGST breakdown format, milestone recalculation policy) — but the GST engine is already live and computing/storing tax on every real receipt via create_booking_and_receipt/create_additional_receipt. If the CA hasn't actually signed off, you're currently generating receipts with unconfirmed tax logic. I'd get that confirmed or gate the feature, not treat it as a "future" open question the way your proposal does.
5. On your open questions section
Reasonable questions to keep asking stakeholders, but note that for GST/TDS and RERA specifically, code has already shipped without those answers being confirmed (see #9 above) — so those aren't just "decisions for the future," they're compliance risk on data already being generated today.

My recommendation
Before writing a new implementation plan, I'd:

Do a fresh read-through of implementation_planCurrent.md against current main (I found it's mostly but not 100% accurate — e.g., soft-delete and reconciliation are marked open there too, correctly, unlike your new proposal).
Fix the encryption wiring bug first.
Tackle soft-delete + customer CRUD + attachments as the real remaining Tier 2 gap.
Get explicit CA/stakeholder sign-off on the GST logic that's already live, and split commands.rs before adding more surface area to it.
Happy to turn this into an updated task.md reflecting actual repo state rather than the roadmap's original (now stale) sequencing, if that's useful.

