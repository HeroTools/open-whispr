import * as React from "react";
import { X } from "lucide-react";

export interface ToastProps {
  id?: string;
  title?: string;
  description?: string;
  action?: React.ReactNode;
  variant?: "default" | "destructive" | "success";
  duration?: number;
  onClose?: () => void;
}

export interface ToastContextType {
  toast: (props: Omit<ToastProps, "id">) => void;
  dismiss: (id?: string) => void;
}

const ToastContext = React.createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = React.useState<(ToastProps & { id: string })[]>([]);

  const toast = React.useCallback((props: Omit<ToastProps, "id">) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newToast = { ...props, id };

    setToasts((prev) => [...prev, newToast]);

    // Auto-dismiss after duration
    const duration = props.duration ?? 3500;
    if (duration > 0) {
      setTimeout(() => {
        dismiss(id);
      }, duration);
    }

    return id;
  }, []);

  const dismiss = React.useCallback((id?: string) => {
    setToasts((prev) => {
      if (id) {
        return prev.filter((toast) => toast.id !== id);
      }
      return prev.slice(0, -1);
    });
  }, []);

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
};

const ToastViewport: React.FC<{
  toasts: (ToastProps & { id: string })[];
  onDismiss: (id: string) => void;
}> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed right-4 bottom-4 z-50 flex max-w-sm flex-col gap-2">
      {toasts.map((toast) => (
        <Toast key={toast.id} {...toast} onClose={() => onDismiss(toast.id)} />
      ))}
    </div>
  );
};

const Toast: React.FC<ToastProps & { onClose?: () => void }> = ({
  title,
  description,
  action,
  variant = "default",
  onClose,
}) => {
  const baseClasses =
    "relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-lg border p-4 pr-8 shadow-lg transition-all duration-300 ease-in-out";

  const variantClasses = {
    default: "bg-white border-gray-200 text-gray-900",
    destructive: "bg-red-50 border-red-200 text-red-900",
    success: "bg-green-50 border-green-200 text-green-900",
  };

  const iconClasses = {
    default: "text-gray-400",
    destructive: "text-red-400",
    success: "text-green-400",
  };

  return (
    <div className={`${baseClasses} ${variantClasses[variant]}`}>
      <div className="flex-1 space-y-1">
        {title && <div className="text-sm font-medium">{title}</div>}
        {description && <div className="text-sm opacity-90">{description}</div>}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
      {onClose && (
        <button
          onClick={onClose}
          className={`absolute top-2 right-2 rounded-sm opacity-70 ring-offset-white transition-opacity hover:opacity-100 focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 focus:outline-none ${iconClasses[variant]}`}
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </button>
      )}
    </div>
  );
};

// Helper function for common toast patterns
export const toast = {
  success: (message: string) => ({
    title: "Success",
    description: message,
    variant: "success" as const,
  }),
  error: (message: string) => ({
    title: "Error",
    description: message,
    variant: "destructive" as const,
  }),
  info: (message: string) => ({
    description: message,
    variant: "default" as const,
  }),
};
