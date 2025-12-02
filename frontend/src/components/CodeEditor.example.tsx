/**
 * CodeEditor Component Usage Examples
 *
 * This file demonstrates how to use the CodeEditor component in different scenarios.
 */

import React, { useState } from "react";
import CodeEditor from "./CodeEditor";

// Example 1: Basic JavaScript Editor
export function BasicJavaScriptEditor() {
  const [code, setCode] = useState('console.log("Hello World");');

  return (
    <div className="h-screen">
      <CodeEditor language="javascript" initialCode={code} onChange={setCode} />
    </div>
  );
}

// Example 2: Python Editor with Custom Height
export function PythonEditorWithHeight() {
  const [code, setCode] = useState('print("Hello World")');

  return (
    <div>
      <h2>Python Editor</h2>
      <CodeEditor language="python" initialCode={code} onChange={setCode} height="600px" />
    </div>
  );
}

// Example 3: Read-Only Editor (for viewing opponent's code)
export function ReadOnlyEditor() {
  const opponentCode = `function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}`;

  return (
    <div className="h-screen">
      <h2>Opponent's Code</h2>
      <CodeEditor
        language="javascript"
        initialCode={opponentCode}
        onChange={() => {}} // No-op since it's read-only
        readOnly={true}
      />
    </div>
  );
}

// Example 4: Editor with Opponent Cursor
export function EditorWithOpponentCursor() {
  const [code, setCode] = useState("const x = 1;\nconst y = 2;");
  const [opponentCursor, setOpponentCursor] = useState({ line: 1, column: 7 });

  // Simulate opponent cursor movement
  React.useEffect(() => {
    const interval = setInterval(() => {
      setOpponentCursor((prev) => ({
        line: prev.line,
        column: (prev.column + 1) % 15,
      }));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="h-screen">
      <h2>Your Code (with opponent cursor visible)</h2>
      <CodeEditor language="javascript" initialCode={code} onChange={setCode} showCursor={opponentCursor} />
    </div>
  );
}

// Example 5: TypeScript Editor with Custom Styling
export function StyledTypeScriptEditor() {
  const [code, setCode] = useState(`interface User {
  id: number;
  name: string;
}

const user: User = {
  id: 1,
  name: "Alice"
};`);

  return (
    <div className="p-4 bg-gray-900">
      <h2 className="text-white mb-4">TypeScript Editor</h2>
      <CodeEditor language="typescript" initialCode={code} onChange={setCode} className="border-2 border-cyan-500 rounded-lg" height="500px" />
    </div>
  );
}

// Example 6: Battle Arena Setup (Split View)
export function BattleArenaExample() {
  const [playerCode, setPlayerCode] = useState("// Your code here");
  const [opponentCode] = useState("// Opponent code here");
  const [opponentCursor, setOpponentCursor] = useState({ line: 1, column: 1 });

  return (
    <div className="flex h-screen">
      {/* Player's Editor (60%) */}
      <div className="w-3/5 border-r border-gray-700">
        <h3 className="text-white p-2 bg-gray-800">Your Code</h3>
        <CodeEditor language="javascript" initialCode={playerCode} onChange={setPlayerCode} height="calc(100vh - 40px)" />
      </div>

      {/* Opponent's Editor (40%) */}
      <div className="w-2/5">
        <h3 className="text-white p-2 bg-gray-800">Opponent's Code</h3>
        <CodeEditor language="javascript" initialCode={opponentCode} onChange={() => {}} readOnly={true} showCursor={opponentCursor} height="calc(100vh - 40px)" />
      </div>
    </div>
  );
}
