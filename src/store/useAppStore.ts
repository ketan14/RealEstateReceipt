import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { Project, ReceiptHistoryItem } from '../types';

// --- 2. The Store Interface (State + Actions) ---
interface AppState {
    // State
    projects: Project[];
    receipts: ReceiptHistoryItem[];
    loading: boolean;
    errorMsg: string | null;

    // Actions
    setProjects: (projects: Project[]) => void;
    setReceipts: (receipts: ReceiptHistoryItem[]) => void;
    setLoading: (loading: boolean) => void;
    setError: (msg: string | null) => void;

    // Async Thunk Action
    loadData: () => Promise<void>;
    updateUnitStatus: (unitId: number, status: 'Available' | 'Booked' | 'Registered') => Promise<void>;
}

// --- 3. Store Implementation ---
// Note: added (set, get) here to enable accessing other actions
export const useAppStore = create<AppState>((set, get) => ({
    // Initial State
    projects: [],
    receipts: [],
    loading: true,
    errorMsg: null,

    // Basic Setters
    setProjects: (projects) => set({ projects }),
    setReceipts: (receipts) => set({ receipts }),
    setLoading: (loading) => set({ loading }),
    setError: (errorMsg) => set({ errorMsg }),

    // Complex Async Action
    loadData: async () => {
        set({ loading: true, errorMsg: null });
        try {
            const propertyMap: Project[] = await invoke("get_property_map");
            const history: ReceiptHistoryItem[] = await invoke("get_receipt_history");

            set({
                projects: propertyMap,
                receipts: history,
                loading: false
            });
        } catch (err: any) {
            console.error(err);
            set({
                errorMsg: err.toString() || "Failed to load data from backend.",
                loading: false
            });
        }
    },

    updateUnitStatus: async (unitId, status) => {
        set({ loading: true, errorMsg: null });
        try {
            // 1. Perform the update
            await invoke("update_unit_status", { unitId, status });

            // 2. Now get() is defined, so you can call loadData() directly from the store
            await get().loadData();
        } catch (err: any) {
            console.error(err);
            set({
                errorMsg: err.toString() || "Failed to update unit status.",
                loading: false
            });
        }
    },
}));