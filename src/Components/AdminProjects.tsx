import { useEffect, useState } from "react";
import { createProject, getProjects, updateProject, deleteProject } from "../api/projects";
import { Project } from "../types";
import ProjectDetail from "./ProjectDetail";
import { invoke } from "@tauri-apps/api/core";

export default function AdminProjects({ projectsRef, loadData }: { projectsRef: Project[], loadData: () => Promise<void> }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [reraNumber, setReraNumber] = useState("");
  const [reraWebsiteUrl, setReraWebsiteUrl] = useState("");
  const [isMetro, setIsMetro] = useState(false);
  const [ocDate, setOcDate] = useState("");

  const metroCities = ['Bengaluru', 'Chennai', 'Delhi NCR', 'Hyderabad', 'Kolkata', 'Mumbai'];

  function handleLocationChange(val: string) {
    setLocation(val);
    const isMetroCity = metroCities.some(city => val.toLowerCase().includes(city.toLowerCase()));
    setIsMetro(isMetroCity);
  }
  const [showModalForAdmin, setShowModalForAdmin] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);

  useEffect(() => {
    loadProjects();
  }, []);

  async function loadProjects() {
    const data = await getProjects();
    setProjects(data);
  }

  async function handleCreate() {
    await createProject(name, location, reraNumber || null, reraWebsiteUrl || null, isMetro, ocDate || null);
    resetForm();
    setShowModalForAdmin(false);
    loadProjects();
  }

  async function handleUpdateSave() {
    if (selectedProject) {
      await updateProject(selectedProject.id, name, location, reraNumber || null, reraWebsiteUrl || null, isMetro, ocDate || null);
      setSelectedProject(null);
      resetForm();
      setShowUpdateModal(false);
      loadProjects();
    }
  }

  async function handleDelete(id: number) {
    await deleteProject(id);
    loadProjects();
  }

  function resetForm() {
    setName("");
    setLocation("");
    setReraNumber("");
    setReraWebsiteUrl("");
    setIsMetro(false);
    setOcDate("");
  }

  function openUpdateModal(project: Project) {
    setSelectedProject(project);
    setName(project.name);
    setLocation(project.location);
    setReraNumber(project.rera_number || "");
    setReraWebsiteUrl(project.rera_website_url || "");
    setIsMetro(!!project.is_metro);
    setOcDate(project.occupancy_certificate_date || "");
    setShowUpdateModal(true);
  }


  const handleBackup = async () => {
    try {
      const backupPath: string = await invoke("create_backup");
      alert(`Backup successful! Saved to: ${backupPath}`);
    } catch (err: any) {
      alert(`Backup failed: ${err.toString()}`);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {selectedProjectId === null ? (
        <div className="space-y-6 h-full flex flex-col">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold text-slate-200">Projects</h2>
            <button
              onClick={handleBackup}
              className="px-4 py-2 rounded bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600 hover:text-white transition-colors text-sm font-semibold flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              Backup Database
            </button>
          </div>

          <div className="flex-1 p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl flex flex-col">
            <button
              onClick={() => {
                resetForm();
                setShowModalForAdmin(true);
              }}
              className="px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-500 mb-4 self-start font-semibold text-sm"
            >
              Add Project
            </button>

            <div className="flex-1 overflow-y-auto space-y-2">
              {projects.map((p) => (
                <div
                  key={p.id}
                  className="flex justify-between items-center p-3 rounded bg-slate-800 border border-slate-700 hover:border-slate-600 transition-colors"
                >
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-200">{p.name} - {p.location}</span>
                      {p.is_metro && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-950 text-indigo-400 border border-indigo-700 uppercase">
                          Metro
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-slate-400 mt-1">
                      {p.rera_number && <span>RERA: {p.rera_number}</span>}
                      {p.occupancy_certificate_date && (
                        <span className="text-emerald-400 font-semibold">
                          OC Date: {p.occupancy_certificate_date} (Exempt from GST)
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="space-x-2">
                    <button
                      onClick={() => setSelectedProjectId(p.id)}
                      className="px-2.5 py-1.5 rounded bg-indigo-600 text-white hover:bg-indigo-100 text-xs font-semibold"
                    >
                      View Details
                    </button>
                    <button
                      onClick={() => openUpdateModal(p)}
                      className="px-2.5 py-1.5 rounded bg-yellow-600 text-white hover:bg-yellow-500 text-xs font-semibold"
                    >
                      Update
                    </button>
                    <button
                      onClick={() => handleDelete(p.id)}
                      className="px-2.5 py-1.5 rounded bg-red-600 text-white hover:bg-red-500 text-xs font-semibold"
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
            <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
              <div className="bg-slate-900 p-6 rounded-xl shadow-lg w-96 space-y-4 border border-slate-800">
                <h3 className="text-lg font-semibold text-slate-200">Add New Project</h3>
                <div className="space-y-3">
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Project Name" className="w-full p-2 rounded bg-slate-800 text-slate-200 border border-slate-700 text-sm" />
                  <input value={location} onChange={(e) => handleLocationChange(e.target.value)} placeholder="Location" className="w-full p-2 rounded bg-slate-800 text-slate-200 border border-slate-700 text-sm" />
                  <input value={reraNumber} onChange={(e) => setReraNumber(e.target.value)} placeholder="RERA Number (Optional)" className="w-full p-2 rounded bg-slate-800 text-slate-200 border border-slate-700 text-sm" />
                  <input value={reraWebsiteUrl} onChange={(e) => setReraWebsiteUrl(e.target.value)} placeholder="RERA Website URL (Optional)" className="w-full p-2 rounded bg-slate-800 text-slate-200 border border-slate-700 text-sm" />

                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="isMetroAdd"
                      checked={isMetro}
                      onChange={(e) => setIsMetro(e.target.checked)}
                      className="w-4 h-4 accent-indigo-600 rounded"
                    />
                    <label htmlFor="isMetroAdd" className="text-xs text-slate-300 font-medium">
                      Located in Metro Region (Affordable ≤ 60 sqm)
                    </label>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Occupancy Certificate Date (OC/CC)</label>
                    <input
                      type="date"
                      value={ocDate}
                      onChange={(e) => setOcDate(e.target.value)}
                      className="w-full p-2 rounded bg-slate-800 text-slate-200 border border-slate-700 text-sm"
                    />
                  </div>
                </div>
                <div className="flex justify-end space-x-2 pt-2">
                  <button onClick={() => setShowModalForAdmin(false)} className="px-4 py-2 rounded bg-gray-600 text-white hover:bg-gray-500 text-sm font-semibold">Cancel</button>
                  <button onClick={handleCreate} className="px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-500 text-sm font-semibold">Save</button>
                </div>
              </div>
            </div>
          )}

          {/* Update Project Modal */}
          {showUpdateModal && selectedProject && (
            <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
              <div className="bg-slate-900 p-6 rounded-xl shadow-lg w-96 space-y-4 border border-slate-800">
                <h3 className="text-lg font-semibold text-slate-200">Update Project</h3>
                <div className="space-y-3">
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Project Name" className="w-full p-2 rounded bg-slate-800 text-slate-200 border border-slate-700 text-sm" />
                  <input value={location} onChange={(e) => handleLocationChange(e.target.value)} placeholder="Location" className="w-full p-2 rounded bg-slate-800 text-slate-200 border border-slate-700 text-sm" />
                  <input value={reraNumber} onChange={(e) => setReraNumber(e.target.value)} placeholder="RERA Number (Optional)" className="w-full p-2 rounded bg-slate-800 text-slate-200 border border-slate-700 text-sm" />
                  <input value={reraWebsiteUrl} onChange={(e) => setReraWebsiteUrl(e.target.value)} placeholder="RERA Website URL (Optional)" className="w-full p-2 rounded bg-slate-800 text-slate-200 border border-slate-700 text-sm" />

                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="isMetroEdit"
                      checked={isMetro}
                      onChange={(e) => setIsMetro(e.target.checked)}
                      className="w-4 h-4 accent-indigo-600 rounded"
                    />
                    <label htmlFor="isMetroEdit" className="text-xs text-slate-300 font-medium">
                      Located in Metro Region (Affordable ≤ 60 sqm)
                    </label>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Occupancy Certificate Date (OC/CC)</label>
                    <input
                      type="date"
                      value={ocDate}
                      onChange={(e) => setOcDate(e.target.value)}
                      className="w-full p-2 rounded bg-slate-800 text-slate-200 border border-slate-700 text-sm"
                    />
                  </div>
                </div>
                <div className="flex justify-end space-x-2 pt-2">
                  <button onClick={() => setShowUpdateModal(false)} className="px-4 py-2 rounded bg-gray-600 text-white hover:bg-gray-500 text-sm font-semibold">Cancel</button>
                  <button onClick={handleUpdateSave} className="px-4 py-2 rounded bg-yellow-600 text-white hover:bg-yellow-500 text-sm font-semibold">Update</button>
                </div>
              </div>
            </div>
          )}
        </div>) : (
        <ProjectDetail
          projectId={selectedProjectId}
          projectsRef={projectsRef}
          onBack={() => setSelectedProjectId(null)} // back to list
          loadData={loadData}
        />
      )}
    </div>

  );
}
