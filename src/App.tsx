import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Unit, ReceiptHistoryItem, BookingDetails } from "./types";
import "./App.css";
import AdminDashboard from "./Components/AdminMainComponent";
import { useAppStore } from "./store/useAppStore";
import { ErrorBanner, LoadingSpinner, SuccessBanner } from "./Components/UI/StatusMessages";
import { Header } from "./Components/UI/Header";
import { PropertyMap } from "./Components/Dashboard/PropertyExplorer";
import { UnitDetailsPanel } from "./Components/Dashboard/UnitDetailsPanel";
import { printReceipt } from "./Components/utils/receiptHandler";
import { ReceiptLedgerView } from "./Components/Dashboard/ledger/ReceiptLedgerView";
import { BookingModal } from "./Components/Models/BookingModal";
import { BookingDetailsModal } from "./Components/Models/BookingDetailsModal";

function App() {
  // Navigation & View State

  const [activeTab, setActiveTab] = useState<"explorer" | "history" | "admin">("explorer");
  //const [projects, setProjects] = useState<Project[]>([]);
  //const [receipts, setReceipts] = useState<ReceiptHistoryItem[]>([]);
  const [uniqueCombinations, setUniqueCombinations] = useState<ReceiptHistoryItem[]>([]);
  //const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Selected details state
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [isBookingOpen, setIsBookingOpen] = useState(false);


  // Subsequent/Part Payments State
  const [bookingDetails, setBookingDetails] = useState<BookingDetails | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [expandedTowers, setExpandedTowers] = useState<number[]>([]);

  const loadData = useAppStore((state) => state.loadData);
  // Grab each item individually
  const projects = useAppStore((state) => state.projects);
  const receipts = useAppStore((state) => state.receipts);
  const loading = useAppStore((state) => state.loading);
  const errorMsgState = useAppStore((state) => state.errorMsg);
  // Load Data 
  useEffect(() => {
    loadData();
  }, [loadData]);
  useEffect(() => {
    setErrorMsg(errorMsgState);
  }, [errorMsgState]);
  useEffect(() => {
    const uniqueCombinations: ReceiptHistoryItem[] = receipts.filter(
      function (this: Set<string>, item) {
        const key = `${item.customer_name}_${item.unit_number}_${item.project_name}`;
        return this.has(key) ? false : this.add(key);
      },
      new Set<string>()
    );
    setUniqueCombinations(uniqueCombinations);
  }, [receipts]);

  useEffect(() => {
    console.log("Unique combinations:", uniqueCombinations);
  }, [uniqueCombinations]);
  useEffect(() => {
  }, [projects])

  // Handle unit selection
  const selectUnitForBooking = async (unit: Unit) => {
    setSelectedUnit(unit);
    setErrorMsg(null);
    setSuccessMsg(null);
    setBookingDetails(null);
    setIsDetailsOpen(false);
    //setShowPartPaymentForm(false);
    if (unit.status === "Available") {
      //setAgreedSaleValue(unit.base_price.toString());
      //setReceiptAmount((unit.base_price * 0.1).toString()); // Default 10% booking amount
      setIsBookingOpen(true);
    } else {
      setIsBookingOpen(false);
      try {
        //setLoading(true);
        const details: BookingDetails | null = await invoke("get_booking_details_by_unit", { unitId: unit.id });
        setBookingDetails(details);
        setIsDetailsOpen(true);
      } catch (err: any) {
        console.error(err);
        setErrorMsg(err.toString() || "Failed to load booking details.");
      } finally {
        //setLoading(false);
      }
    }
  };


  const toggleTower = (towerId: number) => {
    setExpandedTowers((prev) =>
      prev.includes(towerId)
        ? prev.filter((id) => id !== towerId)
        : [...prev, towerId]
    );
  };

  useEffect(() => {
    if (activeTab !== "explorer") {
      setSelectedUnit(null);
    }
  }, [activeTab]);


  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500 selection:text-white">
      {/* Header */}
      <Header
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab)}
      />

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto p-6" >
        {/* Banner messages */}
        {errorMsg && !isBookingOpen && <ErrorBanner message={errorMsg} />}
        {successMsg && <SuccessBanner message={successMsg} />}
        {loading && <LoadingSpinner />}

        {/* Tab 1: Explorer */}
        {
          activeTab === "explorer" && !loading && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <PropertyMap
                projects={projects}
                expandedTowers={expandedTowers}
                selectedUnit={selectedUnit}
                loading={loading}
                toggleTower={toggleTower}
                selectUnitForBooking={selectUnitForBooking}
              />
              <UnitDetailsPanel
                selectedUnit={selectedUnit}
                onInitiateBooking={() => setIsBookingOpen(true)}
                onViewDetails={() => setIsDetailsOpen(true)}
                stats={{ bookingsCount: uniqueCombinations.length, revenue: receipts.reduce((a, r) => a + r.amount, 0) }}
              />
            </div>
          )
        }
        {/* Tab 2: Ledger/History */}
        {activeTab === "history" && !loading && (
          <ReceiptLedgerView
            receipts={receipts}
            handlePrint={printReceipt}
          />
        )}
        {/* Tab 3: Admin */}
        {
          activeTab === "admin" && !loading && (
            <AdminDashboard projectsRef={projects} />
          )
        }
      </main >
      {/* Booking Form Modal Overlay */}

      {
        isBookingOpen && selectedUnit && <BookingModal
          isOpen={isBookingOpen}
          selectedUnit={selectedUnit}
          setSuccessMessageFromModal={(msg: string) => setSuccessMsg(msg)}
          setErrorMsgFromModal={(msg: string) => setErrorMsg(msg)}
          setSelectedUnitFromModal={(selectedUnit) => setSelectedUnit(selectedUnit)}
          onClose={() => setIsBookingOpen(false)}
        />
      }
      {/* Booked Unit Details Modal Overlay */}
      {
        isDetailsOpen && selectedUnit && bookingDetails && <BookingDetailsModal
          isOpen={isDetailsOpen}
          selectedUnit={selectedUnit}
          bookingDetails={bookingDetails}
          projects={projects}
          errorMsgFromModal={errorMsg}
          successMsgFromModal={successMsg}
          onClose={() => setIsDetailsOpen(false)}
          setSuccessMsgFromModal={(msg: string | null) => setSuccessMsg(msg)}
          setErrorMsgFromModal={(msg: string | null) => setErrorMsg(msg)}
          setIsDetailsOpenFromModal={(isOpen: boolean) => setIsDetailsOpen(isOpen)}
          setBookingDetailsFromModal={(bookingDetails: BookingDetails | null) => setBookingDetails(bookingDetails)}
        />
      }
    </div >
  );
}

export default App;
