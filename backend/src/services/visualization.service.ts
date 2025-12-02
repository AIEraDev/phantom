/**
 * Visualization Service
 * Generates visualization data for array-based algorithms
 */

export type VisualizationType = "array" | "tree" | "graph";
export type OperationType = "compare" | "swap" | "insert" | "delete" | "visit" | "highlight";

export interface VisualizationStep {
  timestamp: number;
  operation: OperationType;
  indices: number[];
  values?: any[];
  metadata?: Record<string, any>;
}

export interface VisualizationData {
  type: VisualizationType;
  initialState: any;
  steps: VisualizationStep[];
}

/**
 * Generate visualization data based on test input and output
 * This creates a simple visualization showing the input array and result
 */
export function generateVisualization(testInput: any, actualOutput: any, challengeTitle?: string): VisualizationData | null {
  // Try to extract array from input
  const inputArray = extractArray(testInput);

  if (!inputArray || inputArray.length === 0) {
    return null;
  }

  // Generate visualization based on challenge type
  const steps: VisualizationStep[] = [];
  let timestamp = 0;
  const STEP_INTERVAL = 500; // 500ms between steps

  // Initial highlight of all elements
  for (let i = 0; i < inputArray.length; i++) {
    steps.push({
      timestamp,
      operation: "visit",
      indices: [i],
      values: [inputArray[i]],
    });
    timestamp += STEP_INTERVAL;
  }

  // If output is an array, show comparison/transformation
  if (Array.isArray(actualOutput)) {
    // Highlight the result elements
    for (let i = 0; i < actualOutput.length && i < inputArray.length; i++) {
      if (inputArray[i] !== actualOutput[i]) {
        steps.push({
          timestamp,
          operation: "swap",
          indices: [i],
          values: [actualOutput[i]],
          metadata: { from: inputArray[i], to: actualOutput[i] },
        });
        timestamp += STEP_INTERVAL;
      }
    }
  } else if (typeof actualOutput === "number") {
    // For numeric results (like sum, max, etc.), highlight relevant elements
    // Try to find elements that contribute to the result
    const resultIndices = findRelevantIndices(inputArray, actualOutput, challengeTitle);

    for (const idx of resultIndices) {
      steps.push({
        timestamp,
        operation: "highlight",
        indices: [idx],
        values: [inputArray[idx]],
        metadata: { result: actualOutput },
      });
      timestamp += STEP_INTERVAL;
    }
  }

  // Final state - mark as complete
  steps.push({
    timestamp,
    operation: "highlight",
    indices: Array.from({ length: inputArray.length }, (_, i) => i),
    metadata: { complete: true },
  });

  return {
    type: "array",
    initialState: inputArray, // Pass array directly for ArrayVisualization component
    steps,
  };
}

/**
 * Extract array from various input formats
 */
function extractArray(input: any): any[] | null {
  if (!input) return null;

  // Direct array
  if (Array.isArray(input)) {
    return input;
  }

  // Object with common array property names
  const arrayKeys = ["nums", "arr", "array", "numbers", "prices", "height", "heights", "matrix", "strs", "s"];

  for (const key of arrayKeys) {
    if (input[key] && Array.isArray(input[key])) {
      return input[key];
    }
  }

  // For matrix, flatten first row for visualization
  if (input.matrix && Array.isArray(input.matrix) && Array.isArray(input.matrix[0])) {
    return input.matrix[0];
  }

  // For string input, convert to char array
  if (input.s && typeof input.s === "string") {
    return input.s.split("");
  }

  return null;
}

/**
 * Find indices relevant to the result based on challenge type
 */
function findRelevantIndices(arr: any[], result: number, challengeTitle?: string): number[] {
  const indices: number[] = [];
  const title = (challengeTitle || "").toLowerCase();

  // Two Sum - find two numbers that add up to result
  if (title.includes("two sum") || title.includes("target")) {
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        if (arr[i] + arr[j] === result) {
          return [i, j];
        }
      }
    }
  }

  // Maximum Subarray - find contiguous subarray with max sum
  if (title.includes("maximum") && title.includes("subarray")) {
    let maxSum = arr[0];
    let currentSum = arr[0];
    let start = 0,
      end = 0,
      tempStart = 0;

    for (let i = 1; i < arr.length; i++) {
      if (currentSum + arr[i] < arr[i]) {
        currentSum = arr[i];
        tempStart = i;
      } else {
        currentSum += arr[i];
      }

      if (currentSum > maxSum) {
        maxSum = currentSum;
        start = tempStart;
        end = i;
      }
    }

    for (let i = start; i <= end; i++) {
      indices.push(i);
    }
    return indices;
  }

  // Best Time to Buy and Sell Stock
  if (title.includes("buy") && title.includes("sell")) {
    let minPrice = arr[0];
    let minIdx = 0;
    let maxProfit = 0;
    let buyIdx = 0,
      sellIdx = 0;

    for (let i = 1; i < arr.length; i++) {
      if (arr[i] < minPrice) {
        minPrice = arr[i];
        minIdx = i;
      } else if (arr[i] - minPrice > maxProfit) {
        maxProfit = arr[i] - minPrice;
        buyIdx = minIdx;
        sellIdx = i;
      }
    }

    if (maxProfit > 0) {
      return [buyIdx, sellIdx];
    }
  }

  // Container With Most Water
  if (title.includes("container") && title.includes("water")) {
    let maxArea = 0;
    let left = 0,
      right = arr.length - 1;
    let bestLeft = 0,
      bestRight = arr.length - 1;

    while (left < right) {
      const area = Math.min(arr[left], arr[right]) * (right - left);
      if (area > maxArea) {
        maxArea = area;
        bestLeft = left;
        bestRight = right;
      }
      if (arr[left] < arr[right]) {
        left++;
      } else {
        right--;
      }
    }

    return [bestLeft, bestRight];
  }

  // Default: highlight elements equal to or contributing to result
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] === result) {
      indices.push(i);
    }
  }

  // If no exact match, highlight first few elements
  if (indices.length === 0) {
    return [0, Math.min(arr.length - 1, 2)];
  }

  return indices;
}

/**
 * Parse visualization markers from code output
 * Format: __VIZ__:operation:indices:values:metadata
 */
export function parseVisualizationMarkers(output: string): VisualizationStep[] {
  const steps: VisualizationStep[] = [];
  const lines = output.split("\n");
  let timestamp = 0;
  const STEP_INTERVAL = 300;

  for (const line of lines) {
    if (line.startsWith("__VIZ__:")) {
      try {
        const parts = line.substring(8).split(":");
        const operation = parts[0] as OperationType;
        const indices = parts[1] ? parts[1].split(",").map(Number) : [];
        const values = parts[2] ? JSON.parse(parts[2]) : undefined;
        const metadata = parts[3] ? JSON.parse(parts[3]) : undefined;

        steps.push({
          timestamp,
          operation,
          indices,
          values,
          metadata,
        });
        timestamp += STEP_INTERVAL;
      } catch (e) {
        // Skip malformed markers
      }
    }
  }

  return steps;
}
