// Form Validations
export const validateForm = (customerName: string, customerPhone: string, customerPan: string, customerAadhaar: string, coApplicants: string | any[], agreedSaleValue: string, receiptAmount: string, paymentMode: string, transactionRef: string): string | null => {
    if (!customerName.trim()) return "Customer Name is required.";
    if (!customerPhone.trim() || !/^\d{10}$/.test(customerPhone.trim())) {
        return "Customer Phone must be a valid 10-digit number.";
    }

    // PAN regex: 5 letters, 4 digits, 1 letter
    const cleanPan = customerPan.trim().toUpperCase();
    if (!cleanPan || !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(cleanPan)) {
        return "Invalid PAN Number format (e.g. ABCDE1234F).";
    }

    // Aadhaar: 12 digits, first digit must be 2–9 per UIDAI spec
    const cleanAadhaar = customerAadhaar.trim();
    if (!cleanAadhaar || !/^[2-9]\d{11}$/.test(cleanAadhaar)) {
        return "Invalid Aadhaar Number (must be exactly 12 digits and cannot start with 0 or 1).";
    }

    // Co-applicants validation
    for (let i = 0; i < coApplicants.length; i++) {
        const co = coApplicants[i];
        if (!co.name.trim()) return `Co-Applicant ${i + 1} Name is required.`;
        if (!co.phone.trim() || !/^\d{10}$/.test(co.phone.trim())) {
            return `Co-Applicant ${i + 1} Phone must be a valid 10-digit number.`;
        }
        const coPan = co.pan_number.trim().toUpperCase();
        if (!coPan || !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(coPan)) {
            return `Invalid Co-Applicant ${i + 1} PAN Number format (e.g. ABCDE1234F).`;
        }
        const coAadhaar = co.aadhaar_number.trim();
        if (!coAadhaar || !/^[2-9]\d{11}$/.test(coAadhaar)) {
            return `Invalid Co-Applicant ${i + 1} Aadhaar Number (must be exactly 12 digits and cannot start with 0 or 1).`;
        }
    }

    const saleVal = parseFloat(agreedSaleValue);
    const recVal = parseFloat(receiptAmount);

    if (isNaN(saleVal) || saleVal <= 0) {
        return "Agreed Sale Value must be a valid number greater than zero.";
    }
    if (isNaN(recVal) || recVal <= 0) {
        return "Receipt Amount must be a valid number greater than zero.";
    }
    if (recVal > saleVal) {
        return "Receipt/Booking Amount cannot exceed the Agreed Sale Value.";
    }
    if (paymentMode !== "Cash" && !transactionRef.trim()) {
        return `Transaction Reference number is required for ${paymentMode} mode.`;
    }

    return null;
};