import { Project, Unit } from '../../types';
import { LoadingSpinner } from '../UI/StatusMessages';

interface PropertyMapProps {
    projects: Project[];
    expandedTowers: number[];
    selectedUnit: Unit | null;
    loading: boolean;
    toggleTower: (towerId: number) => void;
    selectUnitForBooking: (unit: Unit) => void;
}

export const PropertyMap = ({ projects, expandedTowers, selectedUnit, loading, toggleTower, selectUnitForBooking }: PropertyMapProps) => {
    return (
        <div className="lg:col-span-2 space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-lg font-bold text-slate-200">Interactive Map</h2>
                {/* ... (Legend div stays here) ... */}
            </div>
            {loading && <LoadingSpinner />}
            {!loading && projects.length === 0 ? (
                <div className="p-8 rounded-xl bg-slate-900 border border-slate-800 text-center text-slate-400 text-sm">
                    No property data found.
                </div>
            ) : (
                <div className="space-y-6">
                    {projects.map((project) => (
                        <div key={project.id} className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-6 shadow-xl">
                            <h3 className="text-base font-bold text-slate-200">{project.name}</h3>
                            <p className="text-xs text-slate-400">{project.location}</p>

                            <div className="space-y-4">
                                {project.towers.map((tower) => (
                                    <div key={tower.id} className="p-4 rounded-xl bg-slate-950/50 border border-slate-800/60">
                                        <button onClick={() => toggleTower(tower.id)} className="w-full flex justify-between items-center text-xs font-semibold uppercase tracking-wider text-slate-400">
                                            <span>{tower.name}</span>
                                            <svg className={`w-4 h-4 transition-transform ${expandedTowers.includes(tower.id) ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M19 9l-7 7-7-7" /></svg>
                                        </button>
                                        {expandedTowers.includes(tower.id) && (
                                            <div className="flex flex-wrap gap-4 p-4">
                                                {tower.units.map((unit) => {
                                                    const isSelected = selectedUnit?.id === unit.id;
                                                    const statusStyles = {
                                                        Available:
                                                            "bg-emerald-950/20 hover:bg-emerald-950/40 border-emerald-500/50 text-emerald-400",
                                                        Booked:
                                                            "bg-amber-950/20 hover:bg-amber-950/40 border-amber-500/50 text-amber-400 cursor-not-allowed",
                                                        Registered:
                                                            "bg-purple-950/20 hover:bg-purple-950/40 border-purple-500/50 text-purple-400 cursor-not-allowed",
                                                    }[unit.status];

                                                    return (
                                                        <button
                                                            key={unit.id}
                                                            onClick={() => selectUnitForBooking(unit)}
                                                            className={`flex-1 min-w-[200px] max-w-[250px] rounded-xl bg-slate-900 border border-slate-700 shadow-md p-4 flex flex-col justify-between rounded-xl bg-slate-900 border border-slate-700 shadow-md p-4 flex flex-col justify-between transition-all duration-200 transform hover:-translate-y-0.5 active:scale-95 ${statusStyles} ${isSelected
                                                                ? "ring-2 ring-indigo-500 scale-102 border-indigo-400 shadow-md shadow-indigo-500/10"
                                                                : ""
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
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};