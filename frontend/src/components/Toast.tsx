"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export type ToastType = "success" | "error" | "warning" | "info";

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastProps {
  toast: Toast;
  onClose: (id: string) => void;
}

const toastStyles: Record<ToastType, string> = {
  success: "bg-accent-lime/20 border-accent-lime text-accent-lime",
  error: "bg-accent-red/20 border-accent-red text-accent-red",
  warning: "bg-accent-yellow/20 border-accent-yellow text-accent-yellow",
  info: "bg-accent-cyan/20 border-accent-cyan text-accent-cyan",
};

const toastIcons: Record<ToastType, string> = {
  success: "✓",
  error: "✕",
  warning: "⚠",
  info: "ℹ",
};

function ToastItem({ toast, onClose }: ToastProps) {
  useEffect(() => {
    const duration = toast.duration || 5000;
    const timer = setTimeout(() => {
      onClose(toast.id);
    }, duration);

    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onClose]);

  return (
    <motion.div initial={{ opacity: 0, y: -20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, x: 100, scale: 0.95 }} transition={{ duration: 0.2 }} className={`flex items-center gap-3 px-4 py-3 rounded-lg border backdrop-blur-md shadow-lg min-w-[300px] max-w-md ${toastStyles[toast.type]}`}>
      <div className="text-xl font-bold">{toastIcons[toast.type]}</div>
      <p className="flex-1 text-sm font-medium">{toast.message}</p>
      <button onClick={() => onClose(toast.id)} className="text-lg hover:opacity-70 transition-opacity" aria-label="Close">
        ×
      </button>
    </motion.div>
  );
}

interface ToastContainerProps {
  toasts: Toast[];
  onClose: (id: string) => void;
}

export function ToastContainer({ toasts, onClose }: ToastContainerProps) {
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onClose={onClose} />
        ))}
      </AnimatePresence>
    </div>
  );
}

// Toast manager hook
let toastCounter = 0;
const toastListeners: Set<(toasts: Toast[]) => void> = new Set();
let toasts: Toast[] = [];

function notifyListeners() {
  toastListeners.forEach((listener) => listener([...toasts]));
}

export const toastManager = {
  show: (message: string, type: ToastType = "info", duration?: number) => {
    const id = `toast-${++toastCounter}`;
    const toast: Toast = { id, message, type, duration };
    toasts = [...toasts, toast];
    notifyListeners();
    return id;
  },

  success: (message: string, duration?: number) => {
    return toastManager.show(message, "success", duration);
  },

  error: (message: string, duration?: number) => {
    return toastManager.show(message, "error", duration);
  },

  warning: (message: string, duration?: number) => {
    return toastManager.show(message, "warning", duration);
  },

  info: (message: string, duration?: number) => {
    return toastManager.show(message, "info", duration);
  },

  dismiss: (id: string) => {
    toasts = toasts.filter((t) => t.id !== id);
    notifyListeners();
  },

  dismissAll: () => {
    toasts = [];
    notifyListeners();
  },

  subscribe: (listener: (toasts: Toast[]) => void) => {
    toastListeners.add(listener);
    return () => {
      toastListeners.delete(listener);
    };
  },
};

export function useToast() {
  const [toastList, setToastList] = useState<Toast[]>([]);

  useEffect(() => {
    return toastManager.subscribe(setToastList);
  }, []);

  return {
    toasts: toastList,
    show: toastManager.show,
    success: toastManager.success,
    error: toastManager.error,
    warning: toastManager.warning,
    info: toastManager.info,
    dismiss: toastManager.dismiss,
    dismissAll: toastManager.dismissAll,
  };
}
