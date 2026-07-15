import React from 'react';
import { Unit } from '../../types';

interface UnitDetailsPanelProps {
    selectedUnit: Unit | null;
    onInitiateBooking: () => void;
    onViewDetails: () => void;
    stats: { bookingsCount: number; revenue: number };
}

export const UnitDetailsPanel = ({ selectedUnit, onInitiateBooking, onViewDetails, stats }: UnitDetailsPanelProps) => {
    return (
        <div className="space-y-6">
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-6">
                <h3 className="text-base font-bold text-slate-200">Property Information</h3>
                {selectedUnit ? (
                    <div className="space-y-4">
                        {/* ... (Unit Grid details content) ... */}
                        <button
                            onClick={selectedUnit.status === "Available" ? onInitiateBooking : onViewDetails}
                            className={`w-full py-3 rounded-xl font-semibold transition-all ${selectedUnit.status === "Available" ? "bg-indigo-600" : "bg-amber-600"}`}
                        >
                            {selectedUnit.status === "Available" ? "Initiate Booking" : "View Booking Details"}
                        </button>
                    </div>
                ) : (
                    <div className="text-xs text-slate-500 text-center py-8">Select an available unit...</div>
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