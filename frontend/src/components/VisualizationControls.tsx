"use client";

import React from "react";

interface VisualizationControlsProps {
  isPlaying: boolean;
  speed: number;
  currentStep: number;
  totalSteps: number;
  is3DMode: boolean;
  webGLSupported: boolean;
  onPlayPause: () => void;
  onSpeedChange: (speed: number) => void;
  onStepForward: () => void;
  onStepBackward: () => void;
  onToggle3D: () => void;
}

export default function VisualizationControls({ isPlaying, speed, currentStep, totalSteps, is3DMode, webGLSupported, onPlayPause, onSpeedChange, onStepForward, onStepBackward, onToggle3D }: VisualizationControlsProps) {
  const speedOptions = [0.5, 1, 2, 4];

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-background-primary border-t border-border-default">
      {/* Playback Controls */}
      <div className="flex items-center gap-2">
        {/* Step Backward */}
        <button onClick={onStepBackward} disabled={currentStep <= 0 || isPlaying} className="p-2 rounded-lg bg-background-secondary hover:bg-background-tertiary disabled:opacity-50 disabled:cursor-not-allowed transition-colors" title="Step Backward">
          <svg className="w-5 h-5 text-text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.333 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z" />
          </svg>
        </button>

        {/* Play/Pause */}
        <button onClick={onPlayPause} disabled={currentStep >= totalSteps && !isPlaying} className="p-3 rounded-lg bg-accent-cyan hover:bg-accent-cyan/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors" title={isPlaying ? "Pause" : "Play"}>
          {isPlaying ? (
            <svg className="w-5 h-5 text-background-primary" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-background-primary" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        {/* Step Forward */}
        <button onClick={onStepForward} disabled={currentStep >= totalSteps || isPlaying} className="p-2 rounded-lg bg-background-secondary hover:bg-background-tertiary disabled:opacity-50 disabled:cursor-not-allowed transition-colors" title="Step Forward">
          <svg className="w-5 h-5 text-text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.933 12.8a1 1 0 000-1.6L6.6 7.2A1 1 0 005 8v8a1 1 0 001.6.8l5.333-4zM19.933 12.8a1 1 0 000-1.6l-5.333-4A1 1 0 0013 8v8a1 1 0 001.6.8l5.333-4z" />
          </svg>
        </button>
      </div>

      {/* Progress Indicator */}
      <div className="flex items-center gap-3">
        <span className="text-text-secondary text-sm font-code">
          Step {currentStep} / {totalSteps}
        </span>
        <div className="w-32 h-2 bg-background-tertiary rounded-full overflow-hidden">
          <div className="h-full bg-accent-cyan transition-all duration-200" style={{ width: `${totalSteps > 0 ? (currentStep / totalSteps) * 100 : 0}%` }} />
        </div>
      </div>

      {/* Speed Control */}
      <div className="flex items-center gap-2">
        <span className="text-text-muted text-sm">Speed:</span>
        <div className="flex gap-1">
          {speedOptions.map((s) => (
            <button key={s} onClick={() => onSpeedChange(s)} className={`px-2 py-1 rounded text-xs font-medium transition-colors ${speed === s ? "bg-accent-cyan text-background-primary" : "bg-background-secondary text-text-secondary hover:bg-background-tertiary"}`}>
              {s}x
            </button>
          ))}
        </div>
      </div>

      {/* 2D/3D Toggle */}
      <button onClick={onToggle3D} disabled={!webGLSupported} className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${is3DMode ? "bg-accent-magenta/20 text-accent-magenta border border-accent-magenta/50" : "bg-background-secondary text-text-secondary hover:bg-background-tertiary"} disabled:opacity-50 disabled:cursor-not-allowed`} title={webGLSupported ? "Toggle 2D/3D View" : "WebGL not supported"}>
        {is3DMode ? "3D" : "2D"}
      </button>
    </div>
  );
}
