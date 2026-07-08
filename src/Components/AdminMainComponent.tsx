import { useEffect, useState } from "react";
import { Project } from "../types";
import { getProjects } from "../api/projects";
import ProjectDetail from "./ProjectDetail";
export default function AdminDashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);

  useEffect(() => {
    loadProjects();
  }, []);

  async function loadProjects() {
    const data = await getProjects();
    setProjects(data);
  }

  return (
    <div className="h-full flex flex-col">
      {selectedProjectId === null ? (
        <div>
          <h2 className="text-lg font-bold text-slate-200">Projects</h2>
          <ul className="space-y-2 mt-4">
            {projects.map((p) => (
              <li
                key={p.id}
                className="flex justify-between items-center p-2 rounded bg-slate-800 border border-slate-700"
              >
                <span>{p.name} - {p.location}</span>
                <button
                  onClick={() => setSelectedProjectId(p.id)}
                  className="px-2 py-1 rounded bg-indigo-600 text-white hover:bg-indigo-500"
                >
                  View Details
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <ProjectDetail
          projectId={selectedProjectId}
          onBack={() => setSelectedProjectId(null)} // back to list
        />
      )}
    </div>
  );
}