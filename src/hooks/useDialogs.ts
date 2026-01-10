import { useState, useCallback } from "react";

export interface ConfirmDialogState {
  open: boolean;
  title: string;
  description?: string;
  onConfirm: () => void;
  variant?: "default" | "destructive";
  confirmText?: string;
  cancelText?: string;
}

export interface AlertDialogState {
  open: boolean;
  title: string;
  description?: string;
}

const defaultConfirmDialog: ConfirmDialogState = {
  open: false,
  title: "",
  onConfirm: () => {},
};

const defaultAlertDialog: AlertDialogState = {
  open: false,
  title: "",
};

// Custom hook for managing dialog states
export function useDialogs() {
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>(defaultConfirmDialog);
  const [alertDialog, setAlertDialog] = useState<AlertDialogState>(defaultAlertDialog);

  const showConfirmDialog = useCallback((options: Omit<ConfirmDialogState, "open">) => {
    setConfirmDialog({ ...options, open: true });
  }, []);

  const showAlertDialog = useCallback((options: Omit<AlertDialogState, "open">) => {
    setAlertDialog({ ...options, open: true });
  }, []);

  const hideConfirmDialog = useCallback(() => {
    setConfirmDialog(defaultConfirmDialog);
  }, []);

  const hideAlertDialog = useCallback(() => {
    setAlertDialog(defaultAlertDialog);
  }, []);

  return {
    confirmDialog,
    alertDialog,
    showConfirmDialog,
    showAlertDialog,
    hideConfirmDialog,
    hideAlertDialog,
    setAlertDialog,
  };
}
