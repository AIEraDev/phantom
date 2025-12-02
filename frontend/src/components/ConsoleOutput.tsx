"use client";

import React, { useEffect, useRef } from "react";

export interface ConsoleOutputProps {
  stdout?: string;
  stderr?: string;
  onClear: () => void;
}

export default function ConsoleOutput({ stdout = "", stderr = "", onClear }: ConsoleOutputProps) {
  const consoleRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest output
  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [stdout, stderr]);

  const hasOutput = stdout.length > 0 || stderr.length > 0;

  return (
    <div className="h-full flex flex-col bg-background-primary">
      {/* Header */}
      <div className="bg-background-secondary px-4 py-3 border-b border-border-default flex items-center justify-between">
        <h3 className="text-text-primary font-semibold flex items-center gap-2">
          <svg className="w-5 h-5 text-accent-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Console Output
        </h3>
        <button onClick={onClear} disabled={!hasOutput} className="px-3 py-1.5 rounded-lg text-sm font-semibold transition-all duration-300 bg-background-primary text-text-secondary hover:text-text-primary hover:bg-border-default disabled:opacity-50 disabled:cursor-not-allowed">
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Clear
          </span>
        </button>
      </div>

      {/* Console Content */}
      <div ref={consoleRef} className="flex-1 overflow-y-auto p-4 font-code text-sm" data-testid="console-content">
        {!hasOutput ? (
          <div className="text-text-muted italic">No output yet. Run your code to see results here.</div>
        ) : (
          <div className="space-y-2">
            {/* Standard Output */}
            {stdout && (
              <div className="space-y-1">
                {stdout.split("\n").map((line, index) => (
                  <div key={`stdout-${index}`} className="text-text-primary">
                    {line || "\u00A0"}
                  </div>
                ))}
              </div>
            )}

            {/* Standard Error */}
            {stderr && (
              <div className="space-y-1 mt-2">
                {stderr.split("\n").map((line, index) => (
                  <div key={`stderr-${index}`} className="text-accent-red">
                    {line || "\u00A0"}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
