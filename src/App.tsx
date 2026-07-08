import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Project, Unit, BookingPayload, ReceiptHistoryItem, BookingDetails, GroupedReceipt } from "./types";
import "./App.css";
import AdminDashboard from "./Components/AdminMainComponent";

function App() {
  // Navigation & View State
  const [activeTab, setActiveTab] = useState<"explorer" | "history" | "admin">("explorer");
  const [projects, setProjects] = useState<Project[]>([]);
  const [receipts, setReceipts] = useState<ReceiptHistoryItem[]>([]);
  const [uniqueCombinations, setUniqueCombinations] = useState<ReceiptHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Selected details state
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [isBookingOpen, setIsBookingOpen] = useState(false);

  // Booking Form State
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerPan, setCustomerPan] = useState("");
  const [customerAadhaar, setCustomerAadhaar] = useState("");
  const [agreedSaleValue, setAgreedSaleValue] = useState("");
  const [receiptAmount, setReceiptAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState<"Cash" | "Cheque" | "RTGS" | "IMPS">("RTGS");
  const [transactionRef, setTransactionRef] = useState("");
  const [bookingDate, setBookingDate] = useState(new Date().toISOString().split("T")[0]);

  // History Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMode, setFilterMode] = useState<string>("All");

  // PDF Receipt State
  const [printingReceipt] = useState<ReceiptHistoryItem | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  // Subsequent/Part Payments State
  const [bookingDetails, setBookingDetails] = useState<BookingDetails | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [showPartPaymentForm, setShowPartPaymentForm] = useState(false);
  const [partAmount, setPartAmount] = useState("");
  const [partPaymentMode, setPartPaymentMode] = useState<"Cash" | "Cheque" | "RTGS" | "IMPS">("RTGS");
  const [partTransactionRef, setPartTransactionRef] = useState("");
  const [partPaymentDate, setPartPaymentDate] = useState(new Date().toISOString().split("T")[0]);


  // Load Data
  const loadData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const propertyMap: Project[] = await invoke("get_property_map");
      console.log("Loaded property map:", propertyMap);
      setProjects(propertyMap);
      const history: ReceiptHistoryItem[] = await invoke("get_receipt_history");

      const uniqueCombinations: ReceiptHistoryItem[] = history.filter(
        function (this: Set<string>, item) {
          const key = `${item.customer_name}_${item.unit_number}_${item.project_name}`;
          return this.has(key) ? false : this.add(key);
        },
        new Set<string>()
      );
      setReceipts(history);
      setUniqueCombinations(uniqueCombinations);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.toString() || "Failed to load data from backend.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Handle unit selection
  const selectUnitForBooking = async (unit: Unit) => {
    setSelectedUnit(unit);
    setErrorMsg(null);
    setSuccessMsg(null);
    setBookingDetails(null);
    setIsDetailsOpen(false);
    setShowPartPaymentForm(false);
    if (unit.status === "Available") {
      setAgreedSaleValue(unit.base_price.toString());
      setReceiptAmount((unit.base_price * 0.1).toString()); // Default 10% booking amount
      setIsBookingOpen(true);
    } else {
      setIsBookingOpen(false);
      try {
        setLoading(true);
        const details: BookingDetails | null = await invoke("get_booking_details_by_unit", { unitId: unit.id });
        setBookingDetails(details);
        setIsDetailsOpen(true);
      } catch (err: any) {
        console.error(err);
        setErrorMsg(err.toString() || "Failed to load booking details.");
      } finally {
        setLoading(false);
      }
    }
  };

  // Form Validations
  const validateForm = (): string | null => {
    if (!customerName.trim()) return "Customer Name is required.";
    if (!customerPhone.trim() || !/^\d{10}$/.test(customerPhone.trim())) {
      return "Customer Phone must be a valid 10-digit number.";
    }

    // PAN regex: 5 letters, 4 digits, 1 letter
    const cleanPan = customerPan.trim().toUpperCase();
    if (!cleanPan || !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(cleanPan)) {
      return "Invalid PAN Number format (e.g. ABCDE1234F).";
    }

    // Aadhaar: 12 digits, first digit must be 2–9 per UIDAI spec
    const cleanAadhaar = customerAadhaar.trim();
    if (!cleanAadhaar || !/^[2-9]\d{11}$/.test(cleanAadhaar)) {
      return "Invalid Aadhaar Number (must be exactly 12 digits and cannot start with 0 or 1).";
    }

    const saleVal = parseFloat(agreedSaleValue);
    const recVal = parseFloat(receiptAmount);

    if (isNaN(saleVal) || saleVal <= 0) {
      return "Agreed Sale Value must be a valid number greater than zero.";
    }
    if (isNaN(recVal) || recVal <= 0) {
      return "Receipt Amount must be a valid number greater than zero.";
    }
    if (recVal > saleVal) {
      return "Receipt/Booking Amount cannot exceed the Agreed Sale Value.";
    }
    if (paymentMode !== "Cash" && !transactionRef.trim()) {
      return `Transaction Reference number is required for ${paymentMode} mode.`;
    }

    return null;
  };

  // Handle submit
  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const valError = validateForm();
    if (valError) {
      setErrorMsg(valError);
      return;
    }

    if (!selectedUnit) return;

    const payload: BookingPayload = {
      customer: {
        name: customerName.trim(),
        phone: customerPhone.trim(),
        pan_number: customerPan.trim().toUpperCase(),
        aadhaar_number: customerAadhaar.trim(),
      },
      unit_id: selectedUnit.id,
      booking_date: bookingDate,
      agreed_sale_value: parseFloat(agreedSaleValue),
      receipt_amount: parseFloat(receiptAmount),
      payment_mode: paymentMode,
      transaction_ref: paymentMode === "Cash" ? "CASH-PAY" : transactionRef.trim(),
    };

    try {
      setLoading(true);
      const receiptNo: string = await invoke("create_booking_and_receipt", { payload });
      setSuccessMsg(`Booking created successfully! Receipt generated: ${receiptNo}`);
      setIsBookingOpen(false);
      setSelectedUnit(null);

      // Clear form
      setCustomerName("");
      setCustomerPhone("");
      setCustomerPan("");
      setCustomerAadhaar("");
      setTransactionRef("");

      // Reload dataset
      await loadData();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.toString() || "Transaction failed.");
    } finally {
      setLoading(false);
    }
  };

  const handlePartPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const amountVal = parseFloat(partAmount);
    if (isNaN(amountVal) || amountVal <= 0) {
      setErrorMsg("Payment amount must be a valid number greater than zero.");
      return;
    }

    if (!bookingDetails || !selectedUnit) return;

    const totalPaid = bookingDetails.receipts.reduce((acc, r) => acc + r.amount, 0);
    const outstanding = bookingDetails.agreed_sale_value - totalPaid;

    if (amountVal > outstanding + 0.01) {
      setErrorMsg(`Payment amount cannot exceed the outstanding balance of ₹${outstanding.toLocaleString("en-IN")}.`);
      return;
    }

    if (partPaymentMode !== "Cash" && !partTransactionRef.trim()) {
      setErrorMsg(`Transaction Reference number is required for ${partPaymentMode} mode.`);
      return;
    }

    try {
      setLoading(true);
      const receiptNo: string = await invoke("create_additional_receipt", {
        bookingId: bookingDetails.id,
        amount: amountVal,
        paymentMode: partPaymentMode,
        transactionRef: partPaymentMode === "Cash" ? "CASH-PAY" : partTransactionRef.trim(),
        date: partPaymentDate,
      });

      setSuccessMsg(`Part payment recorded successfully! Receipt generated: ${receiptNo}`);
      setShowPartPaymentForm(false);

      // Trigger automatic printing of the newly created receipt
      const matchedProj = projects.find((p) => p.id === selectedUnit.project_id);
      const matchedTower = matchedProj?.towers.find((t) => t.id === selectedUnit.tower_id);
      const newReceiptItem: ReceiptHistoryItem = {
        receipt_id: Date.now(), // dummy temporary id for printing
        receipt_number: receiptNo,
        amount: amountVal,
        payment_mode: partPaymentMode,
        transaction_ref: partPaymentMode === "Cash" ? "CASH-PAY" : partTransactionRef.trim(),
        date: partPaymentDate,
        booking_id: bookingDetails.id,
        agreed_sale_value: bookingDetails.agreed_sale_value,
        booking_date: bookingDetails.booking_date,
        customer_name: bookingDetails.customer_name,
        customer_phone: bookingDetails.customer_phone,
        customer_pan: bookingDetails.customer_pan,
        customer_aadhaar: bookingDetails.customer_aadhaar,
        unit_number: selectedUnit.unit_number,
        project_name: matchedProj?.name || "",
        tower_name: matchedTower?.name || "",
      };

      // Reload dataset
      await loadData();

      // Reload booking details
      const details: BookingDetails | null = await invoke("get_booking_details_by_unit", { unitId: selectedUnit.id });
      setBookingDetails(details);

      // Print
      handlePrintReceipt(newReceiptItem);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.toString() || "Transaction failed.");
    } finally {
      setLoading(false);
    }
  };

  // Build a standalone receipt HTML document for printing/PDF
  const buildReceiptHtml = (r: ReceiptHistoryItem): string => {
    const printDate = new Date().toLocaleDateString("en-IN", {
      day: "2-digit", month: "long", year: "numeric",
    });
    const balance = r.agreed_sale_value - r.amount;
    const txRef = r.transaction_ref === "CASH-PAY" ? "Cash Payment" : r.transaction_ref;
    const aadhaarMasked = `XXXX XXXX ${r.customer_aadhaar.slice(-4)}`;

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
      <div class="company-name">Aether RealEstate</div>
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
    </div>
    <div class="card">
      <div class="card-title">Property Details</div>
      <div class="field-label">Project</div>
      <div class="field-value">${r.project_name}</div>
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

  // Print receipt as PDF — uses Tauri backend to open in system browser
  // (window.print() is NOT supported inside Tauri's WKWebView on macOS)
  const handlePrintReceipt = async (item: ReceiptHistoryItem) => {
    try {
      const html = buildReceiptHtml(item);
      const filename = `receipt_${item.receipt_number}`;
      await invoke("open_receipt_html", { html, filename });
    } catch (err: any) {
      setErrorMsg(`Failed to open receipt: ${err}`);
    }
  };
  // Filtering receipts
  const filteredReceipts = receipts.filter((r) => {
    const matchesSearch =
      r.receipt_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.project_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.unit_number.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesMode = filterMode === "All" || r.payment_mode === filterMode;

    return matchesSearch && matchesMode;
  });
  // 2. Compute the grouped array
  const groupedReceipts = Object.values(
    filteredReceipts.reduce<Record<string, GroupedReceipt>>((acc, item) => {
      // Unique matching key requested by you
      const key = `${item.customer_name}_${item.unit_number}_${item.project_name}_${item.tower_name}`;

      if (!acc[key]) {
        acc[key] = {
          id: key,
          customer_name: item.customer_name,
          customer_phone: item.customer_phone,
          unit_number: item.unit_number,
          project_name: item.project_name,
          tower_name: item.tower_name,
          agreed_sale_value: item.agreed_sale_value, // Assuming identical for the same booking
          total_amount_paid: 0,
          all_receipts: [],
        };
      }

      // Accumulate total paid amount and push the receipt into sub-records
      acc[key].total_amount_paid += item.amount;
      acc[key].all_receipts.push(item);

      return acc;
    }, {})
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500 selection:text-white">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-lg text-white shadow-lg shadow-indigo-500/30">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-10.5l8.25-7.5 8.25 7.5M2.25 21v-7.5M21 21v-7.5m-9-10.5v18" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text">
              Sukirti Developers
            </h1>
            <p className="text-xs text-slate-400">Offline-First ERP Platform</p>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveTab("explorer")}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${activeTab === "explorer"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
              : "text-slate-400 hover:text-slate-200"
              }`}
          >
            Property Explorer
          </button>
          <button
            onClick={() => {
              setActiveTab("history");
              setSelectedUnit(null);
            }}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${activeTab === "history"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
              : "text-slate-400 hover:text-slate-200"
              }`}
          >
            Receipt Ledger
          </button>
          <button
            onClick={() => {
              setActiveTab("admin");
              setSelectedUnit(null);
            }}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${activeTab === "admin"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
              : "text-slate-400 hover:text-slate-200"
              }`}
          >
            Admin
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto p-6">
        {/* Banner messages */}
        {errorMsg && !isBookingOpen && (
          <div className="mb-6 p-4 rounded-xl bg-red-950/40 border border-red-500/50 text-red-200 flex items-start gap-3 animate-fade-in">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 mt-0.5 text-red-400 shrink-0">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            <div className="text-sm">
              <span className="font-semibold">Error Occurred:</span> {errorMsg}
            </div>
          </div>
        )}

        {successMsg && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/50 text-emerald-200 flex items-start gap-3 animate-fade-in">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 mt-0.5 text-emerald-400 shrink-0">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-sm font-semibold">{successMsg}</div>
          </div>
        )}

        {loading && (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
            <span className="ml-3 text-slate-400 text-sm">Processing securely...</span>
          </div>
        )}

        {/* Tab 1: Explorer */}
        {activeTab === "explorer" && !loading && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Cols: Project Map */}
            <div className="lg:col-span-2 space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-bold text-slate-200">Interactive Map</h2>
                <div className="flex items-center gap-4 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm bg-emerald-900 border border-emerald-500"></span>
                    <span className="text-slate-400">Available</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm bg-amber-900 border border-amber-500"></span>
                    <span className="text-slate-400">Booked</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm bg-purple-900 border border-purple-500"></span>
                    <span className="text-slate-400">Registered</span>
                  </div>
                </div>
              </div>

              {projects.length === 0 ? (
                <div className="p-8 rounded-xl bg-slate-900 border border-slate-800 text-center text-slate-400 text-sm">
                  No property data found.
                </div>
              ) : (
                projects.map((project) => (
                  <div key={project.id} className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-6 shadow-xl">
                    {/* Project Header */}
                    <div>
                      <h3 className="text-base font-bold text-slate-200">{project.name}</h3>
                      <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5 text-slate-500">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                        </svg>
                        {project.location}
                      </p>
                    </div>

                    {/* Towers */}
                    <div className="space-y-4">
                      {project?.towers?.map((tower) => (
                        <div key={tower.id} className="p-4 rounded-xl bg-slate-950/50 border border-slate-800/60 space-y-3">
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">{tower.name}</h4>

                          {/* Unit Grid */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                            {tower.units.map((unit) => {
                              const isSelected = selectedUnit?.id === unit.id;
                              const statusStyles = {
                                Available: "bg-emerald-950/20 hover:bg-emerald-950/40 border-emerald-500/50 text-emerald-400",
                                Booked: "bg-amber-950/20 hover:bg-amber-950/40 border-amber-500/50 text-amber-400 cursor-not-allowed",
                                Registered: "bg-purple-950/20 hover:bg-purple-950/40 border-purple-500/50 text-purple-400 cursor-not-allowed",
                              }[unit.status];

                              return (
                                <button
                                  key={unit.id}
                                  onClick={() => selectUnitForBooking(unit)}
                                  className={`p-3 rounded-lg border text-left flex flex-col justify-between transition-all duration-200 transform hover:-translate-y-0.5 active:scale-95 ${statusStyles} ${isSelected ? "ring-2 ring-indigo-500 scale-102 border-indigo-400 shadow-md shadow-indigo-500/10" : ""
                                    }`}
                                >
                                  <div className="flex justify-between items-start w-full">
                                    <span className="text-sm font-bold">{unit.unit_number}</span>
                                    <span className="text-[10px] font-medium bg-slate-800/80 px-1.5 py-0.5 rounded text-slate-300">
                                      {unit.configuration}
                                    </span>
                                  </div>
                                  <div className="mt-2 text-xs font-medium">
                                    ₹{(unit.base_price / 100000).toFixed(1)}L
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Right 1 Col: Context Panel */}
            <div className="space-y-6">
              {/* Selected Unit Details Panel */}
              <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-6">
                <h3 className="text-base font-bold text-slate-200">Property Information</h3>

                {selectedUnit ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80">
                        <div className="text-[10px] uppercase font-bold text-slate-500">Unit Number</div>
                        <div className="text-sm font-bold text-slate-200 mt-0.5">{selectedUnit.unit_number}</div>
                      </div>
                      <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80">
                        <div className="text-[10px] uppercase font-bold text-slate-500">Configuration</div>
                        <div className="text-sm font-bold text-slate-200 mt-0.5">{selectedUnit.configuration}</div>
                      </div>
                      <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80">
                        <div className="text-[10px] uppercase font-bold text-slate-500">Base Price</div>
                        <div className="text-sm font-bold text-emerald-400 mt-0.5">₹{selectedUnit.base_price.toLocaleString("en-IN")}</div>
                      </div>
                      <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80">
                        <div className="text-[10px] uppercase font-bold text-slate-500">Availability</div>
                        <div className={`text-xs font-semibold inline-block px-2 py-0.5 rounded mt-1.5 ${selectedUnit.status === "Available" ? "bg-emerald-950 text-emerald-300 border border-emerald-500/30" :
                          selectedUnit.status === "Booked" ? "bg-amber-950 text-amber-300 border border-amber-500/30" :
                            "bg-purple-950 text-purple-300 border border-purple-500/30"
                          }`}>
                          {selectedUnit.status}
                        </div>
                      </div>
                    </div>

                    {selectedUnit.status === "Available" ? (
                      <button
                        onClick={() => setIsBookingOpen(true)}
                        className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white rounded-xl font-semibold shadow-lg shadow-indigo-600/30 transition-all text-sm flex justify-center items-center gap-2"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                        Initiate Booking
                      </button>
                    ) : (
                      <button
                        onClick={() => setIsDetailsOpen(true)}
                        className="w-full py-3 bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white rounded-xl font-semibold shadow-lg shadow-amber-600/30 transition-all text-sm flex justify-center items-center gap-2"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        View Booking Details
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 text-center py-8">
                    Select an available unit from the map to trigger booking workflows.
                  </div>
                )}
              </div>

              {/* Quick Summary Widgets */}
              <div className="p-6 rounded-2xl bg-gradient-to-br from-indigo-950/30 to-slate-900 border border-indigo-900/30 shadow-xl">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Business Summary</h4>
                <div className="mt-4 grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-[10px] text-slate-500">Bookings (LTD)</div>
                    <div className="text-xl font-bold text-slate-200 mt-1">{uniqueCombinations.length}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500">Collected Revenue</div>
                    <div className="text-xl font-bold text-indigo-400 mt-1">
                      ₹{(receipts.reduce((acc, r) => acc + r.amount, 0) / 100000).toFixed(1)}L
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Ledger/History */}
        {activeTab === "history" && !loading && (
          <div className="space-y-6">
            {/* Filter Bar */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-900 p-4 rounded-xl border border-slate-800">
              {/* Search */}
              <div className="relative w-full md:max-w-sm">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-slate-500">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.604 10.604z" />
                  </svg>
                </span>
                <input
                  type="text"
                  placeholder="Search receipt, customer, unit..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 pl-10 pr-4 py-2 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-slate-200"
                />
              </div>

              {/* Mode filter */}
              <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                <span className="text-xs text-slate-400">Payment Mode:</span>
                <select
                  value={filterMode}
                  onChange={(e) => setFilterMode(e.target.value)}
                  className="bg-slate-950 border border-slate-850 px-3 py-2 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-200"
                >
                  <option value="All">All Modes</option>
                  <option value="Cash">Cash</option>
                  <option value="Cheque">Cheque</option>
                  <option value="RTGS">RTGS</option>
                  <option value="IMPS">IMPS</option>
                </select>
              </div>
            </div>

            {/* Receipts List */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-950 text-slate-400 uppercase text-[10px] font-bold tracking-wider border-b border-slate-800">
                      <th className="px-6 py-4">Receipt Info ({groupedReceipts.length} Groups)</th>
                      <th className="px-6 py-4">Customer Details</th>
                      <th className="px-6 py-4">Property</th>
                      <th className="px-6 py-4 text-right">Agreed Value</th>
                      <th className="px-6 py-4 text-right">Total Paid Amount</th>
                      <th className="px-6 py-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-sm">
                    {groupedReceipts.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                          No transactions found matching the criteria.
                        </td>
                      </tr>
                    ) : (
                      groupedReceipts.map((group) => (
                        <tr key={group.id} className="hover:bg-slate-850/30 transition-colors align-top">
                          {/* Column 1: Stacked Receipt Numbers & Payment details inside this Group */}
                          <td className="px-6 py-4 max-w-[220px]">
                            <div className="space-y-3">
                              {group.all_receipts.map((receipt) => (
                                <div key={receipt.receipt_id} className="border-l-2 border-indigo-500/40 pl-2">
                                  <div className="font-bold text-slate-200 text-xs">{receipt.receipt_number}</div>
                                  <div className="text-[10px] text-slate-400 font-medium">{receipt.date}</div>
                                  <div className="text-[10px] text-indigo-400 flex items-center gap-1 mt-0.5">
                                    <span className="px-1.5 py-0.5 bg-slate-950 border border-slate-800 rounded font-medium text-[9px]">
                                      {receipt.payment_mode}
                                    </span>
                                    <span className="text-slate-500 truncate max-w-[100px]" title={receipt.transaction_ref}>
                                      {receipt.transaction_ref}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </td>

                          {/* Column 2: Customer Details */}
                          <td className="px-6 py-4">
                            <div className="font-semibold text-slate-200">{group.customer_name}</div>
                            <div className="text-xs text-slate-400 mt-0.5">{group.customer_phone}</div>
                          </td>

                          {/* Column 3: Property Details */}
                          <td className="px-6 py-4">
                            <div className="font-medium text-slate-200">Unit {group.unit_number}</div>
                            <div className="text-xs text-slate-400 mt-0.5">
                              {group.project_name} • {group.tower_name}
                            </div>
                          </td>

                          {/* Column 4: Agreed Value */}
                          <td className="px-6 py-4 text-right text-slate-300 font-semibold">
                            ₹{group.agreed_sale_value.toLocaleString("en-IN")}
                          </td>

                          {/* Column 5: Aggregated Total Amount Paid */}
                          <td className="px-6 py-4 text-right text-emerald-400 font-bold">
                            ₹{group.total_amount_paid.toLocaleString("en-IN")}
                            {group.all_receipts.length > 1 && (
                              <div className="text-[10px] text-slate-500 font-normal mt-0.5">
                                Combined ({group.all_receipts.length} receipts)
                              </div>
                            )}
                          </td>

                          {/* Column 6: Print Actions (Renders print buttons stacked for each item) */}
                          <td className="px-6 py-4 text-center">
                            <div className="flex flex-col items-center gap-1.5">
                              {group.all_receipts.map((receipt) => (
                                <button
                                  key={receipt.receipt_id}
                                  onClick={() => handlePrintReceipt(receipt)}
                                  title={`Print ${receipt.receipt_number}`}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-600/20 hover:bg-indigo-600/40 border border-indigo-500/40 hover:border-indigo-400 text-indigo-300 hover:text-indigo-100 rounded text-[11px] font-medium transition-all duration-200 group w-full justify-center whitespace-nowrap"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3 h-3">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.75 19.5H17.25l-.72-5.671M6.72 13.829A9.006 9.006 0 0112 12.75c2.388 0 4.558.94 6.15 2.475" />
                                  </svg>
                                  Print {receipt.receipt_number.split("-")[1] || receipt.receipt_number}
                                </button>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
        {/* Tab 3: Admin */}
        {activeTab === "admin" && !loading && (
            <AdminDashboard />
        )}
      </main>

      {/* Booking Form Modal Overlay */}
      {isBookingOpen && selectedUnit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex justify-between items-center">
              <div>
                <h3 className="text-base font-bold text-slate-200">Generate Booking & Receipt</h3>
                <p className="text-xs text-slate-400 mt-0.5">Unit {selectedUnit.unit_number} • {selectedUnit.configuration}</p>
              </div>
              <button
                onClick={() => {
                  setIsBookingOpen(false);
                  setErrorMsg(null);
                }}
                className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-900/60"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleBookingSubmit} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
              {errorMsg && (
                <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/50 text-red-200 flex items-start gap-3 animate-fade-in text-xs">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-red-400 shrink-0">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                  <div>
                    <span className="font-semibold">Error:</span> {errorMsg}
                  </div>
                </div>
              )}
              {/* Section 1: Customer Profile */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-400 border-b border-slate-800 pb-1">Customer Profile</h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-400 font-medium">Name</label>
                    <input
                      type="text"
                      required
                      placeholder="Full Name"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 px-3.5 py-2 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-200"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-400 font-medium">Phone</label>
                    <input
                      type="tel"
                      required
                      placeholder="10-digit number"
                      maxLength={10}
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 px-3.5 py-2 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-200"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-400 font-medium">PAN Number</label>
                    <input
                      type="text"
                      required
                      maxLength={10}
                      placeholder="ABCDE1234F"
                      value={customerPan}
                      onChange={(e) => setCustomerPan(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 px-3.5 py-2 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-200 uppercase"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-400 font-medium">Aadhaar Card Number</label>
                    <input
                      type="text"
                      required
                      maxLength={12}
                      placeholder="12-digit UID"
                      value={customerAadhaar}
                      onChange={(e) => setCustomerAadhaar(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 px-3.5 py-2 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-200"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Financial Details */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-400 border-b border-slate-800 pb-1">Financial & Booking Details</h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-400 font-medium">Agreed Sale Value (₹)</label>
                    <input
                      type="number"
                      required
                      min={1}
                      placeholder="Total Value"
                      value={agreedSaleValue}
                      onChange={(e) => setAgreedSaleValue(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 px-3.5 py-2 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-200"
                    />
                    {parseFloat(agreedSaleValue) < selectedUnit.base_price && (
                      <span className="text-[10px] text-amber-400 font-medium">Value is below base price (₹{selectedUnit.base_price.toLocaleString()})</span>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-400 font-medium">Booking/Receipt Amount (₹)</label>
                    <input
                      type="number"
                      required
                      min={1}
                      placeholder="Amount Paid Now"
                      value={receiptAmount}
                      onChange={(e) => setReceiptAmount(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 px-3.5 py-2 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-200"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-400 font-medium">Payment Mode</label>
                    <select
                      value={paymentMode}
                      onChange={(e) => setPaymentMode(e.target.value as any)}
                      className="w-full bg-slate-950 border border-slate-800 px-3 py-2 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-200"
                    >
                      <option value="RTGS">RTGS</option>
                      <option value="IMPS">IMPS</option>
                      <option value="Cheque">Cheque</option>
                      <option value="Cash">Cash</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-400 font-medium">Booking Date</label>
                    <input
                      type="date"
                      required
                      value={bookingDate}
                      onChange={(e) => setBookingDate(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 px-3 py-2 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-200"
                    />
                  </div>
                </div>

                {paymentMode !== "Cash" && (
                  <div className="space-y-1.5 animate-fade-in">
                    <label className="text-xs text-slate-400 font-medium">Transaction Reference No / Cheque No</label>
                    <input
                      type="text"
                      required
                      placeholder="UTR / Ref Number"
                      value={transactionRef}
                      onChange={(e) => setTransactionRef(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 px-3.5 py-2 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-200"
                    />
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsBookingOpen(false);
                    setErrorMsg(null);
                  }}
                  className="flex-1 py-3 bg-slate-950 hover:bg-slate-850 active:bg-slate-900 border border-slate-800 text-slate-300 font-semibold rounded-xl transition-all text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-semibold rounded-xl shadow-lg shadow-indigo-600/20 transition-all text-sm"
                >
                  Confirm & Print Receipt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Booked Unit Details Modal Overlay */}
      {isDetailsOpen && selectedUnit && bookingDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in animate-duration-200">
          <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-scale-up">

            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex justify-between items-center shrink-0">
              <div>
                <h3 className="text-base font-bold text-slate-200">Booking Ledger & Details</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Unit {selectedUnit.unit_number} • {selectedUnit.configuration} • {
                    projects.find(p => p.id === selectedUnit.project_id)?.name
                  } ({
                    projects.find(p => p.id === selectedUnit.project_id)?.towers.find(t => t.id === selectedUnit.tower_id)?.name
                  })
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${selectedUnit.status === "Booked"
                  ? "bg-amber-950/50 border-amber-500/50 text-amber-300"
                  : "bg-purple-950/50 border-purple-500/50 text-purple-300"
                  }`}>
                  {selectedUnit.status}
                </span>
                <button
                  onClick={() => {
                    setIsDetailsOpen(false);
                    setErrorMsg(null);
                    setSuccessMsg(null);
                  }}
                  className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-900/60 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Content - Two-column Grid (Scrollable) */}
            <div className="p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-6">

              {/* Left Column: Customer Info & Receipt History */}
              <div className="space-y-6">

                {/* Customer Details Card */}
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 space-y-3 shadow-md">
                  <div className="text-xs font-bold uppercase tracking-wider text-indigo-400 border-b border-slate-800 pb-1">Customer Profile</div>
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <div className="text-[10px] text-slate-500 font-medium">Customer Name</div>
                      <div className="font-semibold text-slate-200 text-sm mt-0.5">{bookingDetails.customer_name}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500 font-medium">Contact Phone</div>
                      <div className="font-semibold text-slate-200 text-sm mt-0.5">{bookingDetails.customer_phone}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500 font-medium">PAN Number</div>
                      <div className="font-semibold text-slate-200 uppercase mt-0.5">{bookingDetails.customer_pan}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500 font-medium">Aadhaar Number</div>
                      <div className="font-semibold text-slate-200 mt-0.5">XXXX XXXX {bookingDetails.customer_aadhaar.slice(-4)}</div>
                    </div>
                  </div>
                </div>

                {/* Receipts Listing */}
                <div className="space-y-2">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-400 flex justify-between items-center">
                    <span>Receipt Ledger ({bookingDetails.receipts.length})</span>
                    <span className="text-[10px] text-slate-500 font-normal">Sorted oldest to newest</span>
                  </div>
                  <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                    {bookingDetails.receipts.map((rec) => {
                      const handlePrint = () => {
                        const matchedProj = projects.find((p) => p.id === selectedUnit.project_id);
                        const matchedTower = matchedProj?.towers.find((t) => t.id === selectedUnit.tower_id);
                        const item: ReceiptHistoryItem = {
                          receipt_id: rec.id,
                          receipt_number: rec.receipt_number,
                          amount: rec.amount,
                          payment_mode: rec.payment_mode,
                          transaction_ref: rec.transaction_ref,
                          date: rec.date,
                          booking_id: bookingDetails.id,
                          agreed_sale_value: bookingDetails.agreed_sale_value,
                          booking_date: bookingDetails.booking_date,
                          customer_name: bookingDetails.customer_name,
                          customer_phone: bookingDetails.customer_phone,
                          customer_pan: bookingDetails.customer_pan,
                          customer_aadhaar: bookingDetails.customer_aadhaar,
                          unit_number: selectedUnit.unit_number,
                          project_name: matchedProj?.name || "",
                          tower_name: matchedTower?.name || "",
                        };
                        handlePrintReceipt(item);
                      };

                      return (
                        <div key={rec.id} className="flex justify-between items-center bg-slate-950 hover:bg-slate-900 px-4 py-3 rounded-xl border border-slate-800/80 text-xs transition-colors">
                          <div>
                            <div className="font-bold text-slate-200">{rec.receipt_number}</div>
                            <div className="text-[10px] text-slate-400 mt-0.5">{rec.date} • {rec.payment_mode}</div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-emerald-400">₹{rec.amount.toLocaleString("en-IN")}</span>
                            <button
                              type="button"
                              onClick={handlePrint}
                              className="p-1.5 bg-indigo-950/40 hover:bg-indigo-900 border border-indigo-500/20 hover:border-indigo-500/40 rounded-lg text-indigo-400 hover:text-indigo-200 transition-colors"
                              title="Print Receipt PDF"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.75 19.5H17.25l-.72-5.671M6.72 13.829A9.006 9.006 0 0112 12.75c2.388 0 4.558.94 6.15 2.475" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>

              {/* Right Column: Financial Analysis & Progress Bar & Inline Form */}
              <div className="space-y-6 flex flex-col">

                {/* Financial Summary & Visualization */}
                {(() => {
                  const totalPaid = bookingDetails.receipts.reduce((acc, r) => acc + r.amount, 0);
                  const outstanding = bookingDetails.agreed_sale_value - totalPaid;

                  // Compute percentages
                  const paidPercentage = Math.min((totalPaid / bookingDetails.agreed_sale_value) * 100, 100);

                  // Compute preview percentage
                  const parsedPartAmount = parseFloat(partAmount);
                  const validPartAmount = !isNaN(parsedPartAmount) && parsedPartAmount > 0 && parsedPartAmount <= outstanding + 0.01;
                  const previewAmount = validPartAmount ? parsedPartAmount : 0;
                  const previewPercentage = Math.min((previewAmount / bookingDetails.agreed_sale_value) * 100, 100 - paidPercentage);
                  const pendingPercentage = Math.max(0, 100 - paidPercentage - previewPercentage);

                  return (
                    <div className="bg-slate-950 p-5 rounded-xl border border-slate-800/80 space-y-4 shadow-md">
                      <div className="text-xs font-bold uppercase tracking-wider text-indigo-400 border-b border-slate-800 pb-1">Payment Ledger</div>

                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Agreed Sale Value</span>
                          <span className="font-bold text-slate-200 text-sm">₹{bookingDetails.agreed_sale_value.toLocaleString("en-IN")}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Total Already Paid</span>
                          <span className="font-bold text-emerald-400 text-sm">₹{totalPaid.toLocaleString("en-IN")} ({paidPercentage.toFixed(1)}%)</span>
                        </div>
                        {previewAmount > 0 && (
                          <div className="flex justify-between text-indigo-400 font-semibold animate-pulse">
                            <span>New Payment Preview</span>
                            <span>+₹{previewAmount.toLocaleString("en-IN")} ({((previewAmount / bookingDetails.agreed_sale_value) * 100).toFixed(1)}%)</span>
                          </div>
                        )}
                        <div className="flex justify-between border-t border-slate-800/80 pt-2 text-slate-300">
                          <span>Outstanding Balance</span>
                          <span className={`font-bold text-sm ${outstanding - previewAmount > 0.01 ? "text-amber-400" : "text-emerald-500"}`}>
                            ₹{Math.max(0, outstanding - previewAmount).toLocaleString("en-IN")}
                          </span>
                        </div>
                      </div>

                      {/* Colored Segmented Progress Bar */}
                      <div className="space-y-2 pt-2">
                        <div className="flex justify-between text-[10px] text-slate-400 font-semibold">
                          <span>PAYMENT PROGRESS</span>
                          <span>{((totalPaid + previewAmount) / bookingDetails.agreed_sale_value * 100).toFixed(1)}%</span>
                        </div>

                        {/* Bar Track */}
                        <div className="w-full h-5 bg-slate-950 rounded-full overflow-hidden flex border border-slate-800">
                          {/* Paid Segment */}
                          {paidPercentage > 0 && (
                            <div
                              style={{ width: `${paidPercentage}%`, backgroundColor: "green" }}
                              className="h-full bg-gradient-to-r from-emerald-600 to-emerald-500 transition-all duration-300 relative group"
                              title={`Already Paid: ${paidPercentage.toFixed(1)}%`}
                            />
                          )}

                          {/* Preview Segment */}
                          {previewPercentage > 0 && (
                            <div
                              style={{ width: `${previewPercentage}%` }}
                              className="h-full bg-gradient-to-r from-indigo-600 to-indigo-500 animate-pulse transition-all duration-300 relative"
                              title={`Preview: ${previewPercentage.toFixed(1)}%`}
                            />
                          )}

                          {/* Pending Segment */}
                          {pendingPercentage > 0 && (
                            <div
                              style={{ width: `${pendingPercentage}%` }}
                              className="h-full bg-slate-800/60 transition-all duration-300"
                              title={`Pending: ${pendingPercentage.toFixed(1)}%`}
                            />
                          )}
                        </div>

                        {/* Legend */}
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[9px] text-slate-500 font-medium">
                          <div className="flex items-center gap-1">
                            <span className="w-2.5 h-2.5 rounded bg-emerald-500 block"></span>
                            <span>Paid (₹{totalPaid.toLocaleString("en-IN")})</span>
                          </div>
                          {previewAmount > 0 && (
                            <div className="flex items-center gap-1 text-indigo-400">
                              <span className="w-2.5 h-2.5 rounded bg-indigo-500 block animate-pulse"></span>
                              <span>Preview (₹{previewAmount.toLocaleString("en-IN")})</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1">
                            <span className="w-2.5 h-2.5 rounded bg-slate-800 block"></span>
                            <span>Pending (₹{Math.max(0, outstanding - previewAmount).toLocaleString("en-IN")})</span>
                          </div>
                        </div>
                      </div>

                    </div>
                  );
                })()}

                {/* Inline Part Payment Form */}
                {showPartPaymentForm && (
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 space-y-4 shadow-md animate-fade-in shrink-0">
                    <div className="text-xs font-bold uppercase tracking-wider text-indigo-400 border-b border-slate-800 pb-1">Enter Payment Details</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-400 font-medium">Amount to Pay (₹)</label>
                        <input
                          type="number"
                          required
                          min={1}
                          placeholder="Amount Paid Now"
                          value={partAmount}
                          onChange={(e) => setPartAmount(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-200"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-400 font-medium">Payment Mode</label>
                        <select
                          value={partPaymentMode}
                          onChange={(e) => setPartPaymentMode(e.target.value as any)}
                          className="w-full bg-slate-900 border border-slate-800 px-2 py-1.5 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-200"
                        >
                          <option value="RTGS">RTGS</option>
                          <option value="IMPS">IMPS</option>
                          <option value="Cheque">Cheque</option>
                          <option value="Cash">Cash</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-400 font-medium">Payment Date</label>
                        <input
                          type="date"
                          required
                          value={partPaymentDate}
                          onChange={(e) => setPartPaymentDate(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 px-2 py-1.5 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-200"
                        />
                      </div>
                      {partPaymentMode !== "Cash" && (
                        <div className="space-y-1 sm:col-span-2">
                          <label className="text-[10px] text-slate-400 font-medium">Transaction Reference No / Cheque No</label>
                          <input
                            type="text"
                            required
                            placeholder="UTR / Ref Number"
                            value={partTransactionRef}
                            onChange={(e) => setPartTransactionRef(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-200"
                          />
                        </div>
                      )}
                    </div>

                    <div className="flex gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShowPartPaymentForm(false);
                          setErrorMsg(null);
                        }}
                        className="flex-1 py-2 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 font-semibold rounded-lg transition-all text-xs"
                      >
                        Cancel Form
                      </button>
                      <button
                        type="button"
                        onClick={handlePartPaymentSubmit}
                        className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-semibold rounded-lg shadow-md shadow-indigo-600/20 transition-all text-xs"
                      >
                        Submit Payment
                      </button>
                    </div>
                  </div>
                )}

              </div>

            </div>

            {/* Modal Footer Actions */}
            <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex justify-between items-center shrink-0">

              {/* Alert error panel inside modal */}
              <div className="max-w-[50%] overflow-hidden truncate">
                {errorMsg && (
                  <span className="text-red-400 font-medium text-xs flex items-center gap-1.5">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-red-500 shrink-0">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                    </svg>
                    {errorMsg}
                  </span>
                )}
                {successMsg && (
                  <span className="text-emerald-400 font-medium text-xs flex items-center gap-1.5">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-emerald-500 shrink-0">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {successMsg}
                  </span>
                )}
              </div>

              <div className="flex gap-3">
                {/* Main controls (only visible if inline form is NOT open) */}
                {!showPartPaymentForm && (() => {
                  const totalPaid = bookingDetails.receipts.reduce((acc, r) => acc + r.amount, 0);
                  const outstanding = bookingDetails.agreed_sale_value - totalPaid;

                  return (
                    <>
                      {outstanding > 0.01 ? (
                        <button
                          type="button"
                          onClick={() => {
                            setPartAmount(outstanding.toString());
                            setPartTransactionRef("");
                            setPartPaymentMode("RTGS");
                            setShowPartPaymentForm(true);
                            setErrorMsg(null);
                            setSuccessMsg(null);
                          }}
                          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white rounded-xl font-semibold shadow-lg shadow-indigo-600/30 transition-all text-xs flex items-center gap-1.5"
                        >
                          Record Part Payment
                        </button>
                      ) : selectedUnit.status === "Booked" ? (
                        <button
                          type="button"
                          onClick={async () => {
                            //if (confirm(`Mark Unit ${selectedUnit.unit_number} as Registered?`)) {
                              try {
                                setLoading(true);
                                await invoke("update_unit_status", { unitId: selectedUnit.id, status: "Registered" });
                                setSuccessMsg(`Unit ${selectedUnit.unit_number} updated to Registered successfully.`);

                                // Reload map
                                const propertyMap: Project[] = await invoke("get_property_map");
                                setProjects(propertyMap);
                                // update selection state
                                const updatedUnit = propertyMap
                                  .flatMap(p => p.towers.flatMap(t => t.units))
                                  .find(u => u.id === selectedUnit.id);
                                if (updatedUnit) {
                                  setSelectedUnit(updatedUnit);
                                  const details: BookingDetails | null = await invoke("get_booking_details_by_unit", { unitId: updatedUnit.id });
                                  setBookingDetails(details);
                                }
                              } catch (err: any) {
                                console.error(err);
                                setErrorMsg(err.toString() || "Failed to update unit status.");
                              } finally {
                                setLoading(false);
                              }
                            //}
                          }}
                          className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 active:bg-purple-700 text-white rounded-xl font-semibold shadow-lg shadow-purple-600/30 transition-all text-xs flex items-center gap-1.5"
                        >
                          Mark as Registered
                        </button>
                      ) : null}
                    </>
                  );
                })()}

                <button
                  type="button"
                  onClick={() => {
                    setIsDetailsOpen(false);
                    setErrorMsg(null);
                    setSuccessMsg(null);
                  }}
                  className="px-5 py-2.5 bg-slate-950 hover:bg-slate-850 active:bg-slate-900 border border-slate-800 text-slate-300 font-semibold rounded-xl transition-all text-xs"
                >
                  Close details
                </button>
              </div>

            </div>

          </div>
        </div>
      )}


      {/* ============================================================
          HIDDEN RECEIPT PRINT TEMPLATE
          Rendered when printingReceipt is set; only visible on print
          ============================================================ */}
      <div
        id="receipt-print-area"
        ref={printRef}
        style={{ display: "none" }}
      >
        {printingReceipt && (() => {
          const r = printingReceipt;
          const printDate = new Date().toLocaleDateString("en-IN", {
            day: "2-digit", month: "long", year: "numeric"
          });
          const balance = r.agreed_sale_value - r.amount;

          return (
            <div style={{
              fontFamily: "'Segoe UI', Arial, sans-serif",
              color: "#111827",
              background: "#ffffff",
              maxWidth: "750px",
              margin: "0 auto",
              padding: "40px 48px",
              position: "relative",
              minHeight: "100vh",
              boxSizing: "border-box",
            }}>
              {/* Watermark */}
              <div className="receipt-watermark">RECEIPT</div>

              {/* Company Header */}
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                borderBottom: "3px solid #4f46e5",
                paddingBottom: "20px",
                marginBottom: "28px",
              }}>
                <div>
                  <div style={{
                    fontSize: "26px",
                    fontWeight: "800",
                    color: "#4f46e5",
                    letterSpacing: "-0.5px",
                    lineHeight: 1,
                  }}>
                    Aether RealEstate
                  </div>
                  <div style={{ fontSize: "11px", color: "#6b7280", marginTop: "4px" }}>
                    Offline-First Real Estate ERP • Secure &amp; Certified
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "11px", color: "#6b7280" }}>Receipt No.</div>
                  <div style={{ fontSize: "18px", fontWeight: "700", color: "#111827" }}>
                    {r.receipt_number}
                  </div>
                  <div style={{ fontSize: "11px", color: "#6b7280", marginTop: "4px" }}>
                    Issued: {printDate}
                  </div>
                </div>
              </div>

              {/* Status Badge */}
              <div style={{
                display: "inline-block",
                background: "#ecfdf5",
                border: "1.5px solid #10b981",
                color: "#065f46",
                fontSize: "11px",
                fontWeight: "700",
                padding: "4px 14px",
                borderRadius: "20px",
                marginBottom: "28px",
                letterSpacing: "0.5px",
                textTransform: "uppercase",
              }}>
                ✓ Payment Received
              </div>

              {/* Two-column layout: Customer + Property */}
              <div style={{ display: "flex", gap: "32px", marginBottom: "28px" }}>
                {/* Customer Section */}
                <div style={{
                  flex: 1,
                  background: "#f9fafb",
                  border: "1px solid #e5e7eb",
                  borderRadius: "10px",
                  padding: "18px 20px",
                }}>
                  <div style={{
                    fontSize: "10px",
                    fontWeight: "700",
                    color: "#4f46e5",
                    textTransform: "uppercase",
                    letterSpacing: "1px",
                    marginBottom: "14px",
                    paddingBottom: "8px",
                    borderBottom: "1px solid #e5e7eb",
                  }}>
                    Customer Details
                  </div>
                  {[
                    ["Full Name", r.customer_name],
                    ["Phone", r.customer_phone],
                    ["PAN Number", r.customer_pan],
                    ["Aadhaar Number", `XXXX XXXX ${r.customer_aadhaar.slice(-4)}`],
                  ].map(([label, value]) => (
                    <div key={label} style={{ marginBottom: "10px" }}>
                      <div style={{ fontSize: "10px", color: "#9ca3af", fontWeight: "600" }}>{label}</div>
                      <div style={{ fontSize: "13px", color: "#111827", fontWeight: "600", marginTop: "2px" }}>{value}</div>
                    </div>
                  ))}
                </div>

                {/* Property Section */}
                <div style={{
                  flex: 1,
                  background: "#f9fafb",
                  border: "1px solid #e5e7eb",
                  borderRadius: "10px",
                  padding: "18px 20px",
                }}>
                  <div style={{
                    fontSize: "10px",
                    fontWeight: "700",
                    color: "#4f46e5",
                    textTransform: "uppercase",
                    letterSpacing: "1px",
                    marginBottom: "14px",
                    paddingBottom: "8px",
                    borderBottom: "1px solid #e5e7eb",
                  }}>
                    Property Details
                  </div>
                  {[
                    ["Project", r.project_name],
                    ["Tower / Block", r.tower_name],
                    ["Unit Number", r.unit_number],
                    ["Booking Date", r.booking_date || r.date],
                  ].map(([label, value]) => (
                    <div key={label} style={{ marginBottom: "10px" }}>
                      <div style={{ fontSize: "10px", color: "#9ca3af", fontWeight: "600" }}>{label}</div>
                      <div style={{ fontSize: "13px", color: "#111827", fontWeight: "600", marginTop: "2px" }}>{value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Financial Breakdown Table */}
              <div style={{
                border: "1px solid #e5e7eb",
                borderRadius: "10px",
                overflow: "hidden",
                marginBottom: "28px",
              }}>
                <div style={{
                  background: "#4f46e5",
                  color: "#ffffff",
                  padding: "12px 20px",
                  fontSize: "10px",
                  fontWeight: "700",
                  textTransform: "uppercase",
                  letterSpacing: "1px",
                }}>
                  Payment Summary
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <tbody>
                    {[
                      ["Agreed Sale Value", `₹${r.agreed_sale_value.toLocaleString("en-IN")}`, false],
                      ["Amount Paid (This Receipt)", `₹${r.amount.toLocaleString("en-IN")}`, false],
                      ["Payment Mode", r.payment_mode, false],
                      ["Transaction Reference", r.transaction_ref === "CASH-PAY" ? "Cash Payment" : r.transaction_ref, false],
                      ["Balance Outstanding", `₹${balance.toLocaleString("en-IN")}`, true],
                    ].map(([label, value, highlight]) => (
                      <tr key={String(label)} style={{
                        background: highlight ? "#eff6ff" : "transparent",
                        borderTop: "1px solid #e5e7eb",
                      }}>
                        <td style={{
                          padding: "12px 20px",
                          fontSize: "12px",
                          color: highlight ? "#1e40af" : "#4b5563",
                          fontWeight: highlight ? "700" : "500",
                        }}>{String(label)}</td>
                        <td style={{
                          padding: "12px 20px",
                          fontSize: "13px",
                          color: highlight ? "#1d4ed8" : "#111827",
                          fontWeight: "700",
                          textAlign: "right",
                        }}>{String(value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Amount in Bold */}
              <div style={{
                background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
                borderRadius: "12px",
                padding: "20px 24px",
                marginBottom: "28px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}>
                <div>
                  <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.7)", fontWeight: "600" }}>AMOUNT PAID</div>
                  <div style={{ fontSize: "28px", fontWeight: "900", color: "#ffffff", lineHeight: 1.1 }}>
                    ₹{r.amount.toLocaleString("en-IN")}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.7)" }}>Receipt Date</div>
                  <div style={{ fontSize: "14px", fontWeight: "700", color: "#ffffff" }}>{r.date}</div>
                </div>
              </div>

              {/* Footer / Legal Note */}
              <div style={{
                borderTop: "1px solid #e5e7eb",
                paddingTop: "16px",
                fontSize: "10px",
                color: "#9ca3af",
                lineHeight: "1.6",
              }}>
                <strong style={{ color: "#6b7280" }}>Note:</strong> This is a computer-generated receipt and does not require a physical signature.
                This receipt is valid subject to realization of payment. For queries, please contact the sales office with this receipt number.
                <br />
                <strong style={{ color: "#6b7280" }}>Aether RealEstate ERP</strong> — Confidential Document
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

export default App;
