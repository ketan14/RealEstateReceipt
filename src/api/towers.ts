import { invoke } from "@tauri-apps/api/core";
import { Tower } from "../types"; // define Tower type in types.ts

export async function createTower(projectId: number, name: string) {
  return await invoke<number>("create_tower", { projectId, name });
}

export async function getTowers(projectId: number) {
  return await invoke<Tower[]>("get_towers", { projectId });
}

export async function updateTower(id: number, projectId: number, name: string) {
  return await invoke<void>("update_tower", { id, projectId, name });
}

export async function deleteTower(id: number) {
  return await invoke<void>("delete_tower", { id });
}
