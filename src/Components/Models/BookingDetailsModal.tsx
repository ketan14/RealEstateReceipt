// src/components/modals/BookingDetailsModal.tsx

import { useState } from "react";
import { BookingDetails, Project, ReceiptHistoryItem, Unit } from "../../types";
import { printReceipt } from "../utils/receiptHandler";
import { invoke } from "@tauri-apps/api/core";
import { useAppStore } from "../../store/useAppStore";

interface BookingDetailsModalProps {
    isOpen: boolean;
    selectedUnit: Unit;
    bookingDetails: BookingDetails;
    projects: Project[];
    errorMsgFromModal: string | null;
    successMsgFromModal: string | null;
    setSuccessMsgFromModal: (msg: string | null) => void;
    setErrorMsgFromModal: (msg: string | null) => void;
    setIsDetailsOpenFromModal: (isOpen: boolean) => void;
    setBookingDetailsFromModal: (bookingDetails: BookingDetails | null) => void;
    onClose: () => void;
}

export const BookingDetailsModal = ({ isOpen, bookingDetails, selectedUnit, projects, errorMsgFromModal, successMsgFromModal, setSuccessMsgFromModal, setErrorMsgFromModal, setIsDetailsOpenFromModal, setBookingDetailsFromModal, onClose }: BookingDetailsModalProps) => {
    const [showPartPaymentForm, setShowPartPaymentForm] = useState(false);
    const [partAmount, setPartAmount] = useState("");
    const [partPaymentMode, setPartPaymentMode] = useState<"Cash" | "Cheque" | "RTGS" | "IMPS">("RTGS");
    const [partTransactionRef, setPartTransactionRef] = useState("");
    const [partPaymentDate, setPartPaymentDate] = useState(new Date().toISOString().split("T")[0]);

    const loadData = useAppStore((state) => state.loadData);

    const handlePartPaymentSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsgFromModal(null);
        setSuccessMsgFromModal(null);

        const amountVal = parseFloat(partAmount);
        if (isNaN(amountVal) || amountVal <= 0) {
            setErrorMsgFromModal("Payment amount must be a valid number greater than zero.");
            return;
        }

        if (!bookingDetails || !selectedUnit) return;

        const totalPaid = bookingDetails.receipts.reduce((acc, r) => acc + r.amount, 0);
        const outstanding = bookingDetails.agreed_sale_value - totalPaid;

        if (amountVal > outstanding + 0.01) {
            setErrorMsgFromModal(`Payment amount cannot exceed the outstanding balance of ₹${outstanding.toLocaleString("en-IN")}.`);
            return;
        }

        if (partPaymentMode !== "Cash" && !partTransactionRef.trim()) {
            setErrorMsgFromModal(`Transaction Reference number is required for ${partPaymentMode} mode.`);
            return;
        }

        try {
            //setLoading(true);
            const receiptNo: string = await invoke("create_additional_receipt", {
                bookingId: bookingDetails.id,
                amount: amountVal,
                paymentMode: partPaymentMode,
                transactionRef: partPaymentMode === "Cash" ? "CASH-PAY" : partTransactionRef.trim(),
                date: partPaymentDate,
            });

            setSuccessMsgFromModal(`Part payment recorded successfully! Receipt generated: ${receiptNo}`);
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
                rera_number: matchedProj?.rera_number || null,
                co_applicants: bookingDetails.co_applicants,
            };

            // Reload dataset
            await loadData();

            // Reload booking details
            const details: BookingDetails | null = await invoke("get_booking_details_by_unit", { unitId: selectedUnit.id });
            setBookingDetailsFromModal(details);
            // Print
            printReceipt(newReceiptItem);
        } catch (err: any) {
            console.error(err);
            setErrorMsgFromModal(err.toString() || "Transaction failed.");
        } finally {
            //setLoading(false);
        }
    };
    if (!isOpen) return null;

    return (
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
                                onClose();
                                setErrorMsgFromModal(null);
                                setSuccessMsgFromModal(null);
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

                            {bookingDetails.co_applicants && bookingDetails.co_applicants.filter(c => c.role === 'Co-Applicant').length > 0 && (
                                <div className="border-t border-slate-805 pt-3 mt-3 space-y-3">
                                    <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-455">Co-Applicant(s)</div>
                                    {bookingDetails.co_applicants.filter(c => c.role === 'Co-Applicant').map((co, idx) => (
                                        <div key={idx} className="grid grid-cols-2 gap-4 text-xs border-b border-slate-900 pb-2 last:border-b-0 last:pb-0">
                                            <div>
                                                <div className="text-[10px] text-slate-500 font-medium">Name</div>
                                                <div className="font-semibold text-slate-200 mt-0.5">{co.name}</div>
                                            </div>
                                            <div>
                                                <div className="text-[10px] text-slate-500 font-medium">Phone</div>
                                                <div className="font-semibold text-slate-200 mt-0.5">{co.phone}</div>
                                            </div>
                                            <div>
                                                <div className="text-[10px] text-slate-500 font-medium">PAN Number</div>
                                                <div className="font-semibold text-slate-200 uppercase mt-0.5">{co.pan_number}</div>
                                            </div>
                                            <div>
                                                <div className="text-[10px] text-slate-500 font-medium">Aadhaar Number</div>
                                                <div className="font-semibold text-slate-200 mt-0.5">XXXX XXXX {co.aadhaar_number.slice(-4)}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Receipts Listing */}
                        <div className="space-y-2">
                            <div className="text-xs font-bold uppercase tracking-wider text-slate-400 flex justify-between items-center">
                                <span>Receipt Ledger ({bookingDetails.receipts.length})</span>
                                <span className="text-[10px] text-slate-500 font-normal">Sorted oldest to newest</span>
                            </div>
                            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                                {bookingDetails.receipts.map((rec) => {
                                    const handlePrint = async () => {
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
                                            rera_number: matchedProj?.rera_number || null,
                                            co_applicants: bookingDetails.co_applicants,
                                        };
                                        // handlePrintReceipt(item);
                                        try {
                                            await printReceipt(item);
                                        } catch (err: any) {
                                            // You can now handle the error globally or locally
                                            setErrorMsgFromModal(err.message);
                                        }
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
                                            setErrorMsgFromModal(null);
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
                        {errorMsgFromModal && (
                            <span className="text-red-400 font-medium text-xs flex items-center gap-1.5">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-red-500 shrink-0">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                                </svg>
                                {errorMsgFromModal}
                            </span>
                        )}
                        {successMsgFromModal && (
                            <span className="text-emerald-400 font-medium text-xs flex items-center gap-1.5">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-emerald-500 shrink-0">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                {successMsgFromModal}
                            </span>
                        )}
                    </div>

                    <div className="flex gap-3">
                        {/* Main controls (only visible if inline form is NOT open) */}
                        {!showPartPaymentForm && (() => {
                            const totalPaid = bookingDetails.receipts.reduce((acc, r) => acc + r.amount, 0);
                            const outstanding = bookingDetails.agreed_sale_value - totalPaid;

                            function updateUnitStatus(id: number, arg1: string) {
                                throw new Error("Function not implemented.");
                            }

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
                                                setErrorMsgFromModal(null);
                                                setSuccessMsgFromModal(null);
                                            }}
                                            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white rounded-xl font-semibold shadow-lg shadow-indigo-600/30 transition-all text-xs flex items-center gap-1.5"
                                        >
                                            Record Part Payment
                                        </button>
                                    ) : selectedUnit.status === "Booked" ? (
                                        <button
                                            type="button"
                                            onClick={async () => {
                                                try {
                                                    await updateUnitStatus(selectedUnit.id, "Registered");
                                                    // Optional: Handle success message via a local state or a "toast"
                                                } catch (err: any) {
                                                    console.error(err);
                                                    setErrorMsgFromModal(err.toString() || "Failed to update unit status.");
                                                } finally {
                                                    //setLoading(false);
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
                                setIsDetailsOpenFromModal(false);
                                setErrorMsgFromModal(null);
                                setSuccessMsgFromModal(null);
                            }}
                            className="px-5 py-2.5 bg-slate-950 hover:bg-slate-850 active:bg-slate-900 border border-slate-800 text-slate-300 font-semibold rounded-xl transition-all text-xs"
                        >
                            Close details
                        </button>
                    </div>

                </div>

            </div>
        </div>
    );
};