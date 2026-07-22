import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Customer, CustomerProfile } from "../../../types";
import { CustomerProfileView } from "./CustomerProfileView";
import { LoadingSpinner } from "../../UI/StatusMessages";

export const CustomerDirectory = () => {
    const [searchQuery, setSearchQuery] = useState("");
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
    const [customerProfile, setCustomerProfile] = useState<CustomerProfile | null>(null);
    const [profileLoading, setProfileLoading] = useState(false);

    // Debounced search
    useEffect(() => {
        const timer = setTimeout(() => {
            if (searchQuery.trim().length >= 2) {
                performSearch(searchQuery);
            } else if (searchQuery.trim().length === 0) {
                setCustomers([]);
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [searchQuery]);

    const performSearch = async (query: string) => {
        setLoading(true);
        try {
            const results: Customer[] = await invoke("search_customers", { query });
            setCustomers(results);
        } catch (e) {
            console.error("Search failed", e);
        } finally {
            setLoading(false);
        }
    };

    const loadProfile = async (id: number) => {
        setSelectedCustomerId(id);
        setProfileLoading(true);
        setCustomerProfile(null);
        try {
            const profile: CustomerProfile = await invoke("get_customer_profile", { customerId: id });
            setCustomerProfile(profile);
        } catch (e) {
            console.error("Failed to load profile", e);
        } finally {
            setProfileLoading(false);
        }
    };

    return (
        <div className="flex flex-col md:flex-row gap-6 h-[calc(100vh-140px)]">
            {/* Left Sidebar: Search & List */}
            <div className="w-full md:w-1/3 flex flex-col bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-slate-800 bg-slate-950/50">
                    <h2 className="text-lg font-bold text-slate-200 mb-3">Customer Directory</h2>
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Search name, phone, PAN..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded-lg pl-10 pr-4 py-2 focus:outline-none focus:border-indigo-500 transition-colors"
                        />
                        <svg className="w-5 h-5 text-slate-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2">
                    {loading && <div className="p-4 text-center text-slate-400">Searching...</div>}
                    {!loading && customers.length === 0 && searchQuery.length >= 2 && (
                        <div className="p-4 text-center text-slate-500">No customers found.</div>
                    )}
                    {!loading && customers.map((c) => (
                        <button
                            key={c.id}
                            onClick={() => c.id && loadProfile(c.id)}
                            className={`w-full text-left p-3 rounded-lg mb-1 transition-colors ${selectedCustomerId === c.id
                                    ? "bg-indigo-600/20 border border-indigo-500/50"
                                    : "hover:bg-slate-800 border border-transparent"
                                }`}
                        >
                            <div className="font-semibold text-slate-200">{c.name}</div>
                            <div className="text-xs text-slate-400 mt-1">{c.phone}</div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Right Pane: Profile View */}
            <div className="w-full md:w-2/3 bg-slate-900 border border-slate-800 rounded-2xl overflow-y-auto">
                {profileLoading ? (
                    <div className="h-full flex items-center justify-center">
                        <LoadingSpinner />
                    </div>
                ) : customerProfile ? (
                    <CustomerProfileView profile={customerProfile} />
                ) : (
                    <div className="h-full flex items-center justify-center text-slate-500 flex-col">
                        <svg className="w-16 h-16 mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        <p>Select a customer to view their profile</p>
                    </div>
                )}
            </div>
        </div>
    );
};
