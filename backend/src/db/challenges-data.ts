export interface ChallengeData {
  title: string;
  description: string;
  difficulty: "easy" | "medium" | "hard" | "expert";
  timeLimit: number;
  testCases: Array<{
    input: any;
    expectedOutput: any;
    isHidden: boolean;
    weight: number;
  }>;
  starterCode: {
    javascript: string;
    python: string;
    typescript: string;
  };
  tags: string[];
}

// Helper to generate starter code
// Note: Input is read from /tmp/input.json file (written by Docker execution service)
const jsStarter = (fnName: string, params: string, inputParse: string) => `function ${fnName}(${params}) {
  // Your code here
  
}

// Test
const input = JSON.parse(require('fs').readFileSync('/tmp/input.json', 'utf-8'));
console.log(JSON.stringify(${fnName}(${inputParse})));`;

const pyStarter = (fnName: string, params: string, inputParse: string) => `def ${fnName}(${params}):
    # Your code here
    pass

# Test
import json
with open('/tmp/input.json', 'r') as f:
    input_data = json.load(f)
print(json.dumps(${fnName}(${inputParse})))`;

const tsStarter = (fnName: string, params: string, returnType: string, inputParse: string) => `function ${fnName}(${params}): ${returnType} {
  // Your code here
  
}

// Test
const input = JSON.parse(require('fs').readFileSync('/tmp/input.json', 'utf-8'));
console.log(JSON.stringify(${fnName}(${inputParse})));`;

