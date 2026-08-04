import { useEffect, useState } from "react";
import { getUnits, createUnit, updateUnit, deleteUnit } from "../api/units.ts";
import { Tower, Unit, UnitCSVRow } from "../types/index.ts";
import { getTowers } from "../api/towers.ts";
import Papa from "papaparse";
interface AdminUnitsProps {
  projectId: number; // already provided from parent
  towersRef: Tower[];
  loadData: () => Promise<void>;
}

export default function AdminUnits({ projectId, towersRef, loadData }: AdminUnitsProps) {
  const [units, setUnits] = useState<Unit[]>([]);
  const [towers, setTowers] = useState<Tower[]>([]);
  const [towerId, setTowerId] = useState<number | null>(null);
  const [unitNumber, setUnitNumber] = useState("");
  const [status, setStatus] = useState("Available");
  const [basePrice, setBasePrice] = useState<number>(0);
  const [configuration, setConfiguration] = useState("");
  ``
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]); const [mode, setMode] = useState<"single" | "bulk" | "bulkCustom">("single");

  const [showAddModal, setShowAddModal] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [expandedTowers, setExpandedTowers] = useState<number[]>([]);

  useEffect(() => {
    loadUnits();
    loadTowers();
    setTowers(towersRef);
  }, [projectId]);

  async function loadUnits() {
    console.log('loadUnits')
    const data = await getUnits(projectId);
    setUnits(data);
  }

  async function loadTowers() {
    const dataTower = await getTowers(projectId); // backend should filter towers by projectId
    setTowers(dataTower);
  }


  async function handleCreate() {
    if (towerId && unitNumber.trim() !== "") {
      await createUnit(projectId, towerId, unitNumber, status, basePrice, configuration);
      resetForm();
      setShowAddModal(false);
      await loadData();
      loadUnits();
    }
  }

  async function handleUpdateSave() {
    if (selectedUnit && unitNumber.trim() !== "" && towerId) {
      await updateUnit(
        selectedUnit.id,
        projectId,
        towerId,
        unitNumber,
        status,
        basePrice,
        configuration
      );
      resetForm();
      setSelectedUnit(null);
      setShowUpdateModal(false);
      await loadUnits();
      await loadData();
    }
  }

  async function handleDelete(id: number) {
    await deleteUnit(id);
    loadUnits();
  }

  function openUpdateModal(unit: Unit) {
    setSelectedUnit(unit);
    setTowerId(unit.tower_id);
    setUnitNumber(unit.unit_number);
    setStatus(unit.status);
    setBasePrice(unit.base_price);
    setConfiguration(unit.configuration);
    setShowUpdateModal(true);
  }

  function resetForm() {
    setTowerId(null);
    setUnitNumber("");
    setStatus("Available");
    setBasePrice(0);
    setConfiguration("");
  }
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setCsvFile(e.target.files[0]);
    }
  };

  const validateRow = (row: UnitCSVRow, index: number): string | null => {
    if (!row.tower_id || isNaN(Number(row.tower_id))) {
      return `Row ${index + 2}: tower_id is required and must be a number`;
    }
    if (!row.unit_number || row.unit_number.trim() === "") {
      return `Row ${index + 2}: unit_number is required`;
    }
    if (!row.status || !['Available', 'Booked', 'Registered'].includes(row.status)) {
      return `Row ${index + 2}: status must be Available, Booked, or Registered`;
    }
    if (!row.base_price || isNaN(Number(row.base_price))) {
      return `Row ${index + 2}: base_price must be a valid number`;
    }
    if (!row.configuration || row.configuration.trim() === "") {
      return `Row ${index + 2}: configuration is required`;
    }
    return null;
  };

  function mapCSVRowToUnit(row: UnitCSVRow, projectId: number): Omit<Unit, "id"> {
    return {
      project_id: projectId,
      tower_id: Number(row.tower_id),
      unit_number: row.unit_number.trim(),
      status: row.status as Unit["status"],
      base_price: parseFloat(row.base_price),
      configuration: row.configuration.trim(),
    };
  }
  const handleBulkCreate = async () => {
    if (!csvFile) return;

    setIsUploading(true);
    setErrors([]);

    Papa.parse<UnitCSVRow>(csvFile, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const validationErrors: string[] = [];
        let successCount = 0;

        for (let i = 0; i < results.data.length; i++) {
          const row = results.data[i];
          const error = validateRow(row, i);

          if (error) {
            errors.push(error);
            continue;
          }
          const unitData = mapCSVRowToUnit(row, projectId);

          try {
            await createUnit(
              unitData.project_id,
              unitData.tower_id,
              unitData.unit_number,
              unitData.status,
              unitData.base_price,
              unitData.configuration
            );
            successCount++;
          } catch (err) {
            validationErrors.push(`Row ${i + 2}: API error - ${(err as Error).message}`);
          }
        }

        setErrors(validationErrors);
        setIsUploading(false);
        loadUnits();

        alert(
          `Bulk upload finished. Success: ${successCount}, Errors: ${validationErrors.length}`
        );
      },
    });
  };


  const getTowerName = (towerId: string) => {
    const tower = towers.find((t) => t.id === Number(towerId));
    return tower ? tower.name : "";
  };


  return (
    <div className="space-y-6 h-full flex flex-col">
      {/* Container with scrollable list */}
      <div className="">

        {/* Header row: title left, button right */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-slate-200">Units</h2>
          <button
            onClick={() => { resetForm(); setShowAddModal(true); }}
            className="px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-500"
          >
            Add Unit
          </button>
        </div>

        {/* Group units by tower */}
        <div className="flex-1 overflow-y-auto space-y-6">
          {Object.entries(
            units.reduce((acc: Record<number, typeof units>, u) => {
              (acc[u.tower_id] ||= []).push(u);
              return acc;
            }, {})
          ).map(([towerId, towerUnits]) => {
            const isExpanded = expandedTowers.includes(Number(towerId));
            return (
              <div key={towerId} className="rounded-xl bg-slate-950/50 border border-slate-800/60">

                {/* Tower header collapsible */}
                <button
                  onClick={() =>
                    setExpandedTowers((prev) =>
                      prev.includes(Number(towerId))
                        ? prev.filter((id) => id !== Number(towerId))
                        : [...prev, Number(towerId)]
                    )
                  }
                  className="w-full flex justify-between items-center px-4 py-2 text-left text-slate-200 font-semibold hover:bg-slate-800/40 transition-colors"
                >
                  <span>
                    {getTowerName(towerId)}
                    <span className="text-xs text-slate-400">({towerUnits.length} units)</span>
                  </span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                    className={`w-4 h-4 transform transition-transform duration-200 ${isExpanded ? "rotate-180" : "rotate-0"
                      }`}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Unit grid collapsible */}
                {isExpanded && (
                  <div className="flex flex-wrap gap-4 p-4">
                    {towerUnits.map((u) => (
                      <div
                        key={u.id}
                        className="flex-1 min-w-[200px] max-w-[250px] rounded-xl bg-slate-900 border border-slate-700 shadow-md p-4 flex flex-col justify-between"
                      >
                        <div className="space-y-1">
                          <h4 className="font-medium text-slate-100">{u.unit_number}</h4>
                          <p className="text-xs text-slate-400">Status: {u.status}</p>
                          <p className="text-xs text-slate-400">
                            ₹{u.base_price} | {u.configuration}
                          </p>
                        </div>
                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={() => openUpdateModal(u)} className="flex-1 px-2 py-1 rounded bg-yellow-600 text-white hover:bg-yellow-500 text-xs">
                            Update
                          </button>
                          <button
                            onClick={() => handleDelete(u.id)} className="flex-1 px-2 py-1 rounded bg-red-600 text-white hover:bg-red-500 text-xs">
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Add Unit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-slate-900 p-6 rounded-xl shadow-lg w-[500px] space-y-4">
            <h3 className="text-lg font-semibold text-slate-200">Add Units</h3>

            {/* Mode Toggle */}
            <div className="flex gap-4 mb-4">
              <button
                className={`flex-1 py-2 rounded-xl ${mode === "single" ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-300"}`}
                onClick={() => setMode("single")}
              >
                Single Unit
              </button>
              <button
                className={`flex-1 py-2 rounded-xl ${mode === "bulk" ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-300"}`}
                onClick={() => setMode("bulk")}
              >
                Bulk Upload
              </button>
              <button
                className={`flex-1 py-2 rounded-xl ${mode === "bulkCustom" ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-300"}`}
                onClick={() => setMode("bulkCustom")}
              >
                Custom bulk
              </button>
            </div>

            {/* Single Unit Form */}
            {mode === "single" && (
              <div className="space-y-3">
                {/* Tower Select */}
                <select value={towerId || ""} onChange={(e) => setTowerId(Number(e.target.value))}
                  className="w-full p-2 rounded bg-slate-800 text-slate-200 border border-slate-700">
                  <option value="">Select Tower</option>
                  {towers.map(tower => (
                    <option key={tower.id} value={tower.id}>{tower.name}</option>
                  ))}
                </select>

                {/* Unit Number */}
                <input type="text" value={unitNumber} onChange={(e) => setUnitNumber(e.target.value)}
                  placeholder="Unit Number" className="w-full p-2 rounded bg-slate-800 text-slate-200 border border-slate-700" />

                {/* Status */}
                <select value={status} onChange={(e) => setStatus(e.target.value)}
                  className="w-full p-2 rounded bg-slate-800 text-slate-200 border border-slate-700">
                  <option value="Available">Available</option>
                  <option value="Booked">Booked</option>
                  <option value="Registered">Registered</option>
                </select>

                {/* Base Price */}
                <input type="number" value={basePrice} onChange={(e) => setBasePrice(Number(e.target.value))}
                  placeholder="Base Price" className="w-full p-2 rounded bg-slate-800 text-slate-200 border border-slate-700" />

                {/* Configuration */}
                <input type="text" value={configuration} onChange={(e) => setConfiguration(e.target.value)}
                  placeholder="Configuration" className="w-full p-2 rounded bg-slate-800 text-slate-200 border border-slate-700" />
              </div>
            )}

            {/* Bulk Upload Form */}
            {mode === "bulk" && (
              <div className="space-y-3">
                <span> Project Id : {projectId}</span>
                <p>
                  <ul className="space-y-2">
                    {towers.map((tower) => (
                      <li key={tower.id} className="text-slate-200">
                        {tower.name} Id : {tower.id}
                      </li>
                    ))}
                  </ul>
                </p>
                <input type="file" accept=".csv" onChange={handleFileChange}
                  className="w-full p-2 rounded bg-slate-800 text-slate-200 border border-slate-700" />
                <button onClick={handleBulkCreate}
                  className="w-full py-2 bg-indigo-600 text-white rounded-xl">
                  {isUploading ? "Uploading..." : "Upload Units"}
                </button>
                {errors.length > 0 && (
                  <div className="text-red-400 text-sm">
                    <h4>Errors:</h4>
                    <ul>{errors.map((err, idx) => <li key={idx}>{err}</li>)}</ul>
                  </div>
                )}
              </div>
            )}

            {/* Bulk Custom Upload Form */}
            {mode === "bulkCustom" && (
              <div className="space-y-3">
                <span> Project Id : {projectId}</span>
                <p>
                  <ul className="space-y-2">
                    {towers.map((tower) => (
                      <li key={tower.id} className="text-slate-200">
                        {tower.name} Id : {tower.id}
                      </li>
                    ))}
                  </ul>
                </p>
                <input type="file" accept=".csv" onChange={handleFileChange}
                  className="w-full p-2 rounded bg-slate-800 text-slate-200 border border-slate-700" />
                <button onClick={handleBulkCreate}
                  className="w-full py-2 bg-indigo-600 text-white rounded-xl">
                  {isUploading ? "Uploading..." : "Upload Units"}
                </button>
                {errors.length > 0 && (
                  <div className="text-red-400 text-sm">
                    <h4>Errors:</h4>
                    <ul>{errors.map((err, idx) => <li key={idx}>{err}</li>)}</ul>
                  </div>
                )}
              </div>
            )}

            {/* Footer Buttons */}
            <div className="flex gap-4 pt-4 border-t border-slate-800">
              <button onClick={() => setShowAddModal(false)}
                className="flex-1 py-3 bg-slate-950 border border-slate-800 text-slate-300 rounded-xl">
                Cancel
              </button>
              {mode === "single" && (
                <button onClick={handleCreate}
                  className="flex-1 py-3 bg-indigo-600 text-white rounded-xl">
                  Save
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Update Unit Modal */}
      {showUpdateModal && selectedUnit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-slate-900 p-6 rounded-xl shadow-lg w-96 space-y-4">
            <h3 className="text-lg font-semibold text-slate-200">Update Unit</h3>
            <div className="">
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400 font-medium">Select Tower</label>
                {towers && (
                  <select
                    value={towerId || ""}
                    onChange={(e) => setTowerId(Number(e.target.value))}
                    className="w-full p-2 rounded bg-slate-800 text-slate-200 border border-slate-700"
                  >
                    <option value="">Select Tower</option>
                    {towers.map(tower => (
                      <option key={tower.id} value={tower.id}>{tower.name}</option>
                    ))}
                  </select>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400 font-medium">Unit Number</label>

                <input
                  type="text"
                  value={unitNumber}
                  onChange={(e) => setUnitNumber(e.target.value)}
                  placeholder="Unit Number"
                  className="w-full p-2 rounded bg-slate-800 text-slate-200 border border-slate-700"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400 font-medium">Agreed Sale Value (₹)</label>

                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full p-2 rounded bg-slate-800 text-slate-200 border border-slate-700"
                >
                  <option value="Available">Available</option>
                  <option value="Booked">Booked</option>
                  <option value="Registered">Registered</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400 font-medium">Base Price (₹)</label>
                <input
                  type="number"
                  value={basePrice}
                  onChange={(e) => setBasePrice(Number(e.target.value))}
                  placeholder="Base Price"
                  className="w-full p-2 rounded bg-slate-800 text-slate-200 border border-slate-700"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400 font-medium">Configuration (₹)</label>
                <input
                  type="text"
                  value={configuration}
                  onChange={(e) => setConfiguration(e.target.value)}
                  placeholder="Configuration"
                  className="w-full p-2 rounded bg-slate-800 text-slate-200 border border-slate-700"
                />
              </div>
            </div>
            <div className="flex gap-4 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowUpdateModal(false)}
                className="flex-1 py-3 bg-slate-950 hover:bg-slate-850 active:bg-slate-900 border border-slate-800 text-slate-300 font-semibold rounded-xl transition-all text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateSave}
                className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-semibold rounded-xl shadow-lg shadow-indigo-600/20 transition-all text-sm"
              >
                Update1
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}