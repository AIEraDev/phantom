"use client";

import { useState, useEffect } from "react";
import { ToastContainer, useToast } from "./Toast";

/**
 * Toast Provider component to be added to the root layout
 * Manages and displays toast notifications
 */
export function ToastProvider() {
  const [mounted, setMounted] = useState(false);
  const { toasts, dismiss } = useToast();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return <ToastContainer toasts={toasts} onClose={dismiss} />;
}
