"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";

export interface ChatMessage {
  id?: string;
  username: string;
  message: string;
  timestamp: number;
  messageType?: "text" | "emoji" | "reaction";
}

interface SpectatorChatProps {
  matchId: string;
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  onSendReaction: (emoji: string) => void;
  isConnected: boolean;
  rateLimitedUntil?: number;
}

// Common emojis for quick reactions
const QUICK_EMOJIS = ["👏", "🔥", "💯", "🎉", "😮", "😂"];

export default function SpectatorChat({ matchId, messages, onSendMessage, onSendReaction, isConnected, rateLimitedUntil }: SpectatorChatProps) {
  const [chatInput, setChatInput] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [rateLimitCountdown, setRateLimitCountdown] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle rate limit countdown
  useEffect(() => {
    if (rateLimitedUntil && rateLimitedUntil > Date.now()) {
      const remaining = Math.ceil((rateLimitedUntil - Date.now()) / 1000);
      setRateLimitCountdown(remaining);

      const interval = setInterval(() => {
        const newRemaining = Math.ceil((rateLimitedUntil - Date.now()) / 1000);
        if (newRemaining <= 0) {
          setRateLimitCountdown(0);
          clearInterval(interval);
        } else {
          setRateLimitCountdown(newRemaining);
        }
      }, 100);

      return () => clearInterval(interval);
    } else {
      setRateLimitCountdown(0);
    }
  }, [rateLimitedUntil]);

  // Close emoji picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSendMessage = useCallback(() => {
    if (chatInput.trim() && isConnected && rateLimitCountdown === 0) {
      onSendMessage(chatInput.trim());
      setChatInput("");
    }
  }, [chatInput, isConnected, rateLimitCountdown, onSendMessage]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    if (rateLimitCountdown === 0) {
      onSendReaction(emoji);
      setShowEmojiPicker(false);
    }
  };

  const handleQuickEmoji = (emoji: string) => {
    if (rateLimitCountdown === 0) {
      onSendReaction(emoji);
    }
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const isRateLimited = rateLimitCountdown > 0;

  return (
    <div className="flex flex-col h-full bg-background-secondary">
      {/* Header */}
      <div className="px-4 py-2 border-b border-border-default flex items-center justify-between">
        <h3 className="text-text-primary font-semibold">Spectator Chat</h3>
        <div className="flex items-center gap-2">
          {/* Quick emoji reactions */}
          {QUICK_EMOJIS.map((emoji) => (
            <button key={emoji} onClick={() => handleQuickEmoji(emoji)} disabled={isRateLimited || !isConnected} className="text-lg hover:scale-125 transition-transform disabled:opacity-50 disabled:cursor-not-allowed" title={`React with ${emoji}`}>
              {emoji}
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2">
        {messages.length === 0 ? (
          <p className="text-text-muted text-sm text-center py-4">No messages yet. Start the conversation!</p>
        ) : (
          messages.map((msg, index) => (
            <div key={msg.id || index} className="text-sm group">
              <div className="flex items-baseline gap-2">
                <span className="text-accent-cyan font-semibold">{msg.username}</span>
                <span className="text-text-muted text-xs opacity-0 group-hover:opacity-100 transition-opacity">{formatTimestamp(msg.timestamp)}</span>
              </div>
              <span className="text-text-primary">{msg.message}</span>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Rate limit indicator */}
      {isRateLimited && (
        <div className="px-4 py-2 bg-accent-yellow/10 border-t border-accent-yellow/30">
          <p className="text-accent-yellow text-sm flex items-center gap-2">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
            </svg>
            Slow down! You can send another message in {rateLimitCountdown}s
          </p>
        </div>
      )}

      {/* Input area */}
      <div className="px-4 py-3 border-t border-border-default">
        <div className="flex gap-2 relative">
          {/* Emoji picker button */}
          <div className="relative" ref={emojiPickerRef}>
            <button onClick={() => setShowEmojiPicker(!showEmojiPicker)} disabled={!isConnected || isRateLimited} className="px-3 py-2 bg-background-primary border border-border-default rounded-lg text-text-secondary hover:text-accent-cyan hover:border-accent-cyan transition-colors disabled:opacity-50 disabled:cursor-not-allowed" title="Add emoji">
              😀
            </button>

            {/* Emoji picker dropdown */}
            {showEmojiPicker && (
              <div className="absolute bottom-full left-0 mb-2 z-50">
                <EmojiPickerDropdown onSelect={handleEmojiSelect} onClose={() => setShowEmojiPicker(false)} />
              </div>
            )}
          </div>

          <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyPress={handleKeyPress} placeholder={isRateLimited ? `Wait ${rateLimitCountdown}s...` : "Type a message..."} className="flex-1 px-3 py-2 bg-background-primary border border-border-default rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-cyan transition-colors disabled:opacity-50" disabled={!isConnected || isRateLimited} />

          <button onClick={handleSendMessage} disabled={!chatInput.trim() || !isConnected || isRateLimited} className="px-4 py-2 bg-accent-cyan text-background-primary rounded-lg font-semibold hover:bg-accent-cyan/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

// Inline emoji picker dropdown component
function EmojiPickerDropdown({ onSelect, onClose }: { onSelect: (emoji: string) => void; onClose: () => void }) {
  const EMOJI_GRID = [
    ["👏", "🔥", "💯", "🎉", "😮", "😂"],
    ["🤔", "👀", "❤️", "💪", "🚀", "⭐"],
    ["👍", "👎", "😱", "🤯", "🙌", "💡"],
  ];

  return (
    <div className="bg-background-secondary border border-border-default rounded-lg shadow-lg p-2">
      <div className="grid gap-1">
        {EMOJI_GRID.map((row, rowIndex) => (
          <div key={rowIndex} className="flex gap-1">
            {row.map((emoji) => (
              <button key={emoji} onClick={() => onSelect(emoji)} className="w-8 h-8 flex items-center justify-center text-xl hover:bg-background-primary rounded transition-colors">
                {emoji}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
