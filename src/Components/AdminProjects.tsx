import { useEffect, useState } from "react";
import { createProject, getProjects, updateProject, deleteProject } from "../api/projects";

export default function AdminProjects() {
  const [projects, setProjects] = useState<{ id: number; name: string; location: string }[]>([]);
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [showModalForAdmin, setShowModalForAdmin] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState<{ id: number; name: string; location: string } | null>(null);

  useEffect(() => {
    loadProjects();
  }, []);

  async function loadProjects() {
    const data = await getProjects();
    setProjects(data);
  }

  async function handleCreate() {
    await createProject(name, location);
    setName("");
    setLocation("");
    setShowModalForAdmin(false);
    loadProjects();
  }

  async function handleUpdateSave() {
    if (selectedProject) {
      await updateProject(selectedProject.id, name, location);
      setSelectedProject(null);
      setName("");
      setLocation("");
      setShowUpdateModal(false);
      loadProjects();
    }
  }

  async function handleDelete(id: number) {
    await deleteProject(id);
    loadProjects();
  }

  function openUpdateModal(project: { id: number; name: string; location: string }) {
    setSelectedProject(project);
    setName(project.name);
    setLocation(project.location);
    setShowUpdateModal(true);
  }

  return (
    <div className="space-y-6 h-full flex flex-col">
      <h2 className="text-lg font-bold text-slate-200">Projects</h2>

      {/* Container with scrollable list */}
      <div className="flex-1 p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl flex flex-col">
        <button
          onClick={() => setShowModalForAdmin(true)}
          className="px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-500 mb-4 self-start"
        >
          Add Project
        </button>

        {/* Scrollable list */}
        <div className="flex-1 overflow-y-auto space-y-2">
          {projects.map((p) => (
            <div
              key={p.id}
              className="flex justify-between items-center p-2 rounded bg-slate-800 border border-slate-700"
            >
              <span>{p.name} - {p.location}</span>
              <div className="space-x-2">
                <button
                  onClick={() => openUpdateModal(p)}
                  className="px-2 py-1 rounded bg-yellow-600 text-white hover:bg-yellow-500"
                >
                  Update
                </button>
                <button
                  onClick={() => handleDelete(p.id)}
                  className="px-2 py-1 rounded bg-red-600 text-white hover:bg-red-500"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add Project Modal */}
      {showModalForAdmin && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-slate-900 p-6 rounded-xl shadow-lg w-96 space-y-4">
            <h3 className="text-lg font-semibold text-slate-200">Add New Project</h3>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Project Name" className="w-full p-2 rounded bg-slate-800 text-slate-200 border border-slate-700" />
            <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location" className="w-full p-2 rounded bg-slate-800 text-slate-200 border border-slate-700" />
            <div className="flex justify-end space-x-2">
              <button onClick={() => setShowModalForAdmin(false)} className="px-4 py-2 rounded bg-gray-600 text-white hover:bg-gray-500">Cancel</button>
              <button onClick={handleCreate} className="px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-500">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Update Project Modal */}
      {showUpdateModal && selectedProject && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-slate-900 p-6 rounded-xl shadow-lg w-96 space-y-4">
            <h3 className="text-lg font-semibold text-slate-200">Update Project</h3>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Project Name" className="w-full p-2 rounded bg-slate-800 text-slate-200 border border-slate-700" />
            <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location" className="w-full p-2 rounded bg-slate-800 text-slate-200 border border-slate-700" />
            <div className="flex justify-end space-x-2">
              <button onClick={() => setShowUpdateModal(false)} className="px-4 py-2 rounded bg-gray-600 text-white hover:bg-gray-500">Cancel</button>
              <button onClick={handleUpdateSave} className="px-4 py-2 rounded bg-yellow-600 text-white hover:bg-yellow-500">Update</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
