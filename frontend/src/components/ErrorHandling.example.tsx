/**
 * Example usage of error handling and loading state components
 * This file demonstrates how to use the error handling system in practice
 */

"use client";

import { useState, useEffect } from "react";
import { ErrorBoundary } from "./ErrorBoundary";
import { toastManager } from "./Toast";
import { UserStatsLoadingSkeleton, MatchHistoryLoadingSkeleton } from "./LoadingSkeleton";
import { ErrorState, EmptyState } from "./RetryButton";
import { userApi, ApiError } from "@/lib/api";

// Example 1: Using ErrorBoundary to catch React errors
export function ExampleWithErrorBoundary() {
  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        // Log error to monitoring service
        console.error("Error caught by boundary:", error, errorInfo);
        toastManager.error("An unexpected error occurred");
      }}
    >
      <YourComponent />
    </ErrorBoundary>
  );
}

// Example 2: Using toast notifications for API errors
export function ExampleWithToastNotifications() {
  const handleLogin = async (email: string, password: string) => {
    try {
      // API call
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        throw new Error("Login failed");
      }

      toastManager.success("Login successful!");
    } catch (error) {
      if (error instanceof ApiError) {
        toastManager.error(error.message);
      } else {
        toastManager.error("An unexpected error occurred");
      }
    }
  };

  return <button onClick={() => handleLogin("user@example.com", "password")}>Login</button>;
}

// Example 3: Using loading skeletons and error states
export function ExampleWithLoadingAndError() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await userApi.getUserStats("user-id");
      setData(result.stats);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        toastManager.error(err.message);
      } else {
        setError("Failed to load data");
        toastManager.error("Failed to load data");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return <UserStatsLoadingSkeleton />;
  }

  if (error) {
    return <ErrorState title="Failed to load stats" message={error} onRetry={fetchData} />;
  }

  if (!data) {
    return (
      <EmptyState
        title="No stats available"
        message="Start playing matches to see your stats"
        icon="📊"
        action={{
          label: "Find Match",
          onClick: () => {
            // Navigate to matchmaking
          },
        }}
      />
    );
  }

  return <div>Stats: {JSON.stringify(data)}</div>;
}

// Example 4: Comprehensive data fetching component
interface DataFetcherProps<T> {
  fetchFn: () => Promise<T>;
  LoadingSkeleton: React.ComponentType;
  children: (data: T) => React.ReactNode;
  errorTitle?: string;
  emptyTitle?: string;
  emptyMessage?: string;
  emptyAction?: {
    label: string;
    onClick: () => void;
  };
}

export function DataFetcher<T>({ fetchFn, LoadingSkeleton, children, errorTitle = "Failed to load data", emptyTitle = "No data available", emptyMessage = "There is no data to display", emptyAction }: DataFetcherProps<T>) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<T | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await fetchFn();
      setData(result);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        toastManager.error(err.message);
      } else {
        setError("An unexpected error occurred");
        toastManager.error("An unexpected error occurred");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (error) {
    return <ErrorState title={errorTitle} message={error} onRetry={fetchData} />;
  }

  if (!data) {
    return <EmptyState title={emptyTitle} message={emptyMessage} action={emptyAction} />;
  }

  return <>{children(data)}</>;
}

// Example 5: Using DataFetcher
export function ExampleUsingDataFetcher() {
  return (
    <DataFetcher
      fetchFn={() => userApi.getUserMatches("user-id", 10, 0)}
      LoadingSkeleton={MatchHistoryLoadingSkeleton}
      errorTitle="Failed to load match history"
      emptyTitle="No matches yet"
      emptyMessage="Start playing to see your match history"
      emptyAction={{
        label: "Find Match",
        onClick: () => {
          // Navigate to matchmaking
        },
      }}
    >
      {(data) => (
        <div>
          <h2>Match History</h2>
          {data.matches.map((match) => (
            <div key={match.id}>{match.id}</div>
          ))}
        </div>
      )}
    </DataFetcher>
  );
}

// Placeholder component
function YourComponent() {
  return <div>Your component content</div>;
}
