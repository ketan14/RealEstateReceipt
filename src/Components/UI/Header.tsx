// src/components/layout/Header.tsx
interface HeaderProps {
    activeTab: string;
    onTabChange: (tab: "explorer" | "history" | "admin" | "customers" | "reports") => void;
}

export const Header = ({ activeTab, onTabChange }: HeaderProps) => {
    return (
        <header className="sticky top-0 z-40 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
            {/* Brand area remains same */}

            {/* Tab Controls */}
            <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
                {(["explorer", "history", "admin", "customers", "reports"] as const).map((tab) => (
                    <button
                        key={tab}
                        onClick={() => onTabChange(tab)}
                        className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${activeTab === tab
                            ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                            : "text-slate-400 hover:text-slate-200"
                            }`}
                    >
                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                ))}
            </div>
        </header>
    );
};