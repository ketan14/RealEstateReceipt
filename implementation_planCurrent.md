# Tier 3 Implementation Plan — Sukirti Developers Real Estate ERP

> **Status**: Planning & Requirements Alignment
> **Scope**: Tier 3 Medium Priority Features (Payment Schedules, GST/TDS Tax Rules, Executive Reporting Dashboard, Advanced Search & Filtering)

---

## Executive Summary & Requirements Alignment

With **Tier 1 (Security & Data Integrity)** and **Tier 2 (Admin CRUD & Architectural Refactoring)** successfully completed in earlier milestones, the application foundation is robust and secure. 

**Tier 3** focuses on transforming the application into a full-fledged Real Estate ERP by incorporating statutory compliance (GST/TDS), structured payment workflows (installment milestones), executive financial analytics, and enhanced inventory discovery.

Below is the detailed alignment of Tier 3 requirements and the step-by-step implementation blueprint.

---

## User Review Required

> [!IMPORTANT]
> **GST Statutory Rules Verification**
> GST logic for Indian Real Estate requires exact tax treatment:
> 1. **Under-Construction Sales**: 1% GST (affordable) vs 5% GST (non-affordable) with a mandatory **1/3rd Land Abatement** (Taxable Value = 2/3 of Sale Value).
> 2. **Affordable Housing Criteria**: Price ≤ ₹45L **AND** Carpet Area ≤ 60 sqm (Metro) / 90 sqm (Non-Metro).
> 3. **Exempt Sales**: Properties sold after receiving an Occupancy Certificate (OC).
> 4. **TDS (Sec 194-IA)**: 1% TDS applicable if property agreed sale value ≥ ₹50L (deducted by buyer).
> 
> *Please confirm if CGST + SGST (0.5%+0.5% or 2.5%+2.5%) breakdown needs to be explicitly itemized on customer receipts.*

> [!WARNING]
> **Payment Schedule Re-calculation Policy**
> If a unit's agreed sale value is modified during booking amendment, payment schedule milestone amounts must either automatically recalculate proportionally or trigger a prompt for manual adjustment.

---

## Open Questions

> [!IMPORTANT]
> 1. **Default Milestone Templates**: Would you like pre-configured payment schedule templates (e.g., *Construction-Linked Plan (CLP)*, *Down-Payment Plan (10:80:10)*, *Time-Linked Plan*) when creating a booking?
> 2. **Overdue Interest / Reminders**: Should the overdue tracking in the Reporting Dashboard support configurable interest penalty rates or reminder notification tags?

---

## Proposed Changes & Feature Breakdown

### Component 1: Payment Schedule & Installment Plans (Item 3.1)

#### [MODIFY] [db.rs](file:///Users/ketan/Live/RealEstateReceipt/src-tauri/src/db.rs)
- Verify `payment_schedules` schema created in Migration 008.
- Ensure foreign key constraints cascade cleanly on booking deletion.

#### [MODIFY] [commands.rs](file:///Users/ketan/Live/RealEstateReceipt/src-tauri/src/commands.rs)
- Implement `create_payment_schedule` command: bulk insert milestone definitions linked to `booking_id`.
- Implement `get_payment_schedule` command: fetch milestones sorted by due date / sequence.
- Implement `update_milestone_status` command: manual status override (`Pending`, `Partially Paid`, `Paid`, `Overdue`).
- Implement automatic receipt-to-milestone reconciliation logic when new receipts are recorded.

#### [NEW] [PaymentScheduleModal.tsx](file:///Users/ketan/Live/RealEstateReceipt/src/Components/Dashboard/PaymentScheduleModal.tsx)
- Modal wizard allowing sales staff to generate payment milestones at booking time (by percentage or fixed amounts).

#### [NEW] [PaymentScheduleTracker.tsx](file:///Users/ketan/Live/RealEstateReceipt/src/Components/Dashboard/PaymentScheduleTracker.tsx)
- Visual progress bar and milestone list embedded in `UnitDetailsPanel` and `CustomerProfileView`.

---

### Component 2: GST & TDS Automated Engine (Item 3.2)