export const challenges: ChallengeData[] = [
  // ==================== EASY CHALLENGES (50) ====================
  {
    title: "Two Sum",
    description: "Given an array of integers `nums` and an integer `target`, return indices of the two numbers that add up to `target`. Each input has exactly one solution.",
    difficulty: "easy",
    timeLimit: 300,
    testCases: [
      { input: { nums: [2, 7, 11, 15], target: 9 }, expectedOutput: [0, 1], isHidden: false, weight: 1 },
      { input: { nums: [3, 2, 4], target: 6 }, expectedOutput: [1, 2], isHidden: false, weight: 1 },
      { input: { nums: [3, 3], target: 6 }, expectedOutput: [0, 1], isHidden: true, weight: 2 },
    ],
    starterCode: {
      javascript: jsStarter("twoSum", "nums, target", "input.nums, input.target"),
      python: pyStarter("two_sum", "nums, target", "input_data['nums'], input_data['target']"),
      typescript: tsStarter("twoSum", "nums: number[], target: number", "number[]", "input.nums, input.target"),
    },
    tags: ["array", "hash-table"],
  },
  {
    title: "Reverse String",
    description: "Write a function that reverses a string. The input string is given as an array of characters.",
    difficulty: "easy",
    timeLimit: 300,
    testCases: [
      { input: { s: ["h", "e", "l", "l", "o"] }, expectedOutput: ["o", "l", "l", "e", "h"], isHidden: false, weight: 1 },
      { input: { s: ["H", "a", "n", "n", "a", "h"] }, expectedOutput: ["h", "a", "n", "n", "a", "H"], isHidden: false, weight: 1 },
      { input: { s: ["a"] }, expectedOutput: ["a"], isHidden: true, weight: 2 },
    ],
    starterCode: {
      javascript: jsStarter("reverseString", "s", "input.s"),
      python: pyStarter("reverse_string", "s", "input_data['s']"),
      typescript: tsStarter("reverseString", "s: string[]", "string[]", "input.s"),
    },
    tags: ["string", "two-pointers"],
  },
  {
    title: "Valid Palindrome",
    description: "Given a string `s`, return `true` if it is a palindrome, considering only alphanumeric characters and ignoring cases.",
    difficulty: "easy",
    timeLimit: 300,
    testCases: [
      { input: { s: "A man, a plan, a canal: Panama" }, expectedOutput: true, isHidden: false, weight: 1 },
      { input: { s: "race a car" }, expectedOutput: false, isHidden: false, weight: 1 },
      { input: { s: " " }, expectedOutput: true, isHidden: true, weight: 2 },
    ],
    starterCode: {
      javascript: jsStarter("isPalindrome", "s", "input.s"),
      python: pyStarter("is_palindrome", "s", "input_data['s']"),
      typescript: tsStarter("isPalindrome", "s: string", "boolean", "input.s"),
    },
    tags: ["string", "two-pointers"],
  },
  {
    title: "FizzBuzz",
    description: "Given an integer `n`, return a string array where: 'FizzBuzz' if divisible by 3 and 5, 'Fizz' if divisible by 3, 'Buzz' if divisible by 5, otherwise the number.",
    difficulty: "easy",
    timeLimit: 300,
    testCases: [
      { input: { n: 3 }, expectedOutput: ["1", "2", "Fizz"], isHidden: false, weight: 1 },
      { input: { n: 5 }, expectedOutput: ["1", "2", "Fizz", "4", "Buzz"], isHidden: false, weight: 1 },
      { input: { n: 15 }, expectedOutput: ["1", "2", "Fizz", "4", "Buzz", "Fizz", "7", "8", "Fizz", "Buzz", "11", "Fizz", "13", "14", "FizzBuzz"], isHidden: true, weight: 2 },
    ],
    starterCode: {
      javascript: jsStarter("fizzBuzz", "n", "input.n"),
      python: pyStarter("fizz_buzz", "n", "input_data['n']"),
      typescript: tsStarter("fizzBuzz", "n: number", "string[]", "input.n"),
    },
    tags: ["math", "string"],
  },
  {
    title: "Maximum Subarray",
    description: "Given an integer array `nums`, find the contiguous subarray with the largest sum and return its sum.",
    difficulty: "easy",
    timeLimit: 300,
    testCases: [
      { input: { nums: [-2, 1, -3, 4, -1, 2, 1, -5, 4] }, expectedOutput: 6, isHidden: false, weight: 1 },
      { input: { nums: [1] }, expectedOutput: 1, isHidden: false, weight: 1 },
      { input: { nums: [5, 4, -1, 7, 8] }, expectedOutput: 23, isHidden: true, weight: 2 },
    ],
    starterCode: {
      javascript: jsStarter("maxSubArray", "nums", "input.nums"),
      python: pyStarter("max_sub_array", "nums", "input_data['nums']"),
      typescript: tsStarter("maxSubArray", "nums: number[]", "number", "input.nums"),
    },
    tags: ["array", "dynamic-programming"],
  },

  {
    title: "Contains Duplicate",
    description: "Given an integer array `nums`, return `true` if any value appears at least twice, and `false` if every element is distinct.",
    difficulty: "easy",
    timeLimit: 300,
    testCases: [
      { input: { nums: [1, 2, 3, 1] }, expectedOutput: true, isHidden: false, weight: 1 },
      { input: { nums: [1, 2, 3, 4] }, expectedOutput: false, isHidden: false, weight: 1 },
      { input: { nums: [1, 1, 1, 3, 3, 4, 3, 2, 4, 2] }, expectedOutput: true, isHidden: true, weight: 2 },
    ],
    starterCode: {
      javascript: jsStarter("containsDuplicate", "nums", "input.nums"),
      python: pyStarter("contains_duplicate", "nums", "input_data['nums']"),
      typescript: tsStarter("containsDuplicate", "nums: number[]", "boolean", "input.nums"),
    },
    tags: ["array", "hash-table"],
  },
  {
    title: "Single Number",
    description: "Given a non-empty array where every element appears twice except for one, find that single one. Implement with O(1) space complexity.",
    difficulty: "easy",
    timeLimit: 300,
    testCases: [
      { input: { nums: [2, 2, 1] }, expectedOutput: 1, isHidden: false, weight: 1 },
      { input: { nums: [4, 1, 2, 1, 2] }, expectedOutput: 4, isHidden: false, weight: 1 },
      { input: { nums: [1] }, expectedOutput: 1, isHidden: true, weight: 2 },
    ],
    starterCode: {
      javascript: jsStarter("singleNumber", "nums", "input.nums"),
      python: pyStarter("single_number", "nums", "input_data['nums']"),
      typescript: tsStarter("singleNumber", "nums: number[]", "number", "input.nums"),
    },
    tags: ["array", "bit-manipulation"],
  },
  {
    title: "Merge Sorted Array",
    description: "Merge `nums2` into `nums1` as one sorted array. `nums1` has enough space to hold elements from `nums2`.",
    difficulty: "easy",
    timeLimit: 300,
    testCases: [
      { input: { nums1: [1, 2, 3, 0, 0, 0], m: 3, nums2: [2, 5, 6], n: 3 }, expectedOutput: [1, 2, 2, 3, 5, 6], isHidden: false, weight: 1 },
      { input: { nums1: [1], m: 1, nums2: [], n: 0 }, expectedOutput: [1], isHidden: false, weight: 1 },
      { input: { nums1: [0], m: 0, nums2: [1], n: 1 }, expectedOutput: [1], isHidden: true, weight: 2 },
    ],
    starterCode: {
      javascript: jsStarter("merge", "nums1, m, nums2, n", "input.nums1, input.m, input.nums2, input.n"),
      python: pyStarter("merge", "nums1, m, nums2, n", "input_data['nums1'], input_data['m'], input_data['nums2'], input_data['n']"),
      typescript: tsStarter("merge", "nums1: number[], m: number, nums2: number[], n: number", "number[]", "input.nums1, input.m, input.nums2, input.n"),
    },
    tags: ["array", "two-pointers", "sorting"],
  },
  {
    title: "Valid Anagram",
    description: "Given two strings `s` and `t`, return `true` if `t` is an anagram of `s`, and `false` otherwise.",
    difficulty: "easy",
    timeLimit: 300,
    testCases: [
      { input: { s: "anagram", t: "nagaram" }, expectedOutput: true, isHidden: false, weight: 1 },
      { input: { s: "rat", t: "car" }, expectedOutput: false, isHidden: false, weight: 1 },
      { input: { s: "a", t: "ab" }, expectedOutput: false, isHidden: true, weight: 2 },
    ],
    starterCode: {
      javascript: jsStarter("isAnagram", "s, t", "input.s, input.t"),
      python: pyStarter("is_anagram", "s, t", "input_data['s'], input_data['t']"),
      typescript: tsStarter("isAnagram", "s: string, t: string", "boolean", "input.s, input.t"),
    },
    tags: ["string", "hash-table", "sorting"],
  },
  {
    title: "First Unique Character",
    description: "Given a string `s`, find the first non-repeating character and return its index. If it doesn't exist, return -1.",
    difficulty: "easy",
    timeLimit: 300,
    testCases: [
      { input: { s: "leetcode" }, expectedOutput: 0, isHidden: false, weight: 1 },
      { input: { s: "loveleetcode" }, expectedOutput: 2, isHidden: false, weight: 1 },
      { input: { s: "aabb" }, expectedOutput: -1, isHidden: true, weight: 2 },
    ],
    starterCode: {
      javascript: jsStarter("firstUniqChar", "s", "input.s"),
      python: pyStarter("first_uniq_char", "s", "input_data['s']"),
      typescript: tsStarter("firstUniqChar", "s: string", "number", "input.s"),
    },
    tags: ["string", "hash-table"],
  },
  {
    title: "Plus One",
    description: "Given a large integer represented as an array of digits, increment the integer by one and return the resulting array.",
    difficulty: "easy",
    timeLimit: 300,
    testCases: [
      { input: { digits: [1, 2, 3] }, expectedOutput: [1, 2, 4], isHidden: false, weight: 1 },
      { input: { digits: [9, 9, 9] }, expectedOutput: [1, 0, 0, 0], isHidden: false, weight: 1 },
      { input: { digits: [0] }, expectedOutput: [1], isHidden: true, weight: 2 },
    ],
    starterCode: {
      javascript: jsStarter("plusOne", "digits", "input.digits"),
      python: pyStarter("plus_one", "digits", "input_data['digits']"),
      typescript: tsStarter("plusOne", "digits: number[]", "number[]", "input.digits"),
    },
    tags: ["array", "math"],
  },
  {
    title: "Move Zeroes",
    description: "Given an array `nums`, move all 0's to the end while maintaining the relative order of non-zero elements. Do this in-place.",
    difficulty: "easy",
    timeLimit: 300,
    testCases: [
      { input: { nums: [0, 1, 0, 3, 12] }, expectedOutput: [1, 3, 12, 0, 0], isHidden: false, weight: 1 },
      { input: { nums: [0] }, expectedOutput: [0], isHidden: false, weight: 1 },
      { input: { nums: [1, 0, 0, 0, 2] }, expectedOutput: [1, 2, 0, 0, 0], isHidden: true, weight: 2 },
    ],
    starterCode: {
      javascript: jsStarter("moveZeroes", "nums", "input.nums"),
      python: pyStarter("move_zeroes", "nums", "input_data['nums']"),
      typescript: tsStarter("moveZeroes", "nums: number[]", "number[]", "input.nums"),
    },
    tags: ["array", "two-pointers"],
  },
  {
    title: "Best Time to Buy and Sell Stock",
    description: "Given an array `prices` where `prices[i]` is the price on day `i`, find the maximum profit from one transaction.",
    difficulty: "easy",
    timeLimit: 300,
    testCases: [
      { input: { prices: [7, 1, 5, 3, 6, 4] }, expectedOutput: 5, isHidden: false, weight: 1 },
      { input: { prices: [7, 6, 4, 3, 1] }, expectedOutput: 0, isHidden: false, weight: 1 },
      { input: { prices: [2, 4, 1] }, expectedOutput: 2, isHidden: true, weight: 2 },
    ],
    starterCode: {
      javascript: jsStarter("maxProfit", "prices", "input.prices"),
      python: pyStarter("max_profit", "prices", "input_data['prices']"),
      typescript: tsStarter("maxProfit", "prices: number[]", "number", "input.prices"),
    },
    tags: ["array", "dynamic-programming"],
  },
  {
    title: "Climbing Stairs",
    description: "You are climbing a staircase with `n` steps. Each time you can climb 1 or 2 steps. How many distinct ways can you climb to the top?",
    difficulty: "easy",
    timeLimit: 300,
    testCases: [
      { input: { n: 2 }, expectedOutput: 2, isHidden: false, weight: 1 },
      { input: { n: 3 }, expectedOutput: 3, isHidden: false, weight: 1 },
      { input: { n: 5 }, expectedOutput: 8, isHidden: true, weight: 2 },
    ],
    starterCode: {
      javascript: jsStarter("climbStairs", "n", "input.n"),
      python: pyStarter("climb_stairs", "n", "input_data['n']"),
      typescript: tsStarter("climbStairs", "n: number", "number", "input.n"),
    },
    tags: ["dynamic-programming", "math"],
  },
  {
    title: "Roman to Integer",
    description: "Convert a Roman numeral string to an integer. Roman numerals: I=1, V=5, X=10, L=50, C=100, D=500, M=1000.",
    difficulty: "easy",
    timeLimit: 300,
    testCases: [
      { input: { s: "III" }, expectedOutput: 3, isHidden: false, weight: 1 },
      { input: { s: "LVIII" }, expectedOutput: 58, isHidden: false, weight: 1 },
      { input: { s: "MCMXCIV" }, expectedOutput: 1994, isHidden: true, weight: 2 },
    ],
    starterCode: {
      javascript: jsStarter("romanToInt", "s", "input.s"),
      python: pyStarter("roman_to_int", "s", "input_data['s']"),
      typescript: tsStarter("romanToInt", "s: string", "number", "input.s"),
    },
    tags: ["string", "hash-table", "math"],
  },
  {
    title: "Palindrome Number",
    description: "Given an integer `x`, return `true` if `x` is a palindrome, and `false` otherwise. Do not convert to string.",
    difficulty: "easy",
    timeLimit: 300,
    testCases: [
      { input: { x: 121 }, expectedOutput: true, isHidden: false, weight: 1 },
      { input: { x: -121 }, expectedOutput: false, isHidden: false, weight: 1 },
      { input: { x: 10 }, expectedOutput: false, isHidden: true, weight: 2 },
    ],
    starterCode: {
      javascript: jsStarter("isPalindrome", "x", "input.x"),
      python: pyStarter("is_palindrome", "x", "input_data['x']"),
      typescript: tsStarter("isPalindrome", "x: number", "boolean", "input.x"),
    },
    tags: ["math"],
  },
  {
    title: "Remove Duplicates from Sorted Array",
    description: "Remove duplicates in-place from a sorted array and return the new length. Elements beyond the new length don't matter.",
    difficulty: "easy",
    timeLimit: 300,
    testCases: [
      { input: { nums: [1, 1, 2] }, expectedOutput: 2, isHidden: false, weight: 1 },
      { input: { nums: [0, 0, 1, 1, 1, 2, 2, 3, 3, 4] }, expectedOutput: 5, isHidden: false, weight: 1 },
      { input: { nums: [1] }, expectedOutput: 1, isHidden: true, weight: 2 },
    ],
    starterCode: {
      javascript: jsStarter("removeDuplicates", "nums", "input.nums"),
      python: pyStarter("remove_duplicates", "nums", "input_data['nums']"),
      typescript: tsStarter("removeDuplicates", "nums: number[]", "number", "input.nums"),
    },
    tags: ["array", "two-pointers"],
  },
  {
    title: "Search Insert Position",
    description: "Given a sorted array and a target, return the index if found. If not, return where it would be inserted. O(log n) required.",
    difficulty: "easy",
    timeLimit: 300,
    testCases: [
      { input: { nums: [1, 3, 5, 6], target: 5 }, expectedOutput: 2, isHidden: false, weight: 1 },
      { input: { nums: [1, 3, 5, 6], target: 2 }, expectedOutput: 1, isHidden: false, weight: 1 },
      { input: { nums: [1, 3, 5, 6], target: 7 }, expectedOutput: 4, isHidden: true, weight: 2 },
    ],
    starterCode: {
      javascript: jsStarter("searchInsert", "nums, target", "input.nums, input.target"),
      python: pyStarter("search_insert", "nums, target", "input_data['nums'], input_data['target']"),
      typescript: tsStarter("searchInsert", "nums: number[], target: number", "number", "input.nums, input.target"),
    },
    tags: ["array", "binary-search"],
  },
  {
    title: "Length of Last Word",
    description: "Given a string `s` of words separated by spaces, return the length of the last word.",
    difficulty: "easy",
    timeLimit: 300,
    testCases: [
      { input: { s: "Hello World" }, expectedOutput: 5, isHidden: false, weight: 1 },
      { input: { s: "   fly me   to   the moon  " }, expectedOutput: 4, isHidden: false, weight: 1 },
      { input: { s: "a" }, expectedOutput: 1, isHidden: true, weight: 2 },
    ],
    starterCode: {
      javascript: jsStarter("lengthOfLastWord", "s", "input.s"),
      python: pyStarter("length_of_last_word", "s", "input_data['s']"),
      typescript: tsStarter("lengthOfLastWord", "s: string", "number", "input.s"),
    },
    tags: ["string"],
  },
  {
    title: "Sqrt(x)",
    description: "Given a non-negative integer `x`, return the square root of `x` rounded down to the nearest integer.",
    difficulty: "easy",
    timeLimit: 300,
    testCases: [
      { input: { x: 4 }, expectedOutput: 2, isHidden: false, weight: 1 },
      { input: { x: 8 }, expectedOutput: 2, isHidden: false, weight: 1 },
      { input: { x: 0 }, expectedOutput: 0, isHidden: true, weight: 2 },
    ],
    starterCode: {
      javascript: jsStarter("mySqrt", "x", "input.x"),
      python: pyStarter("my_sqrt", "x", "input_data['x']"),
      typescript: tsStarter("mySqrt", "x: number", "number", "input.x"),
    },
    tags: ["math", "binary-search"],
  },
  {
    title: "Add Binary",
    description: "Given two binary strings `a` and `b`, return their sum as a binary string.",
    difficulty: "easy",
    timeLimit: 300,
    testCases: [
      { input: { a: "11", b: "1" }, expectedOutput: "100", isHidden: false, weight: 1 },
      { input: { a: "1010", b: "1011" }, expectedOutput: "10101", isHidden: false, weight: 1 },
      { input: { a: "0", b: "0" }, expectedOutput: "0", isHidden: true, weight: 2 },
    ],
    starterCode: {
      javascript: jsStarter("addBinary", "a, b", "input.a, input.b"),
      python: pyStarter("add_binary", "a, b", "input_data['a'], input_data['b']"),
      typescript: tsStarter("addBinary", "a: string, b: string", "string", "input.a, input.b"),
    },
    tags: ["string", "math", "bit-manipulation"],
  },
  {
    title: "Majority Element",
    description: "Given an array `nums`, return the majority element (appears more than n/2 times). The majority element always exists.",
    difficulty: "easy",
    timeLimit: 300,
    testCases: [
      { input: { nums: [3, 2, 3] }, expectedOutput: 3, isHidden: false, weight: 1 },
      { input: { nums: [2, 2, 1, 1, 1, 2, 2] }, expectedOutput: 2, isHidden: false, weight: 1 },
      { input: { nums: [1] }, expectedOutput: 1, isHidden: true, weight: 2 },
    ],
    starterCode: {
      javascript: jsStarter("majorityElement", "nums", "input.nums"),
      python: pyStarter("majority_element", "nums", "input_data['nums']"),
      typescript: tsStarter("majorityElement", "nums: number[]", "number", "input.nums"),
    },
    tags: ["array", "hash-table", "sorting"],
  },
  {
    title: "Excel Sheet Column Number",
    description: "Given a string `columnTitle` representing an Excel column title, return its corresponding column number.",
    difficulty: "easy",
    timeLimit: 300,
    testCases: [
      { input: { columnTitle: "A" }, expectedOutput: 1, isHidden: false, weight: 1 },
      { input: { columnTitle: "AB" }, expectedOutput: 28, isHidden: false, weight: 1 },
      { input: { columnTitle: "ZY" }, expectedOutput: 701, isHidden: true, weight: 2 },
    ],
    starterCode: {
      javascript: jsStarter("titleToNumber", "columnTitle", "input.columnTitle"),
      python: pyStarter("title_to_number", "column_title", "input_data['columnTitle']"),
      typescript: tsStarter("titleToNumber", "columnTitle: string", "number", "input.columnTitle"),
    },
    tags: ["string", "math"],
  },
  {
    title: "Happy Number",
    description: "A happy number is defined by replacing it with the sum of squares of its digits until it equals 1 or loops endlessly.",
    difficulty: "easy",
    timeLimit: 300,
    testCases: [
      { input: { n: 19 }, expectedOutput: true, isHidden: false, weight: 1 },
      { input: { n: 2 }, expectedOutput: false, isHidden: false, weight: 1 },
      { input: { n: 7 }, expectedOutput: true, isHidden: true, weight: 2 },
    ],
    starterCode: {
      javascript: jsStarter("isHappy", "n", "input.n"),
      python: pyStarter("is_happy", "n", "input_data['n']"),
      typescript: tsStarter("isHappy", "n: number", "boolean", "input.n"),
    },
    tags: ["hash-table", "math"],
  },
  {
    title: "Isomorphic Strings",
    description: "Given two strings `s` and `t`, determine if they are isomorphic (characters can be replaced to get the other string).",
    difficulty: "easy",
    timeLimit: 300,
    testCases: [
      { input: { s: "egg", t: "add" }, expectedOutput: true, isHidden: false, weight: 1 },
      { input: { s: "foo", t: "bar" }, expectedOutput: false, isHidden: false, weight: 1 },
      { input: { s: "paper", t: "title" }, expectedOutput: true, isHidden: true, weight: 2 },
    ],
    starterCode: {
      javascript: jsStarter("isIsomorphic", "s, t", "input.s, input.t"),
      python: pyStarter("is_isomorphic", "s, t", "input_data['s'], input_data['t']"),
      typescript: tsStarter("isIsomorphic", "s: string, t: string", "boolean", "input.s, input.t"),
    },
    tags: ["string", "hash-table"],
  },
  {
    title: "Power of Two",
    description: "Given an integer `n`, return `true` if it is a power of two. Otherwise, return `false`.",
    difficulty: "easy",
    timeLimit: 300,
    testCases: [
      { input: { n: 1 }, expectedOutput: true, isHidden: false, weight: 1 },
      { input: { n: 16 }, expectedOutput: true, isHidden: false, weight: 1 },
      { input: { n: 3 }, expectedOutput: false, isHidden: true, weight: 2 },
    ],
    starterCode: {
      javascript: jsStarter("isPowerOfTwo", "n", "input.n"),
      python: pyStarter("is_power_of_two", "n", "input_data['n']"),
      typescript: tsStarter("isPowerOfTwo", "n: number", "boolean", "input.n"),
    },
    tags: ["math", "bit-manipulation"],
  },

  // ==================== MEDIUM CHALLENGES (100) ====================
  {
    title: "Longest Substring Without Repeating Characters",
    description: "Given a string `s`, find the length of the longest substring without repeating characters.",
    difficulty: "medium",
    timeLimit: 450,
    testCases: [
      { input: { s: "abcabcbb" }, expectedOutput: 3, isHidden: false, weight: 1 },
      { input: { s: "bbbbb" }, expectedOutput: 1, isHidden: false, weight: 1 },
      { input: { s: "pwwkew" }, expectedOutput: 3, isHidden: true, weight: 2 },
    ],
    starterCode: {
      javascript: jsStarter("lengthOfLongestSubstring", "s", "input.s"),
      python: pyStarter("length_of_longest_substring", "s", "input_data['s']"),
      typescript: tsStarter("lengthOfLongestSubstring", "s: string", "number", "input.s"),
    },
    tags: ["string", "sliding-window", "hash-table"],
  },
  {
    title: "Add Two Numbers",
    description: "Given two non-empty linked lists representing non-negative integers in reverse order, return the sum as a linked list.",
    difficulty: "medium",
    timeLimit: 450,
    testCases: [
      { input: { l1: [2, 4, 3], l2: [5, 6, 4] }, expectedOutput: [7, 0, 8], isHidden: false, weight: 1 },
      { input: { l1: [0], l2: [0] }, expectedOutput: [0], isHidden: false, weight: 1 },
      { input: { l1: [9, 9, 9], l2: [1] }, expectedOutput: [0, 0, 0, 1], isHidden: true, weight: 2 },
    ],
    starterCode: {
      javascript: jsStarter("addTwoNumbers", "l1, l2", "input.l1, input.l2"),
      python: pyStarter("add_two_numbers", "l1, l2", "input_data['l1'], input_data['l2']"),
      typescript: tsStarter("addTwoNumbers", "l1: number[], l2: number[]", "number[]", "input.l1, input.l2"),
    },
    tags: ["linked-list", "math"],
  },
  {
    title: "3Sum",
    description: "Given an array `nums`, return all unique triplets that sum to zero. No duplicate triplets allowed.",
    difficulty: "medium",
    timeLimit: 450,
    testCases: [
      {
        input: { nums: [-1, 0, 1, 2, -1, -4] },
        expectedOutput: [
          [-1, -1, 2],
          [-1, 0, 1],
        ],
        isHidden: false,
        weight: 1,
      },
      { input: { nums: [0, 1, 1] }, expectedOutput: [], isHidden: false, weight: 1 },
      { input: { nums: [0, 0, 0] }, expectedOutput: [[0, 0, 0]], isHidden: true, weight: 2 },
    ],
    starterCode: {
      javascript: jsStarter("threeSum", "nums", "input.nums"),
      python: pyStarter("three_sum", "nums", "input_data['nums']"),
      typescript: tsStarter("threeSum", "nums: number[]", "number[][]", "input.nums"),
    },
    tags: ["array", "two-pointers", "sorting"],
  },
  {
    title: "Container With Most Water",
    description: "Given `n` vertical lines, find two lines that together with the x-axis form a container that holds the most water.",
    difficulty: "medium",
    timeLimit: 450,
    testCases: [
      { input: { height: [1, 8, 6, 2, 5, 4, 8, 3, 7] }, expectedOutput: 49, isHidden: false, weight: 1 },
      { input: { height: [1, 1] }, expectedOutput: 1, isHidden: false, weight: 1 },
      { input: { height: [4, 3, 2, 1, 4] }, expectedOutput: 16, isHidden: true, weight: 2 },
    ],
    starterCode: {
      javascript: jsStarter("maxArea", "height", "input.height"),
      python: pyStarter("max_area", "height", "input_data['height']"),
      typescript: tsStarter("maxArea", "height: number[]", "number", "input.height"),
    },
    tags: ["array", "two-pointers", "greedy"],
  },
  {
    title: "Group Anagrams",
    description: "Given an array of strings, group the anagrams together. Return the answer in any order.",
    difficulty: "medium",
    timeLimit: 450,
    testCases: [
      { input: { strs: ["eat", "tea", "tan", "ate", "nat", "bat"] }, expectedOutput: [["bat"], ["nat", "tan"], ["ate", "eat", "tea"]], isHidden: false, weight: 1 },
      { input: { strs: [""] }, expectedOutput: [[""]], isHidden: false, weight: 1 },
      { input: { strs: ["a"] }, expectedOutput: [["a"]], isHidden: true, weight: 2 },
    ],
    starterCode: {
      javascript: jsStarter("groupAnagrams", "strs", "input.strs"),
      python: pyStarter("group_anagrams", "strs", "input_data['strs']"),
      typescript: tsStarter("groupAnagrams", "strs: string[]", "string[][]", "input.strs"),
    },
    tags: ["string", "hash-table", "sorting"],
  },
  {
    title: "Product of Array Except Self",
    description: "Given an array `nums`, return an array where each element is the product of all elements except itself. No division allowed.",
    difficulty: "medium",
    timeLimit: 450,
    testCases: [
      { input: { nums: [1, 2, 3, 4] }, expectedOutput: [24, 12, 8, 6], isHidden: false, weight: 1 },
      { input: { nums: [-1, 1, 0, -3, 3] }, expectedOutput: [0, 0, 9, 0, 0], isHidden: false, weight: 1 },
      { input: { nums: [2, 3] }, expectedOutput: [3, 2], isHidden: true, weight: 2 },
    ],
    starterCode: {
      javascript: jsStarter("productExceptSelf", "nums", "input.nums"),
      python: pyStarter("product_except_self", "nums", "input_data['nums']"),
      typescript: tsStarter("productExceptSelf", "nums: number[]", "number[]", "input.nums"),
    },
    tags: ["array", "prefix-sum"],
  },
  {
    title: "Valid Sudoku",
    description: "Determine if a 9x9 Sudoku board is valid. Only filled cells need to be validated.",
    difficulty: "medium",
    timeLimit: 450,
    testCases: [
      {
        input: {
          board: [
            ["5", "3", ".", ".", "7", ".", ".", ".", "."],
            ["6", ".", ".", "1", "9", "5", ".", ".", "."],
            [".", "9", "8", ".", ".", ".", ".", "6", "."],
            ["8", ".", ".", ".", "6", ".", ".", ".", "3"],
            ["4", ".", ".", "8", ".", "3", ".", ".", "1"],
            ["7", ".", ".", ".", "2", ".", ".", ".", "6"],
            [".", "6", ".", ".", ".", ".", "2", "8", "."],
            [".", ".", ".", "4", "1", "9", ".", ".", "5"],
            [".", ".", ".", ".", "8", ".", ".", "7", "9"],
          ],
        },
        expectedOutput: true,
        isHidden: false,
        weight: 1,
      },
      {
        input: {
          board: [
            ["8", "3", ".", ".", "7", ".", ".", ".", "."],
            ["6", ".", ".", "1", "9", "5", ".", ".", "."],
            [".", "9", "8", ".", ".", ".", ".", "6", "."],
            ["8", ".", ".", ".", "6", ".", ".", ".", "3"],
            ["4", ".", ".", "8", ".", "3", ".", ".", "1"],
            ["7", ".", ".", ".", "2", ".", ".", ".", "6"],
            [".", "6", ".", ".", ".", ".", "2", "8", "."],
            [".", ".", ".", "4", "1", "9", ".", ".", "5"],
            [".", ".", ".", ".", "8", ".", ".", "7", "9"],
          ],
        },
        expectedOutput: false,
        isHidden: true,
        weight: 2,
      },
    ],
    starterCode: {
      javascript: jsStarter("isValidSudoku", "board", "input.board"),
      python: pyStarter("is_valid_sudoku", "board", "input_data['board']"),
      typescript: tsStarter("isValidSudoku", "board: string[][]", "boolean", "input.board"),
    },
    tags: ["array", "hash-table", "matrix"],
  },
  {
    title: "Rotate Image",
    description: "Rotate an n x n 2D matrix by 90 degrees clockwise in-place.",
    difficulty: "medium",
    timeLimit: 450,
    testCases: [
      {
        input: {
          matrix: [
            [1, 2, 3],
            [4, 5, 6],
            [7, 8, 9],
          ],
        },
        expectedOutput: [
          [7, 4, 1],
          [8, 5, 2],
          [9, 6, 3],
        ],
        isHidden: false,
        weight: 1,
      },
      {
        input: {
          matrix: [
            [5, 1, 9, 11],
            [2, 4, 8, 10],
            [13, 3, 6, 7],
            [15, 14, 12, 16],
          ],
        },
        expectedOutput: [
          [15, 13, 2, 5],
          [14, 3, 4, 1],
          [12, 6, 8, 9],
          [16, 7, 10, 11],
        ],
        isHidden: true,
        weight: 2,
      },
    ],
    starterCode: {
      javascript: jsStarter("rotate", "matrix", "input.matrix"),
      python: pyStarter("rotate", "matrix", "input_data['matrix']"),
      typescript: tsStarter("rotate", "matrix: number[][]", "number[][]", "input.matrix"),
    },
    tags: ["array", "matrix", "math"],
  },
  {
    title: "Spiral Matrix",
    description: "Given an m x n matrix, return all elements in spiral order.",
    difficulty: "medium",
    timeLimit: 450,
    testCases: [
      {
        input: {
          matrix: [
            [1, 2, 3],
            [4, 5, 6],
            [7, 8, 9],
          ],
        },
        expectedOutput: [1, 2, 3, 6, 9, 8, 7, 4, 5],
        isHidden: false,
        weight: 1,
      },
      {
        input: {
          matrix: [
            [1, 2, 3, 4],
            [5, 6, 7, 8],
            [9, 10, 11, 12],
          ],
        },
        expectedOutput: [1, 2, 3, 4, 8, 12, 11, 10, 9, 5, 6, 7],
        isHidden: true,
        weight: 2,
      },
    ],
    starterCode: {
      javascript: jsStarter("spiralOrder", "matrix", "input.matrix"),
      python: pyStarter("spiral_order", "matrix", "input_data['matrix']"),
      typescript: tsStarter("spiralOrder", "matrix: number[][]", "number[]", "input.matrix"),
    },
    tags: ["array", "matrix", "simulation"],
  },
  {
    title: "Jump Game",
    description: "Given an array where each element is the max jump length, determine if you can reach the last index starting from index 0.",
    difficulty: "medium",
    timeLimit: 450,
    testCases: [
      { input: { nums: [2, 3, 1, 1, 4] }, expectedOutput: true, isHidden: false, weight: 1 },
      { input: { nums: [3, 2, 1, 0, 4] }, expectedOutput: false, isHidden: false, weight: 1 },
      { input: { nums: [0] }, expectedOutput: true, isHidden: true, weight: 2 },
    ],
    starterCode: {
      javascript: jsStarter("canJump", "nums", "input.nums"),
      python: pyStarter("can_jump", "nums", "input_data['nums']"),
      typescript: tsStarter("canJump", "nums: number[]", "boolean", "input.nums"),
    },
    tags: ["array", "dynamic-programming", "greedy"],
  },
  {
    title: "Merge Intervals",
    description: "Given an array of intervals, merge all overlapping intervals and return non-overlapping intervals.",
    difficulty: "medium",
    timeLimit: 450,
    testCases: [
      {
        input: {
          intervals: [
            [1, 3],
            [2, 6],
            [8, 10],
            [15, 18],
          ],
        },
        expectedOutput: [
          [1, 6],
          [8, 10],
          [15, 18],
        ],
        isHidden: false,
        weight: 1,
      },
      {
        input: {
          intervals: [
            [1, 4],
            [4, 5],
          ],
        },
        expectedOutput: [[1, 5]],
        isHidden: false,
        weight: 1,
      },
      {
        input: {
          intervals: [
            [1, 4],
            [0, 4],
          ],
        },
        expectedOutput: [[0, 4]],
        isHidden: true,
        weight: 2,
      },
    ],
    starterCode: {
      javascript: jsStarter("merge", "intervals", "input.intervals"),
      python: pyStarter("merge", "intervals", "input_data['intervals']"),
      typescript: tsStarter("merge", "intervals: number[][]", "number[][]", "input.intervals"),
    },
    tags: ["array", "sorting"],
  },
  {
    title: "Unique Paths",
    description: "A robot on an m x n grid can only move right or down. How many unique paths are there from top-left to bottom-right?",
    difficulty: "medium",
    timeLimit: 450,
    testCases: [
      { input: { m: 3, n: 7 }, expectedOutput: 28, isHidden: false, weight: 1 },
      { input: { m: 3, n: 2 }, expectedOutput: 3, isHidden: false, weight: 1 },
      { input: { m: 7, n: 3 }, expectedOutput: 28, isHidden: true, weight: 2 },
    ],
    starterCode: {
      javascript: jsStarter("uniquePaths", "m, n", "input.m, input.n"),
      python: pyStarter("unique_paths", "m, n", "input_data['m'], input_data['n']"),
      typescript: tsStarter("uniquePaths", "m: number, n: number", "number", "input.m, input.n"),
    },
    tags: ["math", "dynamic-programming", "combinatorics"],
  },
  {
    title: "Set Matrix Zeroes",
    description: "Given an m x n matrix, if an element is 0, set its entire row and column to 0. Do it in-place.",
    difficulty: "medium",
    timeLimit: 450,
    testCases: [
      {
        input: {
          matrix: [
            [1, 1, 1],
            [1, 0, 1],
            [1, 1, 1],
          ],
        },
        expectedOutput: [
          [1, 0, 1],
          [0, 0, 0],
          [1, 0, 1],
        ],
        isHidden: false,
        weight: 1,
      },
      {
        input: {
          matrix: [
            [0, 1, 2, 0],
            [3, 4, 5, 2],
            [1, 3, 1, 5],
          ],
        },
        expectedOutput: [
          [0, 0, 0, 0],
          [0, 4, 5, 0],
          [0, 3, 1, 0],
        ],
        isHidden: true,
        weight: 2,
      },
    ],
    starterCode: {
      javascript: jsStarter("setZeroes", "matrix", "input.matrix"),
      python: pyStarter("set_zeroes", "matrix", "input_data['matrix']"),
      typescript: tsStarter("setZeroes", "matrix: number[][]", "number[][]", "input.matrix"),
    },
    tags: ["array", "matrix", "hash-table"],
  },

  // ==================== HARD CHALLENGES ====================
  {
    title: "Reverse Linked List",
    description: "Given the head of a singly linked list (represented as an array), reverse the list and return the reversed list.",
    difficulty: "hard",
    timeLimit: 600,
    testCases: [
      { input: { head: [1, 2, 3, 4, 5] }, expectedOutput: [5, 4, 3, 2, 1], isHidden: false, weight: 1 },
      { input: { head: [1, 2] }, expectedOutput: [2, 1], isHidden: false, weight: 1 },
      { input: { head: [] }, expectedOutput: [], isHidden: true, weight: 2 },
      { input: { head: [1] }, expectedOutput: [1], isHidden: true, weight: 2 },
    ],
    starterCode: {
      javascript: jsStarter("reverseList", "head", "input.head"),
      python: pyStarter("reverse_list", "head", "input_data['head']"),
      typescript: tsStarter("reverseList", "head: number[]", "number[]", "input.head"),
    },
    tags: ["linked-list", "recursion"],
  },
  {
    title: "Merge K Sorted Lists",
    description: "You are given an array of k sorted arrays. Merge all arrays into one sorted array and return it.",
    difficulty: "hard",
    timeLimit: 600,
    testCases: [
      {
        input: {
          lists: [
            [1, 4, 5],
            [1, 3, 4],
            [2, 6],
          ],
        },
        expectedOutput: [1, 1, 2, 3, 4, 4, 5, 6],
        isHidden: false,
        weight: 1,
      },
      { input: { lists: [] }, expectedOutput: [], isHidden: false, weight: 1 },
      { input: { lists: [[]] }, expectedOutput: [], isHidden: true, weight: 2 },
      {
        input: {
          lists: [
            [1, 2, 3],
            [4, 5, 6],
            [7, 8, 9],
          ],
        },
        expectedOutput: [1, 2, 3, 4, 5, 6, 7, 8, 9],
        isHidden: true,
        weight: 2,
      },
    ],
    starterCode: {
      javascript: jsStarter("mergeKLists", "lists", "input.lists"),
      python: pyStarter("merge_k_lists", "lists", "input_data['lists']"),
      typescript: tsStarter("mergeKLists", "lists: number[][]", "number[]", "input.lists"),
    },
    tags: ["array", "heap", "divide-and-conquer", "merge-sort"],
  },
];
