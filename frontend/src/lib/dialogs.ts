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
