import { Project } from "../types";
import AdminProjects from "./AdminProjects";

export default function AdminDashboard({ projectsRef, loadData }: { projectsRef: Project[], loadData: () => Promise<void> }) {
  return (
    <div className="h-full flex flex-col">
      <div className="space-y-6 h-full flex flex-col">
        <AdminProjects projectsRef={projectsRef} loadData={loadData} />
      </div>
    </div>
  );
}