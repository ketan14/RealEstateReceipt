import { invoke } from "@tauri-apps/api/core";
import { Project } from "../types";

export async function createProject(name: string, location: string) {
  return await invoke<number>("create_project", { name, location });
}

export async function getProjects() {
  return await invoke<Project[]>("get_projects");
}

export async function updateProject(id: number, name: string, location: string) {
  return await invoke<void>("update_project", { id, name, location });
}

export async function deleteProject(id: number) {
  return await invoke<void>("delete_project", { id });
}
