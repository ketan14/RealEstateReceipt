import { Unit } from '../../types';

interface UnitDetailsPanelProps {
    selectedUnit: Unit | null;
    setIsBookingOpenFromParent: (msg: boolean) => void;
    setIsDetailsOpenFromParent: (msg: boolean) => void;
    stats: { bookingsCount: number; revenue: number };
}

export const UnitDetailsPanel = ({ selectedUnit, setIsBookingOpenFromParent,
    setIsDetailsOpenFromParent, stats }: UnitDetailsPanelProps) => {
    return (
        <div className="space-y-6">
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
                                onClick={() => setIsBookingOpenFromParent(true)}
                                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white rounded-xl font-semibold shadow-lg shadow-indigo-600/30 transition-all text-sm flex justify-center items-center gap-2"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                </svg>
                                Initiate Booking
                            </button>
                        ) : (
                            <button
                                onClick={() => setIsDetailsOpenFromParent(true)}
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
                    <div><div className="text-[10px] text-slate-500">Bookings</div><div className="text-xl font-bold">{stats.bookingsCount}</div></div>
                    <div><div className="text-[10px] text-slate-500">Revenue</div><div className="text-xl font-bold text-indigo-400">₹{(stats.revenue / 100000).toFixed(1)}L</div></div>
                </div>
            </div>
        </div>
    );
};