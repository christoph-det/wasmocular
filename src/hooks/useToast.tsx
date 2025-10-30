import { Toaster } from "@/components/ui/sonner";
import { useMemo, type ReactNode } from "react";
import { toast } from "sonner";

export type ToastVariant = "info" | "success" | "error";

interface UseToastResult {
  showInfo: (message: string) => void;
  showSuccess: (message: string) => void;
  showError: (message: string) => void;
}

export const ToastProvider = ({ children }: { children: ReactNode }) => (
  <>
    {children}
    <Toaster position="bottom-right" richColors closeButton />
  </>
);

// eslint-disable-next-line react-refresh/only-export-components
export const useToast = (): UseToastResult => {
  return useMemo<UseToastResult>(() => {
    return {
      showInfo: (message) => toast(message),
      showSuccess: (message) => toast.success(message),
      showError: (message) => toast.error(message)
    };
  }, []);
};
