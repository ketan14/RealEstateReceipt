# Aether RealEstate ERP

A secure, offline-first real estate ERP and receipt generation desktop application built using enterprise-grade architecture.

---

## 🚀 Technology Stack

- **Frontend**: React (Vite), TypeScript, Tailwind CSS v4 (Integrated via `@tailwindcss/vite`).
- **Backend**: Native Rust (Tauri v2 framework).
- **Database**: SQLite database layer powered by async **SQLx** with enforced Foreign Keys and transactional integrity.

---

## 🛠️ Prerequisites

Before running the application, make sure your local environment has the following tools installed:

1. **Rust Toolchain**: Install via rustup:
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```
2. **Node.js (v18+) & npm**: Check your version:
   ```bash
   node -v && npm -v
   ```
3. **macOS Development Tools**: Ensure Xcode Command Line Tools are installed:
   ```bash
   xcode-select --install
   ```

---

## 💻 Running the App Locally

Follow these steps to bootstrap and launch the application in development mode:

### 1. Install Frontend Dependencies
From the root directory, run:
```bash
npm install
```

### 2. Run the Development Server
Launch the Tauri desktop window in development mode:
```bash
npm run tauri dev
```
This command compiles the Rust backend, starts the Vite frontend dev server, and spins up the native desktop application frame.

---

## 🏗️ Technical Architecture

### 1. SQLite Database (Data Layer)
- The SQLite database file is initialized dynamically on application startup inside the operating system's local app data directory:
  - **macOS**: `~/Library/Application Support/com.realestate.erp/real_estate_erp.db`
- **Schemas Enforced**: 
  - `projects`, `towers`, `units`, `customers`, `bookings`, and `receipts` tables with strict Foreign Key relationships (`ON DELETE CASCADE`).
- **Seeding**: The database is automatically seeded with dummy properties (Greenfield Heights & Golden Sands Villa) if the `projects` table is empty on first boot.

### 2. Tauri IPC Trust Boundary
The frontend communicates with the Rust backend *exclusively* via Tauri commands (no raw SQL runs on the frontend):
- `get_property_map`: Fetches the project-tower-unit hierarchy.
- `create_booking_and_receipt`: Processes a secure customer booking and initial payment receipt inside a single Rust database Transaction.
- `get_receipt_history`: Queries historical ledger items for search and reporting.

### 3. Production Build
To package the app as a standalone production desktop installer:
```bash
npm run tauri build
```
The compiled executable (`.app` or `.dmg` on macOS) will be generated inside `src-tauri/target/release/bundle/`.
