"use client";

import { useCallback, useEffect, useRef } from "react";

interface UseScreenShakeOptions {
  duration?: number;
  intensity?: "light" | "medium" | "strong";
}

export function useScreenShake(options: UseScreenShakeOptions = {}) {
  const { duration = 200, intensity = "medium" } = options;
  const elementRef = useRef<HTMLElement | null>(null);

  const shake = useCallback(() => {
    if (!elementRef.current) {
      elementRef.current = document.body;
    }

    const element = elementRef.current;
    element.classList.add("animate-shake");

    setTimeout(() => {
      element.classList.remove("animate-shake");
    }, duration);
  }, [duration]);

  return { shake, elementRef };
}

// Utility function to trigger shake on any element
export function triggerShake(element: HTMLElement | null, duration = 200) {
  if (!element) return;

  element.classList.add("animate-shake");

  setTimeout(() => {
    element.classList.remove("animate-shake");
  }, duration);
}
