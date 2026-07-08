import { useEffect, useState } from "react";
import { getUnits, createUnit, updateUnit, deleteUnit } from "../api/units.ts";
import { Unit } from "../types/index.ts";

interface AdminUnitsProps {
  projectId: number; // already provided from parent
}

export default function AdminUnits({ projectId }: AdminUnitsProps) {
  const [units, setUnits] = useState<Unit[]>([]);
  const [towerId, setTowerId] = useState<number | null>(null);
  const [unitNumber, setUnitNumber] = useState("");
  const [status, setStatus] = useState("Available");
  const [basePrice, setBasePrice] = useState<number>(0);
  const [configuration, setConfiguration] = useState("");

  const [showAddModal, setShowAddModal] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);

  useEffect(() => {
    loadUnits();
  }, [projectId]);

  async function loadUnits() {
    const data = await getUnits(projectId);
    setUnits(data);
  }

  async function handleCreate() {
    if (towerId && unitNumber.trim() !== "") {
      await createUnit(projectId, towerId, unitNumber, status, basePrice, configuration);
      resetForm();
      setShowAddModal(false);
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
      loadUnits();
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

  return (
    <div className="space-y-6 h-full flex flex-col">
      <h2 className="text-lg font-bold text-slate-200">Units</h2>

      {/* Container with scrollable list */}
      <div className="flex-1 p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl flex flex-col">
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-500 mb-4 self-start"
        >
          Add Unit
        </button>

        {/* Scrollable list */}
        <div className="flex-1 overflow-y-auto space-y-2">
          {units.map((u) => (
            <div
              key={u.id}
              className="flex justify-between items-center p-2 rounded bg-slate-800 border border-slate-700"
            >
              <span>
                {u.unit_number} — <span className="text-slate-400 text-sm">Tower {u.tower_id}</span>
                <br />
                <span className="text-slate-400 text-xs">
                  {u.status} | ₹{u.base_price} | {u.configuration}
                </span>
              </span>
              <div className="space-x-2">
                <button
                  onClick={() => openUpdateModal(u)}
                  className="px-2 py-1 rounded bg-yellow-600 text-white hover:bg-yellow-500"
                >
                  Update
                </button>
                <button
                  onClick={() => handleDelete(u.id)}
                  className="px-2 py-1 rounded bg-red-600 text-white hover:bg-red-500"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add Unit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-slate-900 p-6 rounded-xl shadow-lg w-96 space-y-4">
            <h3 className="text-lg font-semibold text-slate-200">Add New Unit</h3>
            <input
              type="number"
              value={towerId ?? ""}
              onChange={(e) => setTowerId(Number(e.target.value))}
              placeholder="Tower ID"
              className="w-full p-2 rounded bg-slate-800 text-slate-200 border border-slate-700"
            />
            <input
              type="text"
              value={unitNumber}
              onChange={(e) => setUnitNumber(e.target.value)}
              placeholder="Unit Number"
              className="w-full p-2 rounded bg-slate-800 text-slate-200 border border-slate-700"
            />
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full p-2 rounded bg-slate-800 text-slate-200 border border-slate-700"
            >
              <option value="Available">Available</option>
              <option value="Booked">Booked</option>
              <option value="Registered">Registered</option>
            </select>
            <input
              type="number"
              value={basePrice}
              onChange={(e) => setBasePrice(Number(e.target.value))}
              placeholder="Base Price"
              className="w-full p-2 rounded bg-slate-800 text-slate-200 border border-slate-700"
            />
            <input
              type="text"
              value={configuration}
              onChange={(e) => setConfiguration(e.target.value)}
              placeholder="Configuration"
              className="w-full p-2 rounded bg-slate-800 text-slate-200 border border-slate-700"
            />
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 rounded bg-gray-600 text-white hover:bg-gray-500"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                className="px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-500"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Update Unit Modal */}
      {showUpdateModal && selectedUnit && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-slate-900 p-6 rounded-xl shadow-lg w-96 space-y-4">
            <h3 className="text-lg font-semibold text-slate-200">Update Unit</h3>
            <input
              type="number"
              value={towerId ?? ""}
              onChange={(e) => setTowerId(Number(e.target.value))}
              placeholder="Tower ID"
              className="w-full p-2 rounded bg-slate-800 text-slate-200 border border-slate-700"
            />
            <input
              type="text"
              value={unitNumber}
              onChange={(e) => setUnitNumber(e.target.value)}
              placeholder="Unit Number"
              className="w-full p-2 rounded bg-slate-800 text-slate-200 border border-slate-700"
            />
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full p-2 rounded bg-slate-800 text-slate-200 border border-slate-700"
            >
              <option value="Available">Available</option>
              <option value="Booked">Booked</option>
              <option value="Registered">Registered</option>
            </select>
            <input
              type="number"
              value={basePrice}
              onChange={(e) => setBasePrice(Number(e.target.value))}
              placeholder="Base Price"
              className="w-full p-2 rounded bg-slate-800 text-slate-200 border border-slate-700"
            />
            <input
              type="text"
              value={configuration}
              onChange={(e) => setConfiguration(e.target.value)}
              placeholder="Configuration"
              className="w-full p-2 rounded bg-slate-800 text-slate-200 border border-slate-700"
            />
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowUpdateModal(false)}
                className="px-4 py-2 rounded bg-gray-600 text-white hover:bg-gray-500"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateSave}
                className="px-4 py-2 rounded bg-yellow-600 text-white hover:bg-yellow-500"
              >
                Update
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}