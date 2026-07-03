# Product & Architecture Roadmap — Sukirti Developers Real Estate ERP

> **Based on**: Architectural Overview Review, June 2026
> **Purpose**: Prioritized list of enhancements, fixes, and new features

---

## How to read this roadmap

Items are grouped into four tiers by urgency, not by effort. A "Critical" item may be small (a backup script); a "Nice to Have" item may be large (multi-user sync). Effort estimates are rough and assume the current solo/small-team codebase.

---

## Tier 1 — Critical (do before wider rollout)

These address data-loss, security, and compliance risk. The app currently stores PAN and Aadhaar numbers in plain text with no backup, no audit trail, and no access control.

| # | Item | Why it matters | Rough effort |
|---|---|---|---|
| 1.1 | **Local authentication (PIN/password gate)** — on launch, render a fullscreen lock screen in React before any app UI mounts; validate against a bcrypt/argon2 hash stored in SQLite; use `tauri-plugin-store` or OS keychain for the session token; auto-lock on inactivity timeout or app close. *Fully supported in Tauri — the lock screen is a React component that conditionally renders before the main app, works entirely offline with no external auth service required* | Anyone with physical or file access to the machine can currently view all customer financial data. Password is never stored in plaintext, only as a hash | Small |
| 1.2 | **Automated local backups** | Single SQLite file with no recovery path; one corruption or accidental delete loses the whole ledger | Small |
| 1.3 | **Audit trail columns** (`created_at`, `updated_at`, `created_by`) on all write tables | No way to trace who changed a unit status or added a receipt, or when | Medium |
| 1.4 | **Receipt void/reversal flow** (not hard delete) | Mistakes currently have no documented correction path; financial records should never be silently deleted | Medium |
| 1.5 | **Encryption at rest for PAN/Aadhaar** (e.g. SQLCipher or column-level encryption) | Sensitive government ID numbers stored as plain TEXT | Medium |
| 1.6 | **Configurable receipt numbering scheme** (per-project and/or per-financial-year, e.g. `REC/2026-27/00012`) decided and implemented *before the first real receipt is issued* | If the app goes live with flat `REC-00001` numbering and later needs to switch formats mid-year, existing receipt numbers can't be renumbered without breaking reconciliation against bank statements and customer copies already issued — there is no clean migration path once real receipts exist | Small–Medium |
| 1.7 | **`booking_customers` junction table** to support joint ownership and one-buyer-multiple-properties, decided *before live data accumulates* | Current `bookings.customer_id` assumes one buyer per unit. The underlying many-to-one (one customer → many bookings) already works, but joint/co-applicant ownership needs a proper junction table. Retrofitting this once real bookings exist means migrating live FK data instead of just adding a table | Medium |
| 1.8 | **RERA fields on `projects`** — add nullable `rera_number`, `rera_website_url` columns; update `open_receipt_html` to conditionally render RERA details on every printed receipt | RERA mandates that the registration number appears on all booking-related documents. The `projects` table schema and receipt HTML template must handle this *before the first real receipt is printed*. Fields are nullable to accommodate projects below the RERA threshold or pre-Act registrations, but the receipt template must handle the `NULL` case gracefully (omit the section rather than print a blank or error) | Small–Medium |

---

## Tier 2 — High Priority (near-term roadmap)

These reduce architectural debt and unlock day-to-day usability improvements the business will likely ask for soon.

| # | Item | Why it matters | Rough effort |
|---|---|---|---|
| 2.0 | **Admin panel — CRUD management for Projects, Towers, Units, and Customers** — a dedicated Settings/Admin section (protected behind the password gate from 1.1) with forms to create, edit, and soft-delete records across all four entities; separate from the sales-facing Property Explorer | Currently there is no UI to add a new project, tower, or unit — data must be seeded directly into SQLite by a developer. Any new project launch requires technical intervention, which is a critical usability gap before handing the app to non-technical staff | Medium |
| 2.1 | **Refactor `App.tsx` monolith** into `ExplorerTab`, `BookingModal`, `ReceiptLedger`, shared hooks (`useReceiptData`, `usePropertyMap`) | Already flagged in the architecture review at ~1,800 lines; will only get harder to maintain | Medium–Large |
| 2.2 | **Native PDF generation in Rust** (`printpdf` or `wkhtmltopdf` binding) instead of browser-print round-trip | Enables silent/batch printing, email attachment, no extra browser window | Medium |
| 2.3 | **CSV/Excel export** of receipt ledger and customer list | Needed for handoff to accountants/auditors | Small |
| 2.4 | **Document attachments** (agreement copy, ID proof, cheque image) linked to booking/receipt | Commonly required for compliance and dispute resolution | Medium |
| 2.5 | **Customer profile view + `get_customer_profile` command** — search a buyer by name/phone/PAN and see all their bookings, receipts, and outstanding balance across every property in one place | Today the app is unit-first only; a buyer with multiple properties has no single view of their full relationship with the developer | Medium |
| 2.6 | **Consolidated per-customer financial ledger** (aggregate agreed value, total paid, total outstanding across all bookings) | Sales/accounts will need a single statement for a multi-property buyer, not one ledger per unit | Small (builds on 2.5) |

