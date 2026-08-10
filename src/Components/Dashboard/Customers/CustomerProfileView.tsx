import { CustomerProfile } from "../../../types";

interface CustomerProfileViewProps {
    profile: CustomerProfile;
}

export const CustomerProfileView = ({ profile }: CustomerProfileViewProps) => {
    const { customer, properties, grand_total_agreed, grand_total_paid, grand_total_outstanding } = profile;

    const formatInr = (amount: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        }).format(amount);
    };

    return (
        <div className="p-6">
            {/* Header: Customer Info */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                        <div className="w-12 h-12 bg-indigo-600 rounded-full flex items-center justify-center text-xl font-black shadow-lg shadow-indigo-600/20">
                            {customer.name.charAt(0).toUpperCase()}
                        </div>
                        {customer.name}
                    </h1>
                </div>
                <div className="flex gap-4 text-sm bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <div>
                        <div className="text-slate-500 font-medium text-xs uppercase tracking-wider mb-1">Contact</div>
                        <div className="text-slate-200 font-mono">{customer.phone}</div>
                    </div>
                    <div className="w-px bg-slate-800"></div>
                    <div>
                        <div className="text-slate-500 font-medium text-xs uppercase tracking-wider mb-1">PAN</div>
                        <div className="text-slate-200 font-mono">{customer.pan_number}</div>
                    </div>
                </div>
            </div>

            {/* Consolidated Ledger Totals */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <div className="bg-slate-800/50 rounded-2xl p-5 border border-slate-700/50">
                    <div className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-slate-400"></div>
                        Total Portfolio Value
                    </div>
                    <div className="text-2xl font-bold text-white">{formatInr(grand_total_agreed)}</div>
                </div>
                <div className="bg-emerald-900/20 rounded-2xl p-5 border border-emerald-800/30">
                    <div className="text-emerald-400 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                        Total Amount Paid
                    </div>
                    <div className="text-2xl font-bold text-emerald-400">{formatInr(grand_total_paid)}</div>
                </div>
                <div className="bg-rose-900/20 rounded-2xl p-5 border border-rose-800/30">
                    <div className="text-rose-400 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-rose-500"></div>
                        Total Outstanding
                    </div>
                    <div className="text-2xl font-bold text-rose-400">{formatInr(grand_total_outstanding)}</div>
                </div>
            </div>

            {/* Properties List */}
            <h3 className="text-lg font-bold text-white mb-4 border-b border-slate-800 pb-2">Properties ({properties.length})</h3>
            
            {properties.length === 0 ? (
                <div className="text-slate-500 italic">No properties found for this customer.</div>
            ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    {properties.map((prop) => {
                        const progress = prop.agreed_sale_value > 0 
                            ? Math.min(100, (prop.total_paid / prop.agreed_sale_value) * 100) 
                            : 0;

                        return (
                            <div key={prop.booking_id} className="bg-slate-950/50 border border-slate-800 rounded-xl p-5 relative overflow-hidden group hover:border-slate-700 transition-colors">
                                {/* Role Badge */}
                                <div className={`absolute top-0 right-0 px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-bl-lg ${
                                    prop.role === 'Primary' ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-300'
                                }`}>
                                    {prop.role}
                                </div>

                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <div className="text-2xl font-black text-white">{prop.unit_number}</div>
                                        <div className="text-sm text-slate-400 font-medium mt-1">
                                            {prop.project_name} &bull; {prop.tower_name}
                                        </div>
                                    </div>
                                    <div className="text-right mt-1">
                                        <div className="text-sm font-semibold text-white">{formatInr(prop.agreed_sale_value)}</div>
                                        <div className="text-xs text-slate-500">Agreed Value</div>
                                    </div>
                                </div>

                                {/* Progress Bar */}
                                <div className="mb-4">
                                    <div className="flex justify-between text-xs font-medium mb-2">
                                        <span className="text-emerald-400">Paid: {formatInr(prop.total_paid)}</span>
                                        <span className="text-rose-400">Due: {formatInr(prop.outstanding_balance)}</span>
                                    </div>
                                    <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                                        <div 
                                            className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full"
                                            style={{ width: `${progress}%` }}
                                        ></div>
                                    </div>
                                </div>
                                
                                {/* Receipts List */}
                                {prop.receipts && prop.receipts.length > 0 && (
                                    <div className="mt-4 pt-4 border-t border-slate-800">
                                        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Receipts</div>
                                        <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                                            {prop.receipts.map((r) => (
                                                <div key={r.id} className="flex justify-between items-center text-sm bg-slate-900 p-2 rounded-lg border border-slate-800">
                                                    <div>
                                                        <div className="text-slate-200 font-mono text-xs">{r.receipt_number}</div>
                                                        <div className="text-slate-500 text-xs">{r.date} &bull; {r.payment_mode}</div>
                                                    </div>
                                                    <div className={`font-semibold ${r.status === 'Active' ? 'text-emerald-400' : 'text-slate-500 line-through'}`}>
                                                        {formatInr(r.amount)}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
