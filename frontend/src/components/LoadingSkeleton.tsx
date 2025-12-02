"use client";

import { motion } from "framer-motion";

interface LoadingSkeletonProps {
  className?: string;
  variant?: "text" | "circular" | "rectangular";
  width?: string | number;
  height?: string | number;
  animate?: boolean;
}

/**
 * Loading skeleton component for displaying loading states
 */
export function LoadingSkeleton({ className = "", variant = "rectangular", width, height, animate = true }: LoadingSkeletonProps) {
  const baseClasses = "bg-background-secondary/50 backdrop-blur-sm";

  const variantClasses = {
    text: "rounded h-4",
    circular: "rounded-full",
    rectangular: "rounded-lg",
  };

  const style: React.CSSProperties = {
    width: width || "100%",
    height: height || (variant === "text" ? "1rem" : variant === "circular" ? "40px" : "100px"),
  };

  if (animate) {
    return (
      <motion.div
        className={`${baseClasses} ${variantClasses[variant]} ${className}`}
        style={style}
        animate={{
          opacity: [0.5, 0.8, 0.5],
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
    );
  }

  return <div className={`${baseClasses} ${variantClasses[variant]} ${className}`} style={style} />;
}

/**
 * User stats loading skeleton
 */
export function UserStatsLoadingSkeleton() {
  return (
    <div className="glass-card p-6 space-y-4">
      <LoadingSkeleton variant="text" width="60%" height="2rem" />
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <LoadingSkeleton variant="text" width="40%" />
          <LoadingSkeleton variant="text" width="60%" height="1.5rem" />
        </div>
        <div className="space-y-2">
          <LoadingSkeleton variant="text" width="40%" />
          <LoadingSkeleton variant="text" width="60%" height="1.5rem" />
        </div>
        <div className="space-y-2">
          <LoadingSkeleton variant="text" width="40%" />
          <LoadingSkeleton variant="text" width="60%" height="1.5rem" />
        </div>
        <div className="space-y-2">
          <LoadingSkeleton variant="text" width="40%" />
          <LoadingSkeleton variant="text" width="60%" height="1.5rem" />
        </div>
      </div>
    </div>
  );
}

/**
 * Match history loading skeleton
 */
export function MatchHistoryLoadingSkeleton() {
  return (
    <div className="glass-card p-6 space-y-4">
      <LoadingSkeleton variant="text" width="40%" height="1.5rem" />
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-4 p-4 bg-background-secondary/30 rounded-lg">
            <LoadingSkeleton variant="circular" width="48px" height="48px" />
            <div className="flex-1 space-y-2">
              <LoadingSkeleton variant="text" width="70%" />
              <LoadingSkeleton variant="text" width="50%" />
            </div>
            <LoadingSkeleton variant="rectangular" width="80px" height="32px" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Leaderboard loading skeleton
 */
export function LeaderboardLoadingSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
        <div key={i} className="flex items-center gap-4 p-4 glass-card">
          <LoadingSkeleton variant="text" width="40px" />
          <LoadingSkeleton variant="circular" width="40px" height="40px" />
          <div className="flex-1 space-y-2">
            <LoadingSkeleton variant="text" width="60%" />
            <LoadingSkeleton variant="text" width="40%" />
          </div>
          <LoadingSkeleton variant="text" width="80px" />
        </div>
      ))}
    </div>
  );
}

/**
 * Code editor loading skeleton
 */
export function CodeEditorLoadingSkeleton() {
  return (
    <div className="w-full h-full bg-background-secondary rounded-lg p-4 space-y-2">
      <LoadingSkeleton variant="text" width="30%" />
      <LoadingSkeleton variant="text" width="60%" />
      <LoadingSkeleton variant="text" width="45%" />
      <LoadingSkeleton variant="text" width="70%" />
      <LoadingSkeleton variant="text" width="40%" />
      <LoadingSkeleton variant="text" width="55%" />
      <LoadingSkeleton variant="text" width="65%" />
    </div>
  );
}

/**
 * Card loading skeleton
 */
export function CardLoadingSkeleton() {
  return (
    <div className="glass-card p-6 space-y-4">
      <LoadingSkeleton variant="text" width="70%" height="1.5rem" />
      <LoadingSkeleton variant="rectangular" height="200px" />
      <div className="space-y-2">
        <LoadingSkeleton variant="text" width="100%" />
        <LoadingSkeleton variant="text" width="90%" />
        <LoadingSkeleton variant="text" width="80%" />
      </div>
    </div>
  );
}
