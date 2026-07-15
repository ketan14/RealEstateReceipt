// components/ledger/LedgerFilterBar.tsx
interface Props {
    searchQuery: string;
    onSearchChange: (val: string) => void;
    filterMode: string;
    onModeChange: (val: string) => void;
}

export const LedgerFilterBar = ({ searchQuery, onSearchChange, filterMode, onModeChange }: Props) => (
    <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-900 p-4 rounded-xl border border-slate-800">
        <div className="relative w-full md:max-w-sm">
            <input
                type="text"
                placeholder="Search receipt, customer, unit..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 pl-10 pr-4 py-2 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-200"
            />
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
            <span className="text-xs text-slate-400">Payment Mode:</span>
            <select
                value={filterMode}
                onChange={(e) => onModeChange(e.target.value)}
                className="bg-slate-950 border border-slate-800 px-3 py-2 rounded-xl text-xs text-slate-200"
            >
                <option value="All">All Modes</option>
                <option value="Cash">Cash</option>
                <option value="Cheque">Cheque</option>
                <option value="RTGS">RTGS</option>
                <option value="IMPS">IMPS</option>
            </select>
        </div>
    </div>
);