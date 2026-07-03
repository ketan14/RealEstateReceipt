# Architectural Overview — Sukirti Developers Real Estate ERP

> **Role**: Principal Software Architect Review  
> **Date**: June 2026  
> **Codebase**: `/Users/ketan/Live/RealEstateReceipt`

---

## 1. Technology Stack

| Layer | Technology | Role |
|---|---|---|
| **Desktop Shell** | [Tauri v2](https://tauri.app) | Native OS window, IPC bridge, file system access |
| **Frontend Runtime** | WKWebView (macOS / WebKit) | Renders the React SPA inside the Tauri window |
| **Frontend Framework** | React 18 + TypeScript | UI rendering, state management |
| **Styling** | Tailwind CSS v4 (via Vite plugin) | Utility-first CSS |
| **Build Tool** | Vite v7 | Dev server, production bundler (ESM) |
| **Backend Language** | Rust (Stable) | Command handlers, business logic, I/O |
| **Database** | SQLite (via `sqlx`) | Embedded, offline-first persistent store |
| **IPC Bridge** | `tauri::generate_handler!` + `invoke()` | Typed, async calls from JS → Rust |
| **PDF/Print** | `tauri-plugin-opener` + System Browser | Writes temp HTML, opens in default browser for print |

> **No external network API calls**. This is a fully **offline-first** application.

---

## 2. High-Level Architecture Diagram

```
┌──────────────────────────────────────────────────────────┐
│                    macOS Desktop Window                  │
│                    (Tauri WKWebView)                     │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │              React SPA  (src/App.tsx)              │  │
│  │                                                    │  │
│  │  ┌──────────┐  ┌─────────────┐  ┌─────────────┐  │  │
│  │  │ Property │  │   Booking   │  │   Receipt   │  │  │
│  │  │ Explorer │  │   Modal     │  │   Ledger    │  │  │
│  │  │   Tab    │  │ (Form/Pmt)  │  │     Tab     │  │  │
│  │  └──────────┘  └─────────────┘  └─────────────┘  │  │
│  │         │              │                │          │  │
│  │         └──────────────┴────────────────┘          │  │
│  │                        │                           │  │
│  │               invoke("command", args)              │  │
│  └────────────────────────┼───────────────────────────┘  │
│                           │  Tauri IPC Bridge            │
│  ┌────────────────────────┼───────────────────────────┐  │
│  │         Rust Backend  (src-tauri/src/)             │  │
│  │                        │                           │  │
│  │       commands.rs ─────┘                           │  │
│  │       (7 Commands)                                 │  │
│  │             │                                      │  │
│  │          sqlx async queries                        │  │
│  │             │                                      │  │
│  │       ┌─────▼──────┐                               │  │
│  │       │  SQLite DB │  real_estate_erp.db           │  │
│  │       │  (AppData) │  (~/Library/Application       │  │
│  │       └────────────┘   Support/com.realestate.erp) │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

---

## 3. Frontend Components

The entire frontend lives in a **single monolithic component** — `App.tsx` (~1,800 lines). It is structured into logical visual regions:

### 3.1 Global State (React `useState`)

| State Variable | Type | Purpose |
|---|---|---|
| `activeTab` | `"explorer" \| "history"` | Switches between the two main panels |
| `projects` | `Project[]` | Hierarchical property map (Project → Tower → Unit) |
| `receipts` | `ReceiptHistoryItem[]` | Full, flat list of all receipts from DB |
| `uniqueCombinations` | `ReceiptHistoryItem[]` | Deduplicated per booking (for stats counter) |
| `selectedUnit` | `Unit \| null` | The unit currently selected on the explorer map |
| `bookingDetails` | `BookingDetails \| null` | Booking + receipts for the selected unit |
| `isBookingOpen` | `boolean` | Controls the "Generate Booking & Receipt" modal |
| `isDetailsOpen` | `boolean` | Controls the "Booking Ledger & Details" modal |
| `showPartPaymentForm` | `boolean` | Toggles the inline part-payment form inside the details modal |
| `partAmount / partPaymentMode / partTransactionRef / partPaymentDate` | Various | Inline payment form state |

### 3.2 UI Panels

| Panel | Rendered When | Description |
|---|---|---|
| **Header Bar** | Always | App branding, tab navigation (Explorer / Receipt Ledger) |
| **Property Explorer Tab** | `activeTab === "explorer"` | Interactive project/tower accordion + unit card grid |
| **Sidebar: Property Information** | Unit selected in Explorer | Shows unit metadata; for Available units shows booking CTA; for Booked/Registered units shows "View Booking Details" button |
| **Booking Modal** (`isBookingOpen`) | Available unit selected + "Generate Booking & Receipt" clicked | Multi-section form: customer details, financial terms, first receipt |
| **Booking Details Modal** (`isDetailsOpen`) | Booked/Registered unit + "View Booking Details" clicked | Dual-panel: customer profile + receipt ledger (left); payment progress bar + inline payment form (right) |
| **Receipt Ledger Tab** | `activeTab === "history"` | Searchable, filterable table of all receipts grouped by booking |
| **Stats Dashboard** | Inside Explorer tab sidebar | Bookings count, collected revenue, available units |
| **Receipt Print Template** | `printRef` DOM ref (hidden) | Invisible div rendered for PDF generation via browser print |

### 3.3 Derived/Computed Data

| Computed | Source | Purpose |
|---|---|---|
| `filteredReceipts` | `receipts` + search/filter state | Narrows receipt list by query and payment mode |
| `groupedReceipts` | `filteredReceipts` | Groups individual receipts by booking key (`customer + unit + project + tower`) into `GroupedReceipt[]` for the ledger table |

---

## 4. Backend Services (Rust — `commands.rs`)

All backend logic is exposed as **Tauri commands** — async Rust functions decorated with `#[tauri::command]` and registered in `lib.rs`.

### 4.1 Command Registry (`lib.rs`)

```rust
.invoke_handler(tauri::generate_handler![
    commands::get_property_map,
    commands::create_booking_and_receipt,
    commands::get_receipt_history,
    commands::open_receipt_html,
    commands::get_booking_details_by_unit,
    commands::create_additional_receipt,
    commands::update_unit_status
])
```

### 4.2 Command Reference

| Command | Direction | Description | Transaction? |
|---|---|---|---|
| `get_property_map` | Read | Returns full Project → Tower → Unit hierarchy with statuses | No |
| `create_booking_and_receipt` | Write | Validates unit availability, upserts customer by PAN, creates booking + first receipt, marks unit `Booked` | ✅ ACID Tx |
| `get_receipt_history` | Read | Returns all receipts with full JOIN (receipts → bookings → customers → units → projects → towers) | No |
| `open_receipt_html` | Side-effect | Writes receipt HTML to app local data dir, opens in system browser for PDF print | No |
| `get_booking_details_by_unit` | Read | Returns booking + customer info + all receipts for a given unit ID | No |
| `create_additional_receipt` | Write | Validates overpayment guard (+0.01 float tolerance), generates new receipt for existing booking | ✅ ACID Tx |
| `update_unit_status` | Write | Updates unit status to `Available`, `Booked`, or `Registered` with whitelist validation | No |

### 4.3 Shared State

`DbState { pool: SqlitePool }` is initialized at startup in `lib.rs` and stored in Tauri's global managed state. Every command receives it via `State<'_, DbState>`.

---

## 5. Database Schema

**Engine**: SQLite 3 (file: `real_estate_erp.db` in the macOS Application Support directory)  
**FK Enforcement**: `PRAGMA foreign_keys = ON`  
**Connection Pool**: `sqlx::SqlitePool` (async)

### 5.1 Entity Relationship Diagram

```
projects (1) ──< towers (1) ──< units
                                  │
                                  │ (unit_id FK)
                              bookings (1) ──< receipts
                                  │
                            customers (via customer_id FK)
```

### 5.2 Table Definitions

#### `projects`
| Column | Type | Constraint |
|---|---|---|
| `id` | INTEGER | PK AUTOINCREMENT |
| `name` | TEXT | NOT NULL |
| `location` | TEXT | NOT NULL |

#### `towers`
| Column | Type | Constraint |
|---|---|---|
| `id` | INTEGER | PK AUTOINCREMENT |
| `project_id` | INTEGER | FK → `projects.id` CASCADE |
| `name` | TEXT | NOT NULL |

#### `units`
| Column | Type | Constraint |
|---|---|---|
| `id` | INTEGER | PK AUTOINCREMENT |
| `project_id` | INTEGER | FK → `projects.id` CASCADE |
| `tower_id` | INTEGER | FK → `towers.id` CASCADE |
| `unit_number` | TEXT | NOT NULL |
| `status` | TEXT | CHECK IN (`Available`, `Booked`, `Registered`) |
| `base_price` | REAL | NOT NULL |
| `configuration` | TEXT | NOT NULL (e.g., `2BHK`, `3BHK`) |

#### `customers`
| Column | Type | Constraint |
|---|---|---|
| `id` | INTEGER | PK AUTOINCREMENT |
| `name` | TEXT | NOT NULL |
| `phone` | TEXT | NOT NULL |
| `pan_number` | TEXT | NOT NULL (used as dedup key) |
| `aadhaar_number` | TEXT | NOT NULL |

#### `bookings`
| Column | Type | Constraint |
|---|---|---|
| `id` | INTEGER | PK AUTOINCREMENT |
| `customer_id` | INTEGER | FK → `customers.id` CASCADE |
| `unit_id` | INTEGER | FK → `units.id` CASCADE |
| `booking_date` | TEXT | NOT NULL (ISO date string) |
| `agreed_sale_value` | REAL | NOT NULL |

#### `receipts`
| Column | Type | Constraint |
|---|---|---|
| `id` | INTEGER | PK AUTOINCREMENT |
| `booking_id` | INTEGER | FK → `bookings.id` CASCADE |
| `receipt_number` | TEXT | NOT NULL (e.g., `REC-00001`) |
| `amount` | REAL | NOT NULL |
| `payment_mode` | TEXT | CHECK IN (`Cash`, `Cheque`, `RTGS`, `IMPS`) |
| `transaction_ref` | TEXT | NOT NULL |
| `date` | TEXT | NOT NULL (ISO date string) |

---

## 6. Payment Validation Layer (`types/index.ts`)

A centralized, type-safe validation matrix enforces banking limits **before** any IPC call is made:

| Mode | Min (₹) | Max (₹) | Notes |
|---|---|---|---|
| **IMPS** | 1 | 50,00,000 | RBI ceiling |
| **RTGS** | 2,00,000 | — | RBI minimum |
| **Cheque** | 1 | — | No cap |
| **Cash** | 1 | — | No cap |

**Overpayment guard**: Enforced both on the frontend (`validatePaymentAmount()`) and independently in the Rust backend (`amount > outstanding + 0.01`).

---

## 7. Request Lifecycle — End to End

### 7.1 Example: "Record a Part Payment"

```
1. USER ACTION
   └─ User types ₹2,50,000 in the part-payment amount input
      partAmount state updates → Dynamic progress bar preview renders (indigo segment pulses)

2. FRONTEND VALIDATION (types/index.ts → validatePaymentAmount)
   └─ Checks: amount > 0 ✅ | amount ≤ outstanding ✅ | RTGS ≥ ₹2,00,000 ✅
      If failed → setErrorMsg(validationError) → render stops here

3. TAURI IPC CALL (App.tsx → handlePartPaymentSubmit)
   └─ await invoke("create_additional_receipt", {
         bookingId, amount, paymentMode, transactionRef, date
      })
      Serialized as JSON, transferred over the IPC bridge

4. RUST COMMAND HANDLER (commands.rs → create_additional_receipt)
   ├─ Validate: amount > 0
   ├─ BEGIN TRANSACTION
   ├─ SELECT agreed_sale_value FROM bookings WHERE id = bookingId
   ├─ SELECT COALESCE(SUM(amount), 0) FROM receipts WHERE booking_id = bookingId
   ├─ Guard: amount ≤ outstanding + 0.01 (float tolerance)
   ├─ SELECT COUNT(*) FROM receipts → generate receipt_number "REC-XXXXX"
   ├─ INSERT INTO receipts (booking_id, receipt_number, amount, ...)
   └─ COMMIT TRANSACTION → return Ok(receipt_number)

5. RESPONSE RETURNS TO FRONTEND
   └─ receiptNo = "REC-00003"
      setSuccessMsg(...)
      setShowPartPaymentForm(false)
      await loadData() → refreshes all state from DB
      await invoke("get_booking_details_by_unit") → refreshes modal data
      Progress bar re-renders with new paid percentage (green segment grows)

6. PDF GENERATION (optional auto-print)
   └─ handlePrintReceipt(newReceiptItem) called
      Builds styled HTML string from receipt template (printRef DOM)
      await invoke("open_receipt_html", { html, filename })
      Rust: fs::write(appLocalDataDir/REC-00003.html, html)
      Rust: tauri_plugin_opener::open_path(file_path)
      System default browser opens → User can Cmd+P → Save as PDF
```

### 7.2 Startup Data Load

```
App mounts
  └─ useEffect → loadData()
       ├─ invoke("get_property_map")
       │    └─ Rust: SELECT projects → towers → units (3 nested queries)
       │         Returns: Project[] (hierarchical JSON)
       │         → setProjects(propertyMap)
       │
       └─ invoke("get_receipt_history")
            └─ Rust: 6-table JOIN (receipts → bookings → customers → units → projects → towers)
                 Returns: ReceiptHistoryItem[] (flat denormalized)
                 → setReceipts(history)
                 → setUniqueCombinations(deduplicated by booking key)
```

---

## 8. External Dependencies

| Package | Used For |
|---|---|
| `@tauri-apps/api` | `invoke()` IPC calls from JS |
| `tauri-plugin-opener` | Opens HTML file in system browser for print |
| `sqlx` (Rust) | Async SQLite queries with compile-time checked SQL |
| `serde / serde_json` (Rust) | Serialize/deserialize Rust structs ↔ JSON for IPC |
| `react` + `react-dom` | UI rendering |
| `tailwindcss` | Styling |
| `vite` + `@vitejs/plugin-react` | Frontend build toolchain |

> No cloud APIs, no authentication service, no telemetry. All data remains on the local machine.

---

## 9. Key Architectural Decisions & Trade-offs

| Decision | Rationale | Trade-off |
|---|---|---|
| **Single `App.tsx` monolith** | Fast prototyping, no routing overhead | Will need refactoring into components as feature count grows |
| **Offline-first SQLite** | Works without internet; data stays with user | No multi-user/sync capability |
| **Browser print for PDF** | Avoids heavy PDF library dependency in Rust | Requires an extra browser window; no silent print |
| **Frontend + Backend validation** | Belt-and-suspenders: catches errors before IPC, and again at DB boundary | Some duplication of rules (RTGS min, overpayment) |
| **Customer dedup by PAN** | Prevents duplicate customer records for same person | PAN is immutable; no merge strategy if PAN changes |
| **No ORM** | `sqlx` with raw SQL gives full control and compile-time safety | More verbose than an ORM |
| **Tauri over Electron** | ~10x smaller binary, native OS performance, Rust safety | Smaller ecosystem than Electron |
