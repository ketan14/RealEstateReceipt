import { ReceiptHistoryItem } from "../../types";

// Build a standalone receipt HTML document for printing/PDF
export const buildReceiptHtml = (r: ReceiptHistoryItem): string => {
  const printDate = new Date().toLocaleDateString("en-IN", {
    day: "2-digit", month: "long", year: "numeric",
  });
  const balance = r.agreed_sale_value - r.amount;
  const txRef = r.transaction_ref === "CASH-PAY" ? "Cash Payment" : r.transaction_ref;
  const aadhaarMasked = `XXXX XXXX ${r.customer_aadhaar.slice(-4)}`;

  const coApplicantsHtml = r.co_applicants && r.co_applicants.length > 0
    ? r.co_applicants.filter(co => co.role === 'Co-Applicant').map((co, idx) => `
        <div style="margin-top: 14px; border-top: 1px dashed #e5e7eb; padding-top: 10px;">
          <div class="field-label">Co-Applicant ${idx + 1}</div>
          <div class="field-value">${co.name}</div>
          <div class="field-label">PAN / Aadhaar</div>
          <div class="field-value">${co.pan_number} / XXXX XXXX ${co.aadhaar_number.slice(-4)}</div>
        </div>
      `).join('')
    : '';

  const reraHtml = r.rera_number
    ? `
      <div class="field-label">RERA Registration</div>
      <div class="field-value">${r.rera_number}</div>
      `
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Receipt ${r.receipt_number}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      color: #111827;
      background: #fff;
      padding: 48px;
      max-width: 800px;
      margin: 0 auto;
    }
    @media print {
      body { padding: 0; }
      @page { margin: 0.5in; size: A4 portrait; }
      .no-print { display: none !important; }
    }
    .print-btn {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 24px;
    }
    .print-btn button {
      background: #4f46e5;
      color: #fff;
      border: none;
      padding: 10px 24px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      letter-spacing: 0.3px;
    }
    .print-btn button:hover { background: #4338ca; }
    /* Header */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 3px solid #4f46e5;
      padding-bottom: 18px;
      margin-bottom: 24px;
    }
    .company-name { font-size: 26px; font-weight: 800; color: #4f46e5; line-height: 1; }
    .company-sub  { font-size: 11px; color: #6b7280; margin-top: 4px; }
    .receipt-no-label { font-size: 11px; color: #6b7280; text-align: right; }
    .receipt-no       { font-size: 18px; font-weight: 700; text-align: right; }
    .issued           { font-size: 11px; color: #6b7280; text-align: right; margin-top: 4px; }
    /* Badge */
    .badge {
      display: inline-block;
      background: #ecfdf5;
      border: 1.5px solid #10b981;
      color: #065f46;
      font-size: 11px;
      font-weight: 700;
      padding: 4px 14px;
      border-radius: 20px;
      margin-bottom: 24px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    /* Two-col cards */
    .cards { display: flex; gap: 24px; margin-bottom: 24px; }
    .card {
      flex: 1;
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 10px;
      padding: 16px 18px;
    }
    .card-title {
      font-size: 10px;
      font-weight: 700;
      color: #4f46e5;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid #e5e7eb;
    }
    .field-label { font-size: 10px; color: #9ca3af; font-weight: 600; margin-bottom: 2px; }
    .field-value { font-size: 13px; color: #111827; font-weight: 600; margin-bottom: 10px; }
    /* Payment table */
    .pay-table-wrap {
      border: 1px solid #e5e7eb;
      border-radius: 10px;
      overflow: hidden;
      margin-bottom: 24px;
    }
    .pay-table-head {
      background: #4f46e5;
      color: #fff;
      padding: 10px 18px;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    table { width: 100%; border-collapse: collapse; }
    td { padding: 11px 18px; font-size: 12px; border-top: 1px solid #e5e7eb; }
    .td-label { color: #4b5563; font-weight: 500; }
    .td-value { color: #111827; font-weight: 700; text-align: right; }
    .highlight td { background: #eff6ff; color: #1e40af; font-weight: 700; }
    /* Amount banner */
    .amount-banner {
      background: linear-gradient(135deg, #4f46e5, #7c3aed);
      border-radius: 12px;
      padding: 18px 22px;
      margin-bottom: 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      color: #fff;
    }
    .amount-label  { font-size: 11px; opacity: 0.75; font-weight: 600; }
    .amount-value  { font-size: 28px; font-weight: 900; line-height: 1.1; }
    .date-label    { font-size: 11px; opacity: 0.75; text-align: right; }
    .date-value    { font-size: 14px; font-weight: 700; text-align: right; }
    /* Footer */
    .footer {
      border-top: 1px solid #e5e7eb;
      padding-top: 14px;
      font-size: 10px;
      color: #9ca3af;
      line-height: 1.7;
    }
    .footer strong { color: #6b7280; }
  </style>
</head>
<body>
  <!-- Print button (hidden when printing) -->
  <div class="print-btn no-print">
    <button onclick="window.print()">🖨️ Save as PDF / Print</button>
  </div>

  <!-- Header -->
  <div class="header">
    <div>
      <div class="company-name">Sukirti Developers</div>
      <div class="company-sub">Offline-First Real Estate ERP &bull; Secure &amp; Certified</div>
    </div>
    <div>
      <div class="receipt-no-label">Receipt No.</div>
      <div class="receipt-no">${r.receipt_number}</div>
      <div class="issued">Issued: ${printDate}</div>
    </div>
  </div>

  <!-- Status Badge -->
  <div class="badge">&#10003; Payment Received</div>

  <!-- Customer + Property Cards -->
  <div class="cards">
    <div class="card">
      <div class="card-title">Customer Details</div>
      <div class="field-label">Full Name</div>
      <div class="field-value">${r.customer_name}</div>
      <div class="field-label">Phone</div>
      <div class="field-value">${r.customer_phone}</div>
      <div class="field-label">PAN Number</div>
      <div class="field-value">${r.customer_pan}</div>
      <div class="field-label">Aadhaar Number</div>
      <div class="field-value">${aadhaarMasked}</div>
      ${coApplicantsHtml}
    </div>
    <div class="card">
      <div class="card-title">Property Details</div>
      <div class="field-label">Project</div>
      <div class="field-value">${r.project_name}</div>
      ${reraHtml}
      <div class="field-label">Tower / Block</div>
      <div class="field-value">${r.tower_name}</div>
      <div class="field-label">Unit Number</div>
      <div class="field-value">${r.unit_number}</div>
      <div class="field-label">Booking Date</div>
      <div class="field-value">${r.booking_date || r.date}</div>
    </div>
  </div>

  <!-- Payment Summary -->
  <div class="pay-table-wrap">
    <div class="pay-table-head">Payment Summary</div>
    <table>
      <tr><td class="td-label">Agreed Sale Value</td><td class="td-value">&#8377;${r.agreed_sale_value.toLocaleString("en-IN")}</td></tr>
      <tr><td class="td-label">Amount Paid (This Receipt)</td><td class="td-value">&#8377;${r.amount.toLocaleString("en-IN")}</td></tr>
      <tr><td class="td-label">Payment Mode</td><td class="td-value">${r.payment_mode}</td></tr>
      <tr><td class="td-label">Transaction Reference</td><td class="td-value">${txRef}</td></tr>
      <tr class="highlight"><td class="td-label">Balance Outstanding</td><td class="td-value">&#8377;${balance.toLocaleString("en-IN")}</td></tr>
    </table>
  </div>

  <!-- Amount Banner -->
  <div class="amount-banner">
    <div>
      <div class="amount-label">AMOUNT PAID</div>
      <div class="amount-value">&#8377;${r.amount.toLocaleString("en-IN")}</div>
    </div>
    <div>
      <div class="date-label">Receipt Date</div>
      <div class="date-value">${r.date}</div>
    </div>
  </div>

  <!-- Footer -->
  <div class="footer">
    <strong>Note:</strong> This is a computer-generated receipt and does not require a physical signature.
    This receipt is valid subject to realization of payment. For queries, contact the sales office with this receipt number.<br/>
    <strong>Aether RealEstate ERP</strong> &mdash; Confidential Document
  </div>
</body>
</html>`;
};