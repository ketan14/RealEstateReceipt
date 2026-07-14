import { useEffect, useState } from "react";
import { getTowers, createTower, updateTower, deleteTower } from "../api/towers";

interface AdminTowersProps {
  projectId: number;
}

export default function AdminTowers({ projectId }: AdminTowersProps) {
  const [towers, setTowers] = useState<{ id: number; project_id: number; name: string }[]>([]);
  const [towerName, setTowerName] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [selectedTower, setSelectedTower] = useState<{ id: number; project_id: number; name: string } | null>(null);

  useEffect(() => {
    loadTowers();
  }, [projectId]);

  async function loadTowers() {
    const data = await getTowers(projectId); // backend should filter towers by projectId
    setTowers(data);
  }

  async function handleCreate() {
    if (towerName.trim() !== "") {
      await createTower(projectId, towerName);
      setTowerName("");
      setShowAddModal(false);
      loadTowers();
    }
  }

  async function handleUpdateSave() {
    if (selectedTower && towerName.trim() !== "") {
      await updateTower(selectedTower.id, projectId, towerName);
      setSelectedTower(null);
      setTowerName("");
      setShowUpdateModal(false);
      loadTowers();
    }
  }

  async function handleDelete(id: number) {
    await deleteTower(id);
    loadTowers();
  }

  function openUpdateModal(tower: { id: number; project_id: number; name: string }) {
    setSelectedTower(tower);
    setTowerName(tower.name);
    setShowUpdateModal(true);
  }

  return (
    <div className="space-y-6 h-full flex flex-col">
      <h2 className="text-lg font-bold text-slate-200">Towers</h2>

      {/* Container with scrollable list */}
      <div className=" ">
        <button
          onClick={() => { setTowerName(""); setShowAddModal(true) }}
          className="px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-500 mb-4 self-start"
        >
          Add Tower
        </button>

        {/* Scrollable list */}
        <div className="flex-1 overflow-y-auto space-y-2">
          {towers.map((t) => (
            <div
              key={t.id}
              className="flex justify-between items-center p-2 rounded bg-slate-800 border border-slate-700"
            >
              <span>{t.name} - Tower ID {t.id} </span>
              <div className="flex gap-4 pt-4 border-t border-slate-800">
                <button
                  onClick={() => openUpdateModal(t)}
                  className="px-2 py-1 rounded bg-yellow-600 text-white hover:bg-yellow-500"
                >
                  Update
                </button>
                <button
                  onClick={() => handleDelete(t.id)}
                  className="px-2 py-1 rounded bg-red-600 text-white hover:bg-red-500"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add Tower Modal */}
      {showAddModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-slate-900 p-6 rounded-xl shadow-lg w-96 space-y-4">
            <h3 className="text-lg font-semibold text-slate-200">Add New Tower</h3>
            <div className="">
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400 font-medium">Tower Name</label>
                <input
                  type="text"
                  value={towerName}
                  onChange={(e) => setTowerName(e.target.value)}
                  placeholder="Tower Name"
                  className="w-full p-2 rounded bg-slate-800 text-slate-200 border border-slate-700"
                />
              </div>
            </div>

            <div className="flex gap-4 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="flex-1 py-3 bg-slate-950 hover:bg-slate-850 active:bg-slate-900 border border-slate-800 text-slate-300 font-semibold rounded-xl transition-all text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-semibold rounded-xl shadow-lg shadow-indigo-600/20 transition-all text-sm"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Update Tower Modal */}
      {showUpdateModal && selectedTower && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-slate-900 p-6 rounded-xl shadow-lg w-96 space-y-4">
            <h3 className="text-lg font-semibold text-slate-200">Update Tower</h3>
            <div className="">
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400 font-medium">Tower Name</label>
                <input
                  type="text"
                  value={towerName}
                  onChange={(e) => setTowerName(e.target.value)}
                  placeholder="Tower Name"
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
                Update
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}