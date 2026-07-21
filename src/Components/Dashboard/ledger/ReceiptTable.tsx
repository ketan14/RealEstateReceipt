import { GroupedReceipt } from "../../../types";
import { printReceipt } from "../../utils/receiptHandler";

// components/ledger/ReceiptTable.tsx
export const ReceiptTable = ({ groups, onPrint }: { groups: GroupedReceipt[], onPrint: (r: any) => void }) => (
    <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        <table className="w-full text-left">
            <thead>
                <tr className="bg-slate-950 text-slate-400 uppercase text-[10px] font-bold border-b border-slate-800">
                    <th className="px-6 py-4">Receipt Info</th>
                    <th className="px-6 py-4">Customer Details</th>
                    <th className="px-6 py-4">Property</th>
                    <th className="px-6 py-4 text-right">Agreed Value</th>
                    <th className="px-6 py-4 text-right">Total Paid</th>
                    <th className="px-6 py-4 text-center">Actions</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-sm">
                {groups.map((group) => (
                    <tr key={group.id} className="hover:bg-slate-850/30 transition-colors align-top">
                        {/* ... Map your group.all_receipts here ... */}

                        {/* Column 1: Stacked Receipt Numbers & Payment details inside this Group */}
                        <td className="px-6 py-4 max-w-[220px]">
                            <div className="space-y-3">
                                {group.all_receipts.map((receipt) => (
                                    <div key={receipt.receipt_id} className={`border-l-2 pl-2 ${receipt.status === 'Voided' ? 'border-red-500/40 opacity-70' : 'border-indigo-500/40'}`}>
                                        <div className={`font-bold text-xs ${receipt.status === 'Voided' ? 'text-slate-500 line-through' : 'text-slate-200'}`}>
                                            {receipt.receipt_number}
                                            {receipt.status === 'Voided' && <span className="ml-2 text-[9px] uppercase bg-red-900/30 text-red-400 px-1 rounded">Voided</span>}
                                        </div>
                                        <div className="text-[10px] text-slate-400 font-medium">{receipt.date}</div>
                                        <div className={`text-[10px] flex items-center gap-1 mt-0.5 ${receipt.status === 'Voided' ? 'text-red-400/70' : 'text-indigo-400'}`}>
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
                                {group.all_receipts.filter(r => r.status === 'Active').map((receipt) => (
                                    <button
                                        key={receipt.receipt_id}
                                        onClick={async () => {
                                            try {
                                                await printReceipt(receipt);
                                            } catch (err: any) {
                                                console.log("Print failed:", err);
                                            }
                                        }}
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
                ))}
            </tbody>
        </table>
    </div>
);