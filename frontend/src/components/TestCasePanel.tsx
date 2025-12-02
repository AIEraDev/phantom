"use client";

import React from "react";

export interface TestCase {
  input: any;
  expectedOutput: any;
  isHidden: boolean;
}

export interface TestResult {
  passed: boolean;
  input: any;
  expectedOutput: any;
  actualOutput?: any;
  executionTime?: number;
  error?: string;
}

export interface TestCasePanelProps {
  testCases: TestCase[];
  results?: TestResult[];
  onRunTests: () => void;
  isRunning?: boolean;
  executionTime?: number;
  memoryUsage?: number;
}

export default function TestCasePanel({ testCases, results = [], onRunTests, isRunning = false, executionTime, memoryUsage }: TestCasePanelProps) {
  const visibleTestCases = testCases.filter((tc) => !tc.isHidden);

  const getResultForTestCase = (index: number): TestResult | undefined => {
    return results[index];
  };

  const formatValue = (value: any): string => {
    if (typeof value === "string") return `"${value}"`;
    if (Array.isArray(value)) return JSON.stringify(value);
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  };

  return (
    <div className="h-full flex flex-col bg-background-primary">
      {/* Header */}
      <div className="bg-background-secondary px-4 py-3 border-b border-border-default flex items-center justify-between">
        <h3 className="text-text-primary font-semibold flex items-center gap-2">
          <svg className="w-5 h-5 text-accent-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
          Test Cases
        </h3>
        <button onClick={onRunTests} disabled={isRunning} className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all duration-300 ${isRunning ? "bg-accent-yellow/20 text-accent-yellow cursor-wait" : "bg-accent-cyan/20 text-accent-cyan hover:bg-accent-cyan/30"} disabled:opacity-50`}>
          {isRunning ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Running...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Run Tests
            </span>
          )}
        </button>
      </div>

      {/* Test Cases List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {visibleTestCases.length === 0 ? (
          <div className="text-center text-text-muted py-8">
            <p>No test cases available</p>
          </div>
        ) : (
          visibleTestCases.map((testCase, index) => {
            const result = getResultForTestCase(index);
            const hasResult = result !== undefined;
            const passed = result?.passed ?? false;

            return (
              <div key={index} className={`rounded-lg border-2 transition-all duration-300 ${hasResult ? (passed ? "border-accent-lime bg-accent-lime/5" : "border-accent-red bg-accent-red/5") : "border-border-default bg-background-secondary/50"}`}>
                {/* Test Case Header */}
                <div className="px-4 py-2 border-b border-border-default flex items-center justify-between">
                  <span className="text-text-primary font-semibold text-sm">Test Case {index + 1}</span>
                  {hasResult && (
                    <span className={`flex items-center gap-1.5 text-sm font-semibold ${passed ? "text-accent-lime" : "text-accent-red"}`}>
                      {passed ? (
                        <>
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          Passed
                        </>
                      ) : (
                        <>
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                          </svg>
                          Failed
                        </>
                      )}
                    </span>
                  )}
                </div>

                {/* Test Case Content */}
                <div className="px-4 py-3 space-y-2 text-sm">
                  <div>
                    <span className="text-text-secondary font-medium">Input:</span>
                    <div className="mt-1 px-3 py-2 bg-background-primary rounded font-code text-text-primary">{formatValue(testCase.input)}</div>
                  </div>

                  <div>
                    <span className="text-text-secondary font-medium">Expected Output:</span>
                    <div className="mt-1 px-3 py-2 bg-background-primary rounded font-code text-text-primary">{formatValue(testCase.expectedOutput)}</div>
                  </div>

                  {hasResult && result.actualOutput !== undefined && (
                    <div>
                      <span className="text-text-secondary font-medium">Actual Output:</span>
                      <div className={`mt-1 px-3 py-2 bg-background-primary rounded font-code ${passed ? "text-accent-lime" : "text-accent-red"}`}>{formatValue(result.actualOutput)}</div>
                    </div>
                  )}

                  {hasResult && result.error && (
                    <div>
                      <span className="text-accent-red font-medium">Error:</span>
                      <div className="mt-1 px-3 py-2 bg-accent-red/10 rounded font-code text-accent-red text-xs">{result.error}</div>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Execution Stats */}
      {(executionTime !== undefined || memoryUsage !== undefined) && (
        <div className="border-t border-border-default px-4 py-3 bg-background-secondary">
          <div className="flex items-center justify-between text-sm">
            {executionTime !== undefined && (
              <div className="flex items-center gap-2 text-text-secondary">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>
                  <span className="font-semibold text-text-primary">{executionTime}ms</span> execution time
                </span>
              </div>
            )}
            {memoryUsage !== undefined && (
              <div className="flex items-center gap-2 text-text-secondary">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                </svg>
                <span>
                  <span className="font-semibold text-text-primary">{memoryUsage}MB</span> memory
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
