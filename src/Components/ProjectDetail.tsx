// ProjectDetail.tsx
import { useEffect, useState } from "react";
import { getProjects } from "../api/projects";
import AdminTowers from "./AdminTowers";
import AdminUnits from "./AdminUnits";

interface ProjectDetailProps {
  projectId: number;
  onBack: () => void; // <-- add this
}

export default function ProjectDetail({ projectId, onBack }: ProjectDetailProps) {
  const [project, setProject] = useState<{ id: number; name: string; location: string } | null>(null);
  const [activeTab, setActiveTab] = useState<"towers" | "units">("towers");

  useEffect(() => {
    async function loadProject() {
      const projects = await getProjects();
      const found = projects.find((p) => p.id === projectId);
      setProject(found || null);
    }
    loadProject();
  }, [projectId]);

  if (!project) {
    return <p className="text-slate-400">Loading project details...</p>;
  }

  return (
    <div className="space-y-6">
      {/* Back button */}
      <button
        onClick={onBack}
        className="px-4 py-2 rounded bg-gray-600 text-white hover:bg-gray-500"
      >
        ← Back to Projects
      </button>

      {/* Project header */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl">
        <h2 className="text-xl font-bold text-slate-200">{project.name}</h2>
        <p className="text-slate-400 text-sm">Location: {project.location}</p>
      </div>

      {/* Nested tab controls */}
      <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
        <button
          onClick={() => setActiveTab("towers")}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
            activeTab === "towers"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          Towers
        </button>
        <button
          onClick={() => setActiveTab("units")}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
            activeTab === "units"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          Units
        </button>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === "towers" && <AdminTowers projectId={project.id} />}
        {activeTab === "units" && <AdminUnits projectId={project.id} />}
      </div>
    </div>
  );
}
