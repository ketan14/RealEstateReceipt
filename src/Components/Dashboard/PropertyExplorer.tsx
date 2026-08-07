import React, { useState, useMemo } from 'react';
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

export const PropertyMap: React.FC<PropertyMapProps> = ({
  projects,
  expandedTowers,
  selectedUnit,
  loading,
  toggleTower,
  selectUnitForBooking,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedConfig, setSelectedConfig] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [maxPrice, setMaxPrice] = useState<number | ''>('');

  // Extract unique configurations across all units
  const configurations = useMemo(() => {
    const set = new Set<string>();
    projects.forEach((p) =>
      p.towers.forEach((t) =>
        t.units.forEach((u) => {
          if (u.configuration) set.add(u.configuration);
        })
      )
    );
    return Array.from(set).sort();
  }, [projects]);

  // Filter projects, towers, and units based on search & filter state
  const filteredProjects = useMemo(() => {
    return projects
      .map((project) => {
        const filteredTowers = project.towers
          .map((tower) => {
            const filteredUnits = tower.units.filter((unit) => {
              // Search term matching
              if (
                searchTerm &&
                !unit.unit_number.toLowerCase().includes(searchTerm.toLowerCase()) &&
                !tower.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
                !project.name.toLowerCase().includes(searchTerm.toLowerCase())
              ) {
                return false;
              }
              // Configuration filter
              if (selectedConfig !== 'ALL' && unit.configuration !== selectedConfig) {
                return false;
              }
              // Status filter
              if (selectedStatus !== 'ALL' && unit.status !== selectedStatus) {
                return false;
              }
              // Max Price filter
              if (maxPrice !== '' && unit.base_price > Number(maxPrice)) {
                return false;
              }
              return true;
            });

            return { ...tower, units: filteredUnits };
          })
          .filter((t) => t.units.length > 0);

        return { ...project, towers: filteredTowers };
      })
      .filter((p) => p.towers.length > 0);
  }, [projects, searchTerm, selectedConfig, selectedStatus, maxPrice]);

  const hasActiveFilters = searchTerm !== '' || selectedConfig !== 'ALL' || selectedStatus !== 'ALL' || maxPrice !== '';

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedConfig('ALL');
    setSelectedStatus('ALL');
    setMaxPrice('');
  };

  return (
    <div className="lg:col-span-2 space-y-6">
      <div className="flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-bold text-slate-200">Interactive Inventory Map</h2>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 underline"
            >
              Clear Filters
            </button>
          )}
        </div>

        {/* Filter Control Bar */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          {/* Search bar */}
          <div>
            <label className="block text-slate-400 font-medium mb-1">Search Unit / Tower</label>
            <input
              type="text"
              placeholder="e.g. 101, Tower A..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Configuration */}
          <div>
            <label className="block text-slate-400 font-medium mb-1">Configuration</label>
            <select
              value={selectedConfig}
              onChange={(e) => setSelectedConfig(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="ALL">All Layouts</option>
              {configurations.map((cfg) => (
                <option key={cfg} value={cfg}>
                  {cfg}
                </option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="block text-slate-400 font-medium mb-1">Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="Available">Available</option>
              <option value="Booked">Booked</option>
              <option value="Registered">Registered</option>
            </select>
          </div>

          {/* Max Price */}
          <div>
            <label className="block text-slate-400 font-medium mb-1">Max Price (INR)</label>
            <input
              type="number"
              placeholder="e.g. 9000000"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value ? Number(e.target.value) : '')}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>
      </div>

      {loading && <LoadingSpinner />}
      {!loading && filteredProjects.length === 0 ? (
        <div className="p-8 rounded-xl bg-slate-900 border border-slate-800 text-center text-slate-400 text-sm">
          No matching properties found. Try clearing filters.
        </div>
      ) : (
        <div className="space-y-6 ">
          {filteredProjects.map((project) => (
            <div key={project.id} className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-6 shadow-xl">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-base font-bold text-slate-200">{project.name}</h3>
                  <p className="text-xs text-slate-400">{project.location}</p>
                </div>
                {project.is_metro && (
                  <span className="text-[10px] font-bold bg-indigo-950 text-indigo-400 border border-indigo-800 px-2 py-0.5 rounded-full uppercase">
                    Metro
                  </span>
                )}
              </div>

              <div className="space-y-4 flex gap-1">
                {project.towers.map((tower) => {
                  const isExpanded = expandedTowers.includes(tower.id) || hasActiveFilters;
                  return (
                    <div key={tower.id} className="p-4 rounded-xl bg-slate-950/50 border border-slate-800/60">
                      <button
                        onClick={() => toggleTower(tower.id)}
                        className="w-full flex justify-between items-center text-xs font-semibold uppercase tracking-wider text-slate-400"
                      >
                        <span>
                          {tower.name} ({tower.units.length} units)
                        </span>
                        <svg
                          className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                        >
                          <path d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      {isExpanded && (
                        <div className="flex flex-wrap gap-4 p-4">
                          {tower.units.map((unit) => {
                            const isSelected = selectedUnit?.id === unit.id;
                            const statusStyles = {
                              Available: 'bg-emerald-950/20 hover:bg-emerald-950/40 border-emerald-500/50 text-emerald-400',
                              Booked: 'bg-amber-950/20 hover:bg-amber-950/40 border-amber-500/50 text-amber-400 cursor-not-allowed',
                              Registered: 'bg-purple-950/20 hover:bg-purple-950/40 border-purple-500/50 text-purple-400 cursor-not-allowed',
                            }[unit.status];

                            return (
                              <button
                                key={unit.id}
                                onClick={() => selectUnitForBooking(unit)}
                                className={`flex-1 min-w-[200px] max-w-[250px] rounded-xl bg-slate-900 border border-slate-700 shadow-md p-4 flex flex-col justify-between transition-all duration-200 transform hover:-translate-y-0.5 active:scale-95 ${statusStyles} ${isSelected ? 'ring-2 ring-indigo-500 scale-102 border-indigo-400 shadow-md shadow-indigo-500/10' : ''
                                  }`}
                              >
                                <div className="flex justify-between items-start w-full">
                                  <span className="text-sm font-bold">{unit.unit_number}</span>
                                  <span className="text-[10px] font-medium bg-slate-800/80 px-1.5 py-0.5 rounded text-slate-300">
                                    {unit.configuration}
                                  </span>
                                </div>
                                <div className="mt-2 flex justify-between items-center text-xs font-medium">
                                  <span>₹{(unit.base_price / 100000).toFixed(1)}L</span>
                                  {unit.carpet_area_sqm ? (
                                    <span className="text-[10px] text-slate-400">{unit.carpet_area_sqm} sqm</span>
                                  ) : null}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};