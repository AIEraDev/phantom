"use client";

import { useState } from "react";
import { motion } from "framer-motion";

interface RetryButtonProps {
  onRetry: () => void | Promise<void>;
  children?: React.ReactNode;
  className?: string;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "ghost";
}

/**
 * Retry button component for failed operations
 * Shows loading state during retry
 */
export function RetryButton({ onRetry, children = "Retry", className = "", disabled = false, variant = "primary" }: RetryButtonProps) {
  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetry = async () => {
    if (isRetrying || disabled) return;

    setIsRetrying(true);
    try {
      await onRetry();
    } finally {
      setIsRetrying(false);
    }
  };

  const variantClasses = {
    primary: "bg-accent-cyan text-background-primary hover:shadow-neon-cyan",
    secondary: "bg-background-secondary text-text-primary border border-border-default hover:border-accent-cyan",
    ghost: "bg-transparent text-accent-cyan hover:bg-accent-cyan/10",
  };

  return (
    <button
      onClick={handleRetry}
      disabled={disabled || isRetrying}
      className={`
        px-6 py-3 rounded-lg font-semibold transition-all duration-300
        disabled:opacity-50 disabled:cursor-not-allowed
        flex items-center gap-2 justify-center
        ${variantClasses[variant]}
        ${className}
      `}
    >
      {isRetrying ? (
        <>
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="w-5 h-5 border-2 border-current border-t-transparent rounded-full" />
          <span>Retrying...</span>
        </>
      ) : (
        <>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span>{children}</span>
        </>
      )}
    </button>
  );
}

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void | Promise<void>;
  showRetry?: boolean;
}

/**
 * Error state component with retry button
 * Displays error message and optional retry action
 */
export function ErrorState({ title = "Something went wrong", message, onRetry, showRetry = true }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <div className="text-6xl mb-4">⚠️</div>
      <h3 className="text-xl font-header font-bold text-accent-red mb-2">{title}</h3>
      <p className="text-text-secondary mb-6 max-w-md">{message}</p>
      {showRetry && onRetry && <RetryButton onRetry={onRetry} variant="primary" />}
    </div>
  );
}

interface EmptyStateProps {
  title: string;
  message: string;
  icon?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

/**
 * Empty state component for when no data is available
 */
export function EmptyState({ title, message, icon = "📭", action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <div className="text-6xl mb-4">{icon}</div>
      <h3 className="text-xl font-header font-bold text-text-primary mb-2">{title}</h3>
      <p className="text-text-secondary mb-6 max-w-md">{message}</p>
      {action && (
        <button onClick={action.onClick} className="px-6 py-3 bg-accent-cyan text-background-primary font-semibold rounded-lg hover:shadow-neon-cyan transition-all duration-300">
          {action.label}
        </button>
      )}
    </div>
  );
}
