import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';

const MySwal = withReactContent(Swal);

// A reusable theme base for our Swal dialogs matching our glassmorphic premium UI
const baseOptions = {
  background: 'var(--glass-bg)',
  color: 'var(--text-main)',
  backdrop: 'rgba(0,0,0,0.4)', // Darker backdrop to make the modal pop
  customClass: {
    popup: 'rounded-4 border border-secondary border-opacity-25 shadow-lg',
    title: 'fs-4 fw-bold',
    htmlContainer: 'text-muted fs-6',
    confirmButton: 'btn btn-brand mx-2 px-4',
    cancelButton: 'btn btn-outline-secondary mx-2 px-4',
  },
  buttonsStyling: false, // We use Bootstrap classes for buttons
};

/**
 * Display a professional error popup.
 */
export async function showError(title: string, text?: string) {
  return MySwal.fire({
    ...baseOptions,
    icon: 'error',
    title,
    text,
    confirmButtonText: 'OK',
  });
}

/**
 * Display a professional success popup.
 */
export async function showSuccess(title: string, text?: string) {
  return MySwal.fire({
    ...baseOptions,
    icon: 'success',
    title,
    text,
    confirmButtonText: 'OK',
  });
}

/**
 * Display a professional info/warning popup.
 */
export async function showInfo(title: string, text?: string) {
  return MySwal.fire({
    ...baseOptions,
    icon: 'info',
    title,
    text,
    confirmButtonText: 'OK',
  });
}

/**
 * Display a professional confirmation dialog.
 * Returns true if the user confirmed, false otherwise.
 */
export async function confirmAction(title: string, text?: string, confirmText: string = "Yes", cancelText: string = "Cancel"): Promise<boolean> {
  const result = await MySwal.fire({
    ...baseOptions,
    icon: 'warning',
    title,
    text,
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: cancelText,
  });
  return result.isConfirmed;
}


/**
 * Human-friendly error label mapping for DRF / API responses
 */
const FIELD_MAP: Record<string, string> = {
  customer_phone: "গ্রাহকের মোবাইল নম্বর (Phone)",
  walk_in_phone: "গ্রাহকের মোবাইল নম্বর (Phone)",
  phone: "মোবাইল নম্বর (Phone)",
  customer_name: "গ্রাহকের নাম (Customer Name)",
  walk_in_name: "গ্রাহকের নাম (Customer Name)",
  name: "নাম (Name)",
  customer: "কাস্টমার (Customer)",
  items: "পণ্য তালিকা (Items)",
  quantity: "পণ্যের পরিমাণ (Quantity)",
  unit_price: "একক মূল্য (Unit Price)",
  paid: "পরিশোধের পরিমাণ (Paid Amount)",
  amount: "টাকার পরিমাণ (Amount)",
  discount: "ডিসকাউন্ট (Discount)",
  delivery_charge: "ডেলিভারি চার্জ (Delivery Charge)",
  method: "পেমেন্ট মাধ্যম (Payment Method)",
  note: "নোট (Note)",
  sale_date: "বিক্রির তারিখ (Sale Date)",
};

function humanizeErrorString(str: string): string {
  if (!str) return "";
  const s = String(str).trim();
  if (s.startsWith("<") || s.includes("<!DOCTYPE") || s.includes("<html") || s.includes("Traceback")) {
    return "সার্ভারে অনাকাঙ্ক্ষিত ত্রুটি হয়েছে। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।";
  }
  if (s === "This field may not be blank." || s === "This field is required.") {
    return "তথ্যটি পূরণ করা আবশ্যক";
  }
  if (s.includes("Enter a valid phone number") || s.includes("valid phone")) {
    return "সঠিক ১১ ডিজিটের মোবাইল নম্বর লিখুন (যেমন: 017xxxxxxxx)";
  }
  if (s.includes("Ensure this value is greater than or equal to")) {
    return "মানটি ০ বা তার বেশি হতে হবে";
  }
  if (s.toLowerCase().includes("is out of stock")) {
    return s.replace(/'([^']+)' is out of stock\./i, "'$1' পণ্যটির স্টক শেষ হয়ে গেছে।")
            .replace(/is out of stock/i, "পণ্যটির স্টক শেষ হয়ে গেছে।");
  }
  if (s.toLowerCase().includes("in stock")) {
    return s.replace(/Only\s+([0-9.]+)\s+of\s+'([^']+)'\s+in stock\./i, "'$2' পণ্যটি স্টকে মাত্র $1 টি অবশিষ্ট আছে।")
            .replace(/insufficient stock/i, "পণ্যটির পর্যাপ্ত স্টক নেই।");
  }
  if (s.toLowerCase().includes("insufficient stock")) {
    return "পণ্যটির পর্যাপ্ত স্টক নেই";
  }
  return s;
}

/**
 * Recursively parse and format nested API validation error responses from DRF into clean, readable text.
 */
export function formatApiErrorMessage(error: any): string {
  if (!error) return "";
  if (typeof error === "string") return humanizeErrorString(error);
  
  if (error.status && error.status >= 500) {
    return "সার্ভারে প্রক্রিয়া করার সময় ত্রুটি হয়েছে। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন। (Server Error)";
  }

  if (error.data) {
    if (typeof error.data === "string") return humanizeErrorString(error.data);
    if (error.data.detail) return humanizeErrorString(String(error.data.detail));
    const formatted = formatObjectErrors(error.data);
    if (formatted) return formatted;
  }
  if (error.message) return humanizeErrorString(String(error.message));
  if (typeof error === "object") return formatObjectErrors(error);
  return humanizeErrorString(String(error));
}

function formatObjectErrors(obj: any): string {
  if (!obj) return "";
  if (typeof obj === "string") return humanizeErrorString(obj);
  if (Array.isArray(obj)) {
    return obj
      .map((item) => formatObjectErrors(item))
      .filter(Boolean)
      .join(", ");
  }
  if (typeof obj === "object" && obj !== null) {
    return Object.entries(obj)
      .map(([key, val]) => {
        const valStr = formatObjectErrors(val);
        if (!valStr) return "";
        if (key === "non_field_errors" || key === "detail" || !isNaN(Number(key))) {
          return valStr;
        }
        const fieldName = FIELD_MAP[key] || key;
        return `${fieldName}: ${valStr}`;
      })
      .filter(Boolean)
      .join(" \n• ");
  }
  return humanizeErrorString(String(obj));
}

