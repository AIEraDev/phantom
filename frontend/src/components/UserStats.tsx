"use client";

import React from "react";
import { UserStats as UserStatsType } from "@/types/match";

interface UserStatsProps {
  stats: UserStatsType;
  isLoading?: boolean;
  layout?: "default" | "compact";
}

export function UserStats({ stats, isLoading = false, layout = "default" }: UserStatsProps) {
  const gridClass = layout === "compact"
    ? "grid-cols-2 gap-3"
    : "grid-cols-2 md:grid-cols-4 gap-4";

  if (isLoading) {
    return (
      <div className={`grid ${gridClass}`}>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-background-secondary p-6 rounded-lg border border-border-default animate-pulse">
            <div className="h-4 bg-border-default rounded w-16 mb-3"></div>
            <div className="h-8 bg-border-default rounded w-20"></div>
          </div>
        ))}
      </div>
    );
  }

  const statCards = [
    {
      label: "Rating",
      value: stats.rating,
      color: "text-accent-cyan",
      icon: "⭐",
      bg: "bg-accent-cyan/10",
      border: "border-accent-cyan/20"
    },
    {
      label: "Wins",
      value: stats.wins,
      color: "text-accent-lime",
      icon: "🏆",
      bg: "bg-accent-lime/10",
      border: "border-accent-lime/20"
    },
    {
      label: "Losses",
      value: stats.losses,
      color: "text-accent-red",
      icon: "💔",
      bg: "bg-accent-red/10",
      border: "border-accent-red/20"
    },
    {
      label: "Win Rate",
      value: `${stats.winRate.toFixed(1)}%`,
      color: stats.winRate >= 50 ? "text-accent-lime" : "text-accent-yellow",
      icon: "📊",
      bg: stats.winRate >= 50 ? "bg-accent-lime/10" : "bg-accent-yellow/10",
      border: stats.winRate >= 50 ? "border-accent-lime/20" : "border-accent-yellow/20"
    },
  ];

  return (
    <div className={`grid ${gridClass}`}>
      {statCards.map((stat) => (
        <div
          key={stat.label}
          className={`
            relative overflow-hidden group p-4 rounded-xl border transition-all duration-300
            ${layout === "compact" ? "glass-card hover:border-white/20" : "bg-background-secondary border-border-default hover:border-border-glow"}
          `}
        >
          {layout === "compact" && (
            <div className={`absolute inset-0 ${stat.bg} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
          )}

          <div className="relative z-10">
            <div className="flex items-center justify-between mb-2">
              <p className="text-text-muted text-xs font-bold uppercase tracking-wider">{stat.label}</p>
              <span className={`text-lg opacity-50 group-hover:opacity-100 transition-opacity group-hover:scale-110 duration-300 transform`}>{stat.icon}</span>
            </div>
            <p className={`text-2xl font-bold ${stat.color} font-header tracking-tight`}>{stat.value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