---

---

## Architecture Note: Admin Panel — Projects, Towers, Units, Customers

The admin panel should be a separate tab or protected route, only accessible after the password gate (1.1). It covers four management screens:

- **Projects** — create/edit a project (name, location, RERA number, OC date, is_metro flag). Soft-delete only; a project with linked bookings should never be hard-deleted.
- **Towers** — create/edit towers within a project (tower name, total floors). Tower deletion blocked if any units exist under it.
- **Units** — create/edit individual units (floor, configuration, carpet area sqm, agreed sale value, status). Consider a bulk-insert wizard (e.g. "create floors 1–10, units A/B/C per floor") to avoid entering 100+ units one by one. Status transitions (Available → Booked → Registered) should be auditable (links to 1.3).
- **Customers** — search/edit customer records; view all linked bookings inline. PAN/Aadhaar fields should display masked by default (links to 1.5), with a show/reveal action that logs an audit entry.

Important: build `AdminPanel.tsx` as a new standalone component alongside the `App.tsx` refactor (2.1), not inside the existing monolith — adding more screens to the current 1,800-line file will make it significantly harder to maintain.

---

## Architecture Note: One Buyer, Multiple Properties

The current schema already supports this case at its core — `bookings` is a join table between `customers` and `units`, so a single `customer_id` can appear across many `bookings` rows, and PAN-based dedup in `create_booking_and_receipt` ensures a repeat buyer resolves to the same customer record instead of creating a duplicate.

What's missing is everything *around* that relationship:

- **Joint ownership** — today `bookings.customer_id` assumes a single buyer per unit. Co-applicants (e.g., spouses, family) need the `booking_customers` junction table (item 1.7) rather than a single FK.
- **Customer-first navigation** — the app is unit-first today (select a unit → see its booking). A multi-property buyer needs the reverse path: search a customer, see every unit/booking/receipt tied to them (item 2.5).
- **Consolidated financials** — stats and progress bars are currently scoped per booking. A multi-property buyer needs an aggregate total-paid/outstanding view across all their units (item 2.6).
- **Per-booking pricing flexibility** — if a second or third purchase by the same buyer carries different terms (discount, payment plan), that needs to live on `bookings`, not on the shared `customers` row, since customer info is otherwise a single mutable record.
- **Snapshot vs. live customer data** — decide whether each booking should snapshot the buyer's details at booking time, or always reference the live `customers` row. This matters if a buyer's correspondence address/phone can differ per property purchased.

Recommended order: do 1.7 (junction table) before any real bookings are entered, since migrating a live `customer_id` FK later is far more disruptive than adding the table now. The customer-profile view (2.5/2.6) can follow once the underlying data model is in place.

---

## Tier 3 — Medium Priority (planned features)

Feature-level enhancements that extend the product's value once the above foundations are solid.

| # | Item | Why it matters | Rough effort |
|---|---|---|---|
| 3.1 | **Payment schedule / installment plans** (construction-linked or time-linked) | Real estate sales typically follow structured payment milestones, not ad hoc receipts | Large |
| 3.2 | **GST/TDS fields on receipts** — add `carpet_area_sqm`, `is_metro`, `occupancy_certificate_date` on `units`/`projects`; compute applicable GST rate (1% / 5% / exempt) from carpet area + price + OC status rather than hardcoding a price threshold; store the GST computation basis (taxable value after land deduction, rate applied, OC status at time of sale) on each receipt for audit purposes | GST on under-construction property is **not** a simple "below ₹45L exempt / above ₹45L taxed" rule. It's 1% GST (no ITC) only if *both* carpet area (≤60 sqm metro / ≤90 sqm non-metro) and price (≤₹45L) conditions are met; 5% GST (no ITC) applies above ₹45L or if the area test fails even under ₹45L; and GST is fully exempt only once the project has an Occupancy/Completion Certificate. Hardcoding "price < 45L → no GST" would misstate tax on every receipt | Medium |
| 3.3 | **Reporting dashboard** — collection forecasts, overdue tracking, project-wise revenue summaries | Current stats are limited to bookings count, revenue, and available units | Medium–Large |
| 3.4 | **Search/filter improvements** on Property Explorer (by configuration, price range, status) | Usability improvement as project/unit count grows | Small |

