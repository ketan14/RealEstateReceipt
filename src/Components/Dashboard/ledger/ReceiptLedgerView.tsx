import { useMemo, useState } from "react";
import { LedgerFilterBar } from "./LedgerFilterBar";
import { ReceiptTable } from "./ReceiptTable";
import { GroupedReceipt, ReceiptHistoryItem } from "../../../types";

// components/ledger/ReceiptLedgerView.tsx
export const ReceiptLedgerView = ({ receipts, handlePrint }: { receipts: ReceiptHistoryItem[], handlePrint: any }) => {
    const [search, setSearch] = useState("");
    const [mode, setMode] = useState("All");


    // Logic: Filter and Group your receipts here
    const filteredData = useMemo(() => {
        // Apply search and mode filter logic
        // Filtering receipts
        const filteredReceipts = receipts.filter((r) => {
            const matchesSearch =
                r.receipt_number.toLowerCase().includes(search.toLowerCase()) ||
                r.customer_name.toLowerCase().includes(search.toLowerCase()) ||
                r.project_name.toLowerCase().includes(search.toLowerCase()) ||
                r.unit_number.toLowerCase().includes(search.toLowerCase());

            const matchesMode = mode === "All" || r.payment_mode === mode;

            return matchesSearch && matchesMode;
        });
        const groupedReceipts = Object.values(
            filteredReceipts.reduce<Record<string, GroupedReceipt>>((acc, item) => {
                // Unique matching key requested by you
                const key = `${item.customer_name}_${item.unit_number}_${item.project_name}_${item.tower_name}`;

                if (!acc[key]) {
                    acc[key] = {
                        id: key,
                        customer_name: item.customer_name,
                        customer_phone: item.customer_phone,
                        unit_number: item.unit_number,
                        project_name: item.project_name,
                        tower_name: item.tower_name,
                        agreed_sale_value: item.agreed_sale_value, // Assuming identical for the same booking
                        total_amount_paid: 0,
                        all_receipts: [],
                    };
                }

                // Accumulate total paid amount and push the receipt into sub-records
                acc[key].total_amount_paid += item.amount;
                acc[key].all_receipts.push(item);

                return acc;
            }, {})
        );
        return groupedReceipts;
    }, [search, mode, receipts]);

    return (
        <div className="space-y-6">
            <LedgerFilterBar
                searchQuery={search} onSearchChange={setSearch}
                filterMode={mode} onModeChange={setMode}
            />
            <ReceiptTable groups={filteredData} onPrint={handlePrint} />
        </div>
    );
};