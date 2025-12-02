"use client";

import React, { useRef, useCallback, useEffect, useState } from "react";
import Editor, { OnMount, Monaco } from "@monaco-editor/react";
import * as monaco from "monaco-editor";

interface Particle {
  id: number;
  x: number;
  y: number;
  velocityX: number;
}

export interface CodeEditorProps {
  language: "javascript" | "python" | "typescript";
  initialCode: string;
  onChange: (code: string) => void;
  readOnly?: boolean;
  showCursor?: { line: number; column: number };
  height?: string;
  className?: string;
  enableParticles?: boolean;
  particleColor?: string;
}

export default function CodeEditor({ language, initialCode, onChange, readOnly = false, showCursor, height = "100%", className = "", enableParticles = false, particleColor = "#00ffff" }: CodeEditorProps) {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const cursorDecorationRef = useRef<string[]>([]);
  const [particles, setParticles] = useState<Particle[]>([]);
  const particleIdRef = useRef(0);
  const editorContainerRef = useRef<HTMLDivElement>(null);

  const handleEditorDidMount: OnMount = useCallback(
    (editor, monaco) => {
      editorRef.current = editor;
      monacoRef.current = monaco;

      // Detect if device is mobile/touch
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768;

      // Configure editor options with mobile optimizations
      editor.updateOptions({
        fontSize: isMobile ? 12 : 14,
        fontFamily: "JetBrains Mono, monospace",
        lineNumbers: "on",
        minimap: { enabled: !isMobile }, // Disable minimap on mobile
        scrollBeyondLastLine: false,
        automaticLayout: true,
        tabSize: 2,
        wordWrap: "on",
        readOnly,
        quickSuggestions: !readOnly,
        suggestOnTriggerCharacters: !readOnly,
        acceptSuggestionOnEnter: readOnly ? "off" : "on",
        parameterHints: { enabled: !readOnly },
        // Mobile-specific optimizations
        scrollbar: {
          vertical: isMobile ? "auto" : "visible",
          horizontal: isMobile ? "auto" : "visible",
          verticalScrollbarSize: isMobile ? 8 : 10,
          horizontalScrollbarSize: isMobile ? 8 : 10,
        },
        // Better touch support
        mouseWheelZoom: false,
        smoothScrolling: true,
        cursorBlinking: "smooth",
        cursorSmoothCaretAnimation: "on",
        // Improve performance on mobile
        renderWhitespace: isMobile ? "none" : "selection",
        renderLineHighlight: isMobile ? "none" : "all",
        occurrencesHighlight: !isMobile,
        selectionHighlight: !isMobile,
      });
    },
    [readOnly]
  );

  const handleEditorChange = useCallback(
    (value: string | undefined) => {
      if (readOnly || !value) return;

      // Create particle effect if enabled
      if (enableParticles && editorRef.current && editorContainerRef.current) {
        const position = editorRef.current.getPosition();
        if (position) {
          const coords = editorRef.current.getScrolledVisiblePosition(position);
          if (coords) {
            const containerRect = editorContainerRef.current.getBoundingClientRect();
            const newParticle: Particle = {
              id: particleIdRef.current++,
              x: coords.left,
              y: coords.top,
              velocityX: Math.random() * 30 - 15, // Random horizontal velocity
            };

            setParticles((prev) => [...prev, newParticle]);

            // Remove particle after animation completes
            setTimeout(() => {
              setParticles((prev) => prev.filter((p) => p.id !== newParticle.id));
            }, 500);
          }
        }
      }

      // Debounce onChange to prevent excessive updates
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        onChange(value);
      }, 100); // 100ms debounce
    },
    [onChange, readOnly, enableParticles]
  );

  // Update cursor decoration when showCursor prop changes
  useEffect(() => {
    if (!editorRef.current || !monacoRef.current || !showCursor) {
      // Clear existing decorations if no cursor to show
      if (cursorDecorationRef.current.length > 0 && editorRef.current) {
        cursorDecorationRef.current = editorRef.current.deltaDecorations(cursorDecorationRef.current, []);
      }
      return;
    }

    const { line, column } = showCursor;
    const decorations: monaco.editor.IModelDeltaDecoration[] = [
      {
        range: new monacoRef.current.Range(line, column, line, column + 1),
        options: {
          className: "opponent-cursor",
          beforeContentClassName: "opponent-cursor-line",
        },
      },
    ];

    cursorDecorationRef.current = editorRef.current.deltaDecorations(cursorDecorationRef.current, decorations);
  }, [showCursor]);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const beforeMount = useCallback((monaco: Monaco) => {
    // Define custom dark cyberpunk theme
    monaco.editor.defineTheme("cyberpunk", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "comment", foreground: "606070", fontStyle: "italic" },
        { token: "keyword", foreground: "00ffff", fontStyle: "bold" },
        { token: "string", foreground: "00ff00" },
        { token: "number", foreground: "ff00ff" },
        { token: "function", foreground: "ffff00" },
        { token: "variable", foreground: "ffffff" },
        { token: "type", foreground: "00ffff" },
        { token: "operator", foreground: "ff00ff" },
      ],
      colors: {
        "editor.background": "#0a0a0f",
        "editor.foreground": "#ffffff",
        "editor.lineHighlightBackground": "#1a1a2e",
        "editor.selectionBackground": "#2a2a4a",
        "editor.inactiveSelectionBackground": "#1a1a2e",
        "editorCursor.foreground": "#00ffff",
        "editorLineNumber.foreground": "#606070",
        "editorLineNumber.activeForeground": "#00ffff",
        "editor.selectionHighlightBackground": "#2a2a4a",
        "editor.wordHighlightBackground": "#2a2a4a",
        "editorIndentGuide.background": "#2a2a4a",
        "editorIndentGuide.activeBackground": "#00ffff",
        "editorBracketMatch.background": "#2a2a4a",
        "editorBracketMatch.border": "#00ffff",
      },
    });
  }, []);

  return (
    <div ref={editorContainerRef} className={`code-editor-wrapper relative h-full ${className}`}>
      <Editor
        height={height}
        language={language}
        value={initialCode}
        onChange={handleEditorChange}
        onMount={handleEditorDidMount}
        beforeMount={beforeMount}
        theme="cyberpunk"
        options={{
          readOnly,
          minimap: { enabled: typeof window !== "undefined" && window.innerWidth >= 768 },
          scrollBeyondLastLine: false,
          fontSize: typeof window !== "undefined" && window.innerWidth < 768 ? 12 : 14,
          fontFamily: "JetBrains Mono, monospace",
          lineNumbers: "on",
          automaticLayout: true,
          tabSize: 2,
          wordWrap: "on",
          scrollbar: {
            vertical: typeof window !== "undefined" && window.innerWidth < 768 ? "auto" : "visible",
            horizontal: typeof window !== "undefined" && window.innerWidth < 768 ? "auto" : "visible",
            verticalScrollbarSize: typeof window !== "undefined" && window.innerWidth < 768 ? 8 : 10,
            horizontalScrollbarSize: typeof window !== "undefined" && window.innerWidth < 768 ? 8 : 10,
          },
        }}
      />
      {/* Typing Particles */}
      {enableParticles && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {particles.map((particle) => (
            <div
              key={particle.id}
              className="absolute w-1 h-1 rounded-full animate-particle"
              style={
                {
                  left: `${particle.x}px`,
                  top: `${particle.y}px`,
                  backgroundColor: particleColor,
                  "--x": `${particle.velocityX}px`,
                } as React.CSSProperties
              }
            />
          ))}
        </div>
      )}
      <style jsx global>{`
        .opponent-cursor {
          background-color: rgba(255, 0, 255, 0.3);
          border-left: 2px solid #ff00ff;
        }
        .opponent-cursor-line {
          border-left: 2px solid #ff00ff;
        }
      `}</style>
    </div>
  );
}