---

## Architecture Note: GST Applicability on Receipts

GST on a flat sale is determined by three independent conditions, not a single price cutoff, so the schema needs to capture each one rather than deriving GST from `agreed_sale_value` alone:

- **Occupancy/Completion Certificate status** — if the project has received its OC/CC before the booking, the sale is exempt from GST entirely (treated as immovable property, not a construction service). If OC is granted *during* an ongoing project, GST may stop applying to subsequent payments even though earlier receipts on the same booking correctly included it — `occupancy_certificate_date` should live on `projects` (or per-tower/phase, if OC is granted in phases) and the receipt logic should check this date at the time each receipt is issued, not just once at booking time.
- **Carpet area** — affordable housing requires carpet area ≤60 sqm in metro cities or ≤90 sqm in non-metro cities. This needs a `carpet_area_sqm` field on `units` and an `is_metro` flag (or a project-level city/region lookup) to evaluate correctly.
- **Price threshold** — ₹45 lakh or less, evaluated *together with* the carpet area condition, not on its own. A unit priced under ₹45L but exceeding the carpet area limit does not qualify for the 1% rate.

If both the carpet area and price conditions are met, the applicable rate is 1% (no input tax credit); otherwise 5% (no ITC), for any under-construction unit. GST is computed only on the taxable value after deducting roughly one-third of the price for land, not the full agreed sale value.

Recommendation: treat the GST rate as a *derived* value computed from `carpet_area_sqm`, `is_metro`, `agreed_sale_value`, and `occupancy_certificate_date`, rather than a manually entered field — this prevents a staff member from accidentally applying the wrong rate, and lets the receipt template show the computation basis for audit purposes. This logic should be reviewed with the client's CA before being encoded as a rule, since GST treatment is a frequent source of disputes and the exact thresholds are state/CBIC-notified and can change.

---

## Tier 4 — Nice to Have / Strategic Bets

Bigger architectural decisions that should be flagged early even if not built soon, since they affect today's design choices.

| # | Item | Why it matters | Rough effort |
|---|---|---|---|
| 4.1 | **Multi-user / sync support** | Currently offline-first single-user by design; multiple staff needing concurrent access would require a client-server DB or sync layer — a major architecture shift | Very Large |
| 4.2 | **Multi-currency / portfolio support** | Relevant only if the developer expands beyond a single currency/market | Large |
| 4.3 | **Mobile companion app** (read-only ledger view) | Useful for sales staff on-site, not core to current desktop workflow | Large |

---

## Suggested sequencing

1. **Before the first real booking is entered**: finalize the receipt numbering scheme (1.6), the `booking_customers` junction table for multi-property/joint buyers (1.7), and the RERA fields on `projects` (1.8). All three are one-way doors — they can't be retrofitted later without breaking reconciliation, migrating live data, or reprinting already-issued receipts.
2. **Sprint 1–2**: remaining Tier 1 items (auth, backups, audit columns, void flow, encryption) — foundational risk fixes that can still be added safely after go-live, but are cheaper to do now.
3. **Sprint 3–5**: Tier 2 items, starting with the `App.tsx` refactor since it makes every subsequent feature easier to build safely. Customer profile view (2.5/2.6) should follow shortly after, once 1.7 is in place.
4. **Ongoing backlog**: Tier 3 items, prioritized by actual user requests from the sales/accounts team. GST/TDS fields (3.2) should be confirmed with the client's CA before implementation, since incorrect tax computation is a compliance and trust risk.
5. **Revisit Tier 4** only when there's a concrete business driver (e.g., a second office location forcing the multi-user question).

---

## Open questions to confirm with stakeholders

- Is multi-user access actually needed in the next 6–12 months, or will this remain single-machine/single-user?
- What jurisdiction's tax rules (GST/TDS) need to be reflected on receipts?
- For GST: does any project have a phased Occupancy/Completion Certificate (some towers OC'd while others are still under construction)? Are unit-level carpet area figures available and finalized, so the 1%/5%/exempt rate can be computed reliably rather than entered manually?
- Is there a RERA compliance requirement for this project? If yes: (a) what is the state RERA registration number for each project? (b) is a QR code or website URL also required on printed receipts, or just the number? (c) are any projects below the RERA threshold (e.g., plot area < 500 sqm, or fewer than 8 apartments) and therefore exempt?
- Should each booking snapshot the buyer's contact/address details at the time of purchase, or always reflect the latest `customers` record? This matters for buyers with multiple properties whose details may change between purchases.
- How common is joint ownership (co-applicants) expected to be in practice — does it justify building the junction table now versus deferring to a later release?
- Who is the intended backup destination — local external drive, or is cloud sync acceptable despite the offline-first design goal?
