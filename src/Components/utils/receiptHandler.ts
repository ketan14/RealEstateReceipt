// Print receipt as PDF — uses Tauri backend to open in system browser

import { invoke } from "@tauri-apps/api/core";
import { buildReceiptHtml } from "./receiptTemplate";
import { ReceiptHistoryItem } from "../../types";

// (window.print() is NOT supported inside Tauri's WKWebView on macOS)
export const printReceipt = async (item: ReceiptHistoryItem) => {
  try {
    const html = buildReceiptHtml(item);
    const filename = `receipt_${item.receipt_number}`;
    await invoke("generate_and_open_pdf", { html, filename });
  } catch (err: any) {
    console.error("Print failed:", err);
    throw new Error(`Failed to open receipt: ${err.message || err}`);
  }
};

/**
 * 
 * <button
  onClick={async () => {
    try {
      await printReceipt(receipt);
    } catch (err: any) {
      // You can now handle the error globally or locally
      setErrorMsg(err.message); 
    }
  }}
>
  Print Receipt
</button>
 */