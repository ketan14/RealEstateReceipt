export interface Unit {
  id: number;
  project_id: number;
  tower_id: number;
  unit_number: string;
  status: 'Available' | 'Booked' | 'Registered';
  base_price: number;
  configuration: string;
}

export interface UnitCSVRow {
  tower_id: string;
  unit_number: string;
  status: string;
  base_price: string;
  configuration: string;
}

export interface Tower {
  id: number;
  project_id: number;
  name: string;
  units: Unit[];
}

export interface Project {
  id: number;
  name: string;
  location: string;
  rera_number?: string | null;
  rera_website_url?: string | null;
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
  booking_date: string;
  unit_id: number;
  receipts: ReceiptItem[];
  co_applicants: BookingCustomerInfo[];
}

// 1. Define an interface for our grouped records
export interface GroupedReceipt {
  id: string; // unique composite key
  customer_name: string;
  customer_phone: string;
  unit_number: string;
  project_name: string;
  tower_name: string;
  agreed_sale_value: number;
  total_amount_paid: number;
  all_receipts: ReceiptHistoryItem[]; // Keeps track of individual receipts inside the group
}