#### [MODIFY] [commands.rs](file:///Users/ketan/Live/RealEstateReceipt/src-tauri/src/commands.rs)
- Implement GST determination function `calculate_gst_and_tds`:
  - Input: `agreed_sale_value`, `receipt_amount`, `carpet_area_sqm`, `is_metro`, `occupancy_certificate_date`, `receipt_date`.
  - Determines if OC date exists and is prior to receipt date → Rate = `0.0%` (Exempt, "OC Received").
  - Else checks if `agreed_sale_value` <= ₹4,500,000 and carpet area threshold met → Rate = `1.0%` (No ITC).
  - Else → Rate = `5.0%` (No ITC).
  - Computes `taxable_value = receipt_amount * (2.0 / 3.0)` (1/3 land deduction).
  - Computes `gst_amount = taxable_value * (gst_rate / 100.0)`.
  - Computes `tds_amount` if `agreed_sale_value` >= ₹5,000,000 (1% of receipt amount).
- Integrate `calculate_gst_and_tds` inside `create_booking_and_receipt` and `create_additional_receipt`.

#### [MODIFY] [AdminProjects.tsx](file:///Users/ketan/Live/RealEstateReceipt/src/Components/AdminProjects.tsx)
- Add input fields for `is_metro` (checkbox) and `occupancy_certificate_date` (date picker) in Project Create/Edit forms.

#### [MODIFY] [AdminUnits.tsx](file:///Users/ketan/Live/RealEstateReceipt/src/Components/AdminUnits.tsx)
- Add `carpet_area_sqm` numeric field in Unit Create/Edit/Bulk-Insert modal forms.

#### [MODIFY] [receiptTemplate.ts](file:///Users/ketan/Live/RealEstateReceipt/src/Components/utils/receiptTemplate.ts)
- Update HTML print template to include formal Tax Invoice section showing:
  - Base Payment Amount
  - Statutory 1/3 Land Abatement Deduction
  - Taxable Base Value
  - CGST % & Amount + SGST % & Amount
  - Total GST Charged & GST Computation Basis note
  - Statutory TDS (Sec 194-IA) applicability notice

---

### Component 3: Executive Reporting Dashboard (Item 3.3)

#### [MODIFY] [commands.rs](file:///Users/ketan/Live/RealEstateReceipt/src-tauri/src/commands.rs)
- Implement `get_financial_dashboard_stats`:
  - Returns total agreed sales, total collected, outstanding receivables, overdue amounts.
  - Project-wise breakdown of revenue and inventory absorption rate (% sold).
  - Monthly collection timeline data for forecasting charts.
- Implement `get_overdue_milestones_report`:
  - Queries all `payment_schedules` where `due_date < current_date` and `status != 'Paid'`.

#### [NEW] [ReportsTab.tsx](file:///Users/ketan/Live/RealEstateReceipt/src/Components/Dashboard/ReportsTab.tsx)
- Main Analytics & Reports view accessible from top tab navigation.
- Key Financial Stat Cards (Total Revenue, Total Cash Collected, Total Receivables, Overdue Balance).
- Project-wise Revenue Distribution charts/cards.
- Interactive Overdue Milestone Tracker with direct links to Customer Profile views.
- Export report data to CSV/Excel.

---

### Component 4: Property Explorer Search & Filter Improvements (Item 3.4)

#### [MODIFY] [PropertyExplorer.tsx](file:///Users/ketan/Live/RealEstateReceipt/src/Components/Dashboard/PropertyExplorer.tsx)
- Add Filter Toolbar with:
  - Configuration selector (All, 1BHK, 2BHK, 3BHK, 4BHK, Villa).
  - Price Range inputs (Min Price – Max Price).
  - Status selector (All, Available, Booked, Registered).
  - Search bar (Filter by unit number or tower name in real-time).
- Active filter counts and "Clear Filters" action.

---

## Verification Plan

### Automated & Manual Verification
1. **GST/TDS Calculation Accuracy**:
   - Test Unit under 45L + carpet area <= 60 sqm in Metro project -> Verify 1% GST computed on 2/3rd taxable value.
   - Test Unit over 45L -> Verify 5% GST computed on 2/3rd taxable value.
   - Test Project with completed OC date -> Verify GST rate is 0% (Exempt).
   - Test Booking over 50L -> Verify TDS note & calculation present.
2. **Payment Schedule Flow**:
   - Create booking with custom 5-stage milestone schedule.
   - Record partial payment -> verify status updates from `Pending` to `Partially Paid`.
   - Verify overdue milestone highlighting when `due_date` is in the past.
3. **Executive Dashboard**:
   - Cross-check sum of active receipts against Dashboard "Total Cash Collected".
   - Verify overdue payments table accurately flags past due milestones.
4. **Search & Filter**:
   - Test property grid filtering across configurations and price ranges.
