import { useState } from "react";
import { BookingPayload, Unit } from "../../types";
import { validateForm } from "../utils/validators";
import { invoke } from "@tauri-apps/api/core";
import { useAppStore } from "../../store/useAppStore";

interface BookingModelProps {
    isOpen: boolean;
    selectedUnit: Unit;
    onClose: () => void;
    setSuccessMessageFromModal: (msg: string) => void;
    setErrorMsgFromModal: (msg: string) => void;
    setSelectedUnitFromModal: (unit: Unit | null) => void;
}

// src/components/modals/BookingModal.tsx
export const BookingModal = ({ isOpen, selectedUnit, onClose, setSuccessMessageFromModal, setErrorMsgFromModal, setSelectedUnitFromModal }: BookingModelProps) => {
    // Booking Form State
    const [customerName, setCustomerName] = useState("");
    const [customerPhone, setCustomerPhone] = useState("");
    const [customerPan, setCustomerPan] = useState("");
    const [customerAadhaar, setCustomerAadhaar] = useState("");
    const [coApplicants, setCoApplicants] = useState<{ name: string; phone: string; pan_number: string; aadhaar_number: string }[]>([]);
    const [agreedSaleValue, setAgreedSaleValue] = useState("");
    const [receiptAmount, setReceiptAmount] = useState("");
    const [paymentMode, setPaymentMode] = useState<"Cash" | "Cheque" | "RTGS" | "IMPS">("RTGS");
    const [transactionRef, setTransactionRef] = useState("");
    const [bookingDate, setBookingDate] = useState(new Date().toISOString().split("T")[0]);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const loadData = useAppStore((state) => state.loadData);


    // Handle submit
    const handleBookingSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg(null);
        setSuccessMessageFromModal("");

        const valError = validateForm(customerName, customerPhone, customerPan, customerAadhaar, coApplicants, agreedSaleValue, receiptAmount, paymentMode, transactionRef);
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
            co_applicants: coApplicants.map(co => ({
                name: co.name.trim(),
                phone: co.phone.trim(),
                pan_number: co.pan_number.trim().toUpperCase(),
                aadhaar_number: co.aadhaar_number.trim(),
            })),
            unit_id: selectedUnit.id,
            booking_date: bookingDate,
            agreed_sale_value: parseFloat(agreedSaleValue),
            receipt_amount: parseFloat(receiptAmount),
            payment_mode: paymentMode,
            transaction_ref: paymentMode === "Cash" ? "CASH-PAY" : transactionRef.trim(),
        };

        try {
            //setLoading(true);
            const receiptNo: string = await invoke("create_booking_and_receipt", { payload });
            setSuccessMessageFromModal(`Booking created successfully! Receipt generated: ${receiptNo}`);
            onClose();
            setSelectedUnitFromModal(null);
            // Clear form
            setCustomerName("");
            setCustomerPhone("");
            setCustomerPan("");
            setCustomerAadhaar("");
            setCoApplicants([]);
            setTransactionRef("");
            // Reload dataset
            await loadData();
        } catch (err: any) {
            console.error(err);
            setErrorMsgFromModal(err.toString() || "Transaction failed.");
        } finally {
            //setLoading(false);
        }
    };


    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
            <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
                {/* Modal Header */}
                <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex justify-between items-center">
                    <div>
                        <h3 className="text-base font-bold text-slate-200">Generate Booking & Receipt</h3>
                        <p className="text-xs text-slate-400 mt-0.5">
                            {selectedUnit.projectName} • {selectedUnit.towerName} • Unit {selectedUnit.unit_number}
                            <span className="text-slate-500"> • </span>
                            {selectedUnit.configuration}
                        </p>

                    </div>
                    <button
                        onClick={() => {
                            setErrorMsg(null);
                            onClose()
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

                        {/* Co-Applicants Section */}
                        <div className="space-y-4 pt-3 border-t border-slate-800/60 mt-4">
                            <div className="flex justify-between items-center">
                                <h5 className="text-xs font-bold text-slate-350">Joint Owners / Co-Applicants</h5>
                                <button
                                    type="button"
                                    onClick={() => setCoApplicants([...coApplicants, { name: "", phone: "", pan_number: "", aadhaar_number: "" }])}
                                    className="px-2.5 py-1 text-xs bg-indigo-950/40 hover:bg-indigo-900 border border-indigo-500/20 hover:border-indigo-500/40 text-indigo-300 hover:text-indigo-200 rounded-lg transition-colors flex items-center gap-1 font-semibold"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                    </svg>
                                    Add Co-Applicant
                                </button>
                            </div>

                            {coApplicants.length > 0 && (
                                <div className="space-y-4">
                                    {coApplicants.map((co, index) => (
                                        <div key={index} className="p-4 rounded-xl bg-slate-950/40 border border-slate-800/85 relative space-y-3 animate-fade-in">
                                            <button
                                                type="button"
                                                onClick={() => setCoApplicants(coApplicants.filter((_, i) => i !== index))}
                                                className="absolute top-3 right-3 text-slate-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-slate-900 transition-colors"
                                                title="Remove Co-applicant"
                                            >
                                                <svg xmlns="http://www.w3.org/2500/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                            </button>

                                            <h6 className="text-[10px] font-bold text-indigo-400 uppercase tracking-wide">Co-Applicant #{index + 1}</h6>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                                                <div className="space-y-1">
                                                    <label className="text-[10px] text-slate-400 font-medium">Name</label>
                                                    <input
                                                        type="text"
                                                        required
                                                        placeholder="Co-applicant Name"
                                                        value={co.name}
                                                        onChange={(e) => {
                                                            const updated = [...coApplicants];
                                                            updated[index].name = e.target.value;
                                                            setCoApplicants(updated);
                                                        }}
                                                        className="w-full bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-200"
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[10px] text-slate-400 font-medium">Phone</label>
                                                    <input
                                                        type="tel"
                                                        required
                                                        maxLength={10}
                                                        placeholder="10-digit number"
                                                        value={co.phone}
                                                        onChange={(e) => {
                                                            const updated = [...coApplicants];
                                                            updated[index].phone = e.target.value;
                                                            setCoApplicants(updated);
                                                        }}
                                                        className="w-full bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-200"
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[10px] text-slate-400 font-medium">PAN Number</label>
                                                    <input
                                                        type="text"
                                                        required
                                                        maxLength={10}
                                                        placeholder="ABCDE1234F"
                                                        value={co.pan_number}
                                                        onChange={(e) => {
                                                            const updated = [...coApplicants];
                                                            updated[index].pan_number = e.target.value;
                                                            setCoApplicants(updated);
                                                        }}
                                                        className="w-full bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-200 uppercase"
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[10px] text-slate-400 font-medium">Aadhaar Number</label>
                                                    <input
                                                        type="text"
                                                        required
                                                        maxLength={12}
                                                        placeholder="12-digit UID"
                                                        value={co.aadhaar_number}
                                                        onChange={(e) => {
                                                            const updated = [...coApplicants];
                                                            updated[index].aadhaar_number = e.target.value;
                                                            setCoApplicants(updated);
                                                        }}
                                                        className="w-full bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-200"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
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
                                //setIsBookingOpen(false);
                                //setErrorMsg(null);
                                onClose()
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
    );
};
