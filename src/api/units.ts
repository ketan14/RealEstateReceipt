import { invoke } from "@tauri-apps/api/core";
import { Unit } from "../types";

// CREATE
export async function createUnit(
  projectId: number,
  towerId: number,
  unitNumber: string,
  status: string,
  basePrice: number,
  configuration: string,
  carpetAreaSqm?: number
) {
  return await invoke<number>("create_unit", {
    projectId,
    towerId,
    unitNumber,
    status,
    basePrice,
    configuration,
    carpetAreaSqm,
  });
}

// READ
export async function getUnits(projectId: number) {
  return await invoke<Unit[]>("get_units", { projectId });
}

// UPDATE
export async function updateUnit(
  id: number,
  projectId: number,
  towerId: number,
  unitNumber: string,
  status: string,
  basePrice: number,
  configuration: string,
  carpetAreaSqm?: number
) {
  return await invoke<void>("update_unit", {
    id,
    projectId,
    towerId,
    unitNumber,
    status,
    basePrice,
    configuration,
    carpetAreaSqm,
  });
}

// DELETE
export async function deleteUnit(id: number) {
  return await invoke<void>("delete_unit", { id });
}
