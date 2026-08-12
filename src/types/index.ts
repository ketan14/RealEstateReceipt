export interface Unit {
  id: number;
  project_id: number;
  tower_id: number;
  unit_number: string;
  status: 'Available' | 'Booked' | 'Registered';
  base_price: number;
  configuration: string;
  carpet_area_sqm?: number;
  projectName?: string;
  towerName?: string;
}

export interface UnitCSVRow {
  tower_id: string;
  unit_number: string;
  status: string;
  base_price: string;
  configuration: string;
  carpet_area_sqm?: string;
}

export interface Tower {
  id: number;
  project_id: number;
  name: string;
  units: Unit[];
  floor: number;
}

export interface Project {
  id: number;
  name: string;
  location: string;
  rera_number?: string | null;
  rera_website_url?: string | null;
  is_metro?: boolean;
  occupancy_certificate_date?: string | null;
  towers: Tower[];
}

export interface Customer {
  id?: number;
  name: string;
  phone: string;
  pan_number: string;
  aadhaar_number: string;
}

export interface BookingPayload {
  customer: Customer;
  co_applicants?: Customer[];
  unit_id: number;
  booking_date: string;
  agreed_sale_value: number;
  receipt_amount: number;
  payment_mode: 'Cash' | 'Cheque' | 'RTGS' | 'IMPS';
  transaction_ref: string;
}

export interface ReceiptHistoryItem {
  receipt_id: number;
  receipt_number: string;
  amount: number;
  payment_mode: 'Cash' | 'Cheque' | 'RTGS' | 'IMPS';
  transaction_ref: string;
  date: string;
  status: string;
  void_reason?: string | null;
  gst_rate?: number | null;
  gst_amount?: number | null;
  taxable_value?: number | null;
  tds_amount?: number | null;
  gst_basis?: string | null;
  booking_id: number;
  agreed_sale_value: number;
  booking_date: string;
  customer_name: string;
  customer_phone: string;
  customer_pan: string;
  customer_aadhaar: string;
  unit_number: string;
  project_name: string;
  tower_name: string;
  rera_number?: string | null;
  co_applicants?: BookingCustomerInfo[] | null;
}

export interface ReceiptItem {
  id: number;
  receipt_number: string;
  amount: number;
  payment_mode: 'Cash' | 'Cheque' | 'RTGS' | 'IMPS';
  transaction_ref: string;
  date: string;
  status: string;
  void_reason?: string | null;
  gst_rate?: number | null;
  gst_amount?: number | null;
  taxable_value?: number | null;
  tds_amount?: number | null;
  gst_basis?: string | null;
}

export interface BookingCustomerInfo {
  customer_id: number;
  role: string;
  name: string;
  phone: string;
  pan_number: string;
  aadhaar_number: string;
}

export interface BookingDetails {
  id: number;
  customer_name: string;
  customer_phone: string;
  customer_pan: string;
  customer_aadhaar: string;
  agreed_sale_value: number;
  total_gst_liability: number;
  total_contract_value: number;
  gst_basis: string;
  booking_date: string;
  unit_id: number;
  receipts: ReceiptItem[];
  co_applicants: BookingCustomerInfo[];
}

export interface GroupedReceipt {
  id: string;
  customer_name: string;
  customer_phone: string;
  unit_number: string;
  project_name: string;
  tower_name: string;
  agreed_sale_value: number;
  total_amount_paid: number;
  all_receipts: ReceiptHistoryItem[];
}

export interface CustomerPropertySummary {
  booking_id: number;
  unit_number: string;
  project_name: string;
  tower_name: string;
  agreed_sale_value: number;
  total_paid: number;
  outstanding_balance: number;
  role: string;
  receipts: ReceiptItem[];
}

export interface CustomerProfile {
  customer: Customer;
  properties: CustomerPropertySummary[];
  grand_total_agreed: number;
  grand_total_paid: number;
  grand_total_outstanding: number;
}

export interface PaymentScheduleItem {
  id: number;
  booking_id: number;
  milestone_name: string;
  due_date?: string | null;
  percentage: number;
  due_amount: number;
  status: 'Pending' | 'Partially Paid' | 'Paid' | 'Overdue';
  created_at?: string;
  updated_at?: string;
}

export interface PaymentMilestoneInput {
  milestone_name: string;
  due_date?: string | null;
  percentage: number;
  due_amount: number;
}

export interface ProjectRevenueSummary {
  project_id: number;
  project_name: string;
  total_units: number;
  booked_units: number;
  total_agreed_value: number;
  total_collected: number;
  total_outstanding: number;
}

export interface FinancialDashboardStats {
  total_revenue: number;
  total_collected: number;
  total_outstanding: number;
  overdue_amount: number;
  total_units: number;
  booked_units: number;
  available_units: number;
  registered_units: number;
  project_summaries: ProjectRevenueSummary[];
}

export interface OverdueMilestoneReport {
  milestone_id: number;
  booking_id: number;
  milestone_name: string;
  due_date: string;
  due_amount: number;
  status: string;
  customer_name: string;
  customer_phone: string;
  unit_number: string;
  project_name: string;
}