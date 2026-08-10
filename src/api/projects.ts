import { invoke } from "@tauri-apps/api/core";
import { Project } from "../types";

export async function createProject(
  name: string,
  location: string,
  reraNumber?: string | null,
  reraWebsiteUrl?: string | null,
  isMetro?: boolean,
  occupancyCertificateDate?: string | null
) {
  return await invoke<number>("create_project", {
    name,
    location,
    reraNumber,
    reraWebsiteUrl,
    isMetro,
    occupancyCertificateDate,
  });
}

export async function getProjects() {
  return await invoke<Project[]>("get_projects");
}

export async function updateProject(
  id: number,
  name: string,
  location: string,
  reraNumber?: string | null,
  reraWebsiteUrl?: string | null,
  isMetro?: boolean,
  occupancyCertificateDate?: string | null
) {
  return await invoke<void>("update_project", {
    id,
    name,
    location,
    reraNumber,
    reraWebsiteUrl,
    isMetro,
    occupancyCertificateDate,
  });
}

export async function deleteProject(id: number) {
  return await invoke<void>("delete_project", { id });
}
