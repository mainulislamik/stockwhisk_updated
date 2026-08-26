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
 * Recursively parse and format nested API validation error responses from DRF into clean, readable text.
 */
export function formatApiErrorMessage(error: any): string {
  if (!error) return "";
  if (typeof error === "string") return error;
  if (error.data) {
    if (typeof error.data === "string") return error.data;
    if (error.data.detail) return String(error.data.detail);
    const formatted = formatObjectErrors(error.data);
    if (formatted) return formatted;
  }
  if (error.message) return String(error.message);
  if (typeof error === "object") return formatObjectErrors(error);
  return String(error);
}

function formatObjectErrors(obj: any): string {
  if (!obj) return "";
  if (typeof obj === "string") return obj;
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
        return `${key}: ${valStr}`;
      })
      .filter(Boolean)
      .join(" | ");
  }
  return String(obj);
}

