import { useEffect, useState } from "react";
import { Project } from "../types";
import { createProject, deleteProject, getProjects, updateProject } from "../api/projects";
import ProjectDetail from "./ProjectDetail";
import { invoke } from "@tauri-apps/api/core";

export default function AdminDashboard({ projectsRef }: { projectsRef: Project[] }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [reraNumber, setReraNumber] = useState("");
  const [reraWebsiteUrl, setReraWebsiteUrl] = useState("");
  const [showModalForAdmin, setShowModalForAdmin] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState<{ id: number; name: string; location: string; rera_number?: string | null; rera_website_url?: string | null } | null>(null);

  useEffect(() => {
    loadProjects();
  }, []);

  async function loadProjects() {
    const data = await getProjects();
    setProjects(data);
  }

  async function handleCreate() {
    await createProject(name, location, reraNumber || null, reraWebsiteUrl || null);
    setName("");
    setLocation("");
    setReraNumber("");
    setReraWebsiteUrl("");
    setShowModalForAdmin(false);
    loadProjects();
  }

  async function handleUpdateSave() {
    if (selectedProject) {
      await updateProject(selectedProject.id, name, location, reraNumber || null, reraWebsiteUrl || null);
      setSelectedProject(null);
      setName("");
      setLocation("");
      setReraNumber("");
      setReraWebsiteUrl("");
      setShowUpdateModal(false);
      loadProjects();
    }
  }

  async function handleDelete(id: number) {
    await deleteProject(id);
    loadProjects();
  }

  function openUpdateModal(project: { id: number; name: string; location: string; rera_number?: string | null; rera_website_url?: string | null }) {
    setSelectedProject(project);
    setName(project.name);
    setLocation(project.location);
    setReraNumber(project.rera_number || "");
    setReraWebsiteUrl(project.rera_website_url || "");
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

          {/* Container with scrollable list */}
          <div className="flex-1 p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl flex flex-col">
            <button
              onClick={() => {
                setName("");
                setLocation("");
                setReraNumber("");
                setReraWebsiteUrl("");
                setShowModalForAdmin(true);
              }}
              className="px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-500 mb-4 self-start"
            >
              Add Project
            </button>

            {/* Scrollable list */}
            <div className="flex-1 overflow-y-auto space-y-2">
              {projects.map((p) => (
                <div
                  key={p.id}
                  className="flex justify-between items-center p-3 rounded bg-slate-800 border border-slate-700 hover:border-slate-600 transition-colors"
                >
                  <div className="flex flex-col">
                    <span className="font-semibold text-slate-200">{p.name} - {p.location}</span>
                    {p.rera_number && (
                      <span className="text-xs text-slate-400 mt-1">
                        RERA: {p.rera_number} {p.rera_website_url && `(${p.rera_website_url})`}
                      </span>
                    )}
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
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Project Name" className="w-full p-2 rounded bg-slate-800 text-slate-200 border border-slate-700" />
                  <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location" className="w-full p-2 rounded bg-slate-800 text-slate-200 border border-slate-700" />
                  <input value={reraNumber} onChange={(e) => setReraNumber(e.target.value)} placeholder="RERA Registration Number (Optional)" className="w-full p-2 rounded bg-slate-800 text-slate-200 border border-slate-700" />
                  <input value={reraWebsiteUrl} onChange={(e) => setReraWebsiteUrl(e.target.value)} placeholder="RERA Website URL (Optional)" className="w-full p-2 rounded bg-slate-800 text-slate-200 border border-slate-700" />
                </div>
                <div className="flex justify-end space-x-2 pt-2">
                  <button onClick={() => setShowModalForAdmin(false)} className="px-4 py-2 rounded bg-gray-600 text-white hover:bg-gray-500 text-sm">Cancel</button>
                  <button onClick={handleCreate} className="px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-500 text-sm">Save</button>
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
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Project Name" className="w-full p-2 rounded bg-slate-800 text-slate-200 border border-slate-700" />
                  <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location" className="w-full p-2 rounded bg-slate-800 text-slate-200 border border-slate-700" />
                  <input value={reraNumber} onChange={(e) => setReraNumber(e.target.value)} placeholder="RERA Registration Number (Optional)" className="w-full p-2 rounded bg-slate-800 text-slate-200 border border-slate-700" />
                  <input value={reraWebsiteUrl} onChange={(e) => setReraWebsiteUrl(e.target.value)} placeholder="RERA Website URL (Optional)" className="w-full p-2 rounded bg-slate-800 text-slate-200 border border-slate-700" />
                </div>
                <div className="flex justify-end space-x-2 pt-2">
                  <button onClick={() => setShowUpdateModal(false)} className="px-4 py-2 rounded bg-gray-600 text-white hover:bg-gray-500 text-sm">Cancel</button>
                  <button onClick={handleUpdateSave} className="px-4 py-2 rounded bg-yellow-600 text-white hover:bg-yellow-500 text-sm">Update</button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <ProjectDetail
          projectId={selectedProjectId}
          projectsRef={projectsRef}
          onBack={() => setSelectedProjectId(null)} // back to list
        />
      )}
    </div>
  );
}