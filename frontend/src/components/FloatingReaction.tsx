"use client";

import React, { useState, useEffect, useCallback } from "react";

export interface Reaction {
  id: string;
  emoji: string;
  username: string;
  position: { x: number; y: number };
  createdAt: number;
}

interface FloatingReactionProps {
  reactions: Reaction[];
  onReactionComplete?: (id: string) => void;
}

// Animation duration in milliseconds
const ANIMATION_DURATION = 3000;

export default function FloatingReaction({ reactions, onReactionComplete }: FloatingReactionProps) {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-40">
      {reactions.map((reaction) => (
        <SingleReaction key={reaction.id} reaction={reaction} onComplete={() => onReactionComplete?.(reaction.id)} />
      ))}
    </div>
  );
}

interface SingleReactionProps {
  reaction: Reaction;
  onComplete: () => void;
}

function SingleReaction({ reaction, onComplete }: SingleReactionProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // Remove reaction after animation completes
    const timer = setTimeout(() => {
      setIsVisible(false);
      onComplete();
    }, ANIMATION_DURATION);

    return () => clearTimeout(timer);
  }, [onComplete]);

  if (!isVisible) return null;

  // Calculate starting position based on percentage
  const startX = `${reaction.position.x}%`;
  const startY = `${reaction.position.y}%`;

  return (
    <div
      className="absolute animate-float-up"
      style={{
        left: startX,
        bottom: `${100 - reaction.position.y}%`,
        transform: "translateX(-50%)",
      }}
    >
      <div className="flex flex-col items-center">
        <span className="text-4xl drop-shadow-lg">{reaction.emoji}</span>
        <span className="text-xs text-text-secondary bg-background-secondary/80 px-2 py-0.5 rounded-full mt-1 whitespace-nowrap">{reaction.username}</span>
      </div>
    </div>
  );
}

// Hook to manage floating reactions
export function useFloatingReactions() {
  const [reactions, setReactions] = useState<Reaction[]>([]);

  const addReaction = useCallback((emoji: string, username: string, position?: { x: number; y: number }) => {
    const newReaction: Reaction = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      emoji,
      username,
      position: position || {
        x: Math.random() * 80 + 10, // 10-90% of width
        y: Math.random() * 20 + 75, // 75-95% of height (bottom area)
      },
      createdAt: Date.now(),
    };

    setReactions((prev) => [...prev, newReaction]);
  }, []);

  const removeReaction = useCallback((id: string) => {
    setReactions((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const clearReactions = useCallback(() => {
    setReactions([]);
  }, []);

  return {
    reactions,
    addReaction,
    removeReaction,
    clearReactions,
  };
}
