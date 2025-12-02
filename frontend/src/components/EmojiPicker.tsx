"use client";

import React, { useRef, useEffect } from "react";

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
  position?: "top" | "bottom";
}

// Valid emojis matching backend validation
const VALID_EMOJIS = ["👏", "🔥", "💯", "🎉", "😮", "😂", "🤔", "👀", "❤️", "💪", "🚀", "⭐", "👍", "👎", "😱", "🤯"];

// Organized emoji grid for display
const EMOJI_GRID = [
  ["👏", "🔥", "💯", "🎉", "😮", "😂"],
  ["🤔", "👀", "❤️", "💪", "🚀", "⭐"],
  ["👍", "👎", "😱", "🤯"],
];

// Emoji categories for potential future expansion
const EMOJI_CATEGORIES = {
  reactions: ["👏", "🔥", "💯", "🎉", "👍", "👎"],
  emotions: ["😮", "😂", "🤔", "😱", "🤯"],
  symbols: ["❤️", "💪", "🚀", "⭐", "👀"],
};

export default function EmojiPicker({ onSelect, onClose, position = "top" }: EmojiPickerProps) {
  const pickerRef = useRef<HTMLDivElement>(null);

  // Close picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  // Close picker on escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  const handleEmojiClick = (emoji: string) => {
    onSelect(emoji);
  };

  const positionClasses = position === "top" ? "bottom-full mb-2" : "top-full mt-2";

  return (
    <div ref={pickerRef} className={`absolute ${positionClasses} left-0 z-50 bg-background-secondary border border-border-default rounded-lg shadow-xl p-3 animate-in fade-in slide-in-from-bottom-2 duration-200`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2 pb-2 border-b border-border-default">
        <span className="text-text-secondary text-xs font-medium uppercase tracking-wide">Reactions</span>
        <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors" aria-label="Close emoji picker">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Emoji grid */}
      <div className="grid gap-1">
        {EMOJI_GRID.map((row, rowIndex) => (
          <div key={rowIndex} className="flex gap-1">
            {row.map((emoji) => (
              <button key={emoji} onClick={() => handleEmojiClick(emoji)} className="w-9 h-9 flex items-center justify-center text-xl hover:bg-accent-cyan/10 hover:scale-110 rounded-lg transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-accent-cyan/50" title={`React with ${emoji}`} aria-label={`Select ${emoji} emoji`}>
                {emoji}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// Export valid emojis for use in other components
export { VALID_EMOJIS, EMOJI_CATEGORIES };
