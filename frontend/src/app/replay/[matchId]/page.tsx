"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import CodeEditor from "@/components/CodeEditor";

interface Player {
  id: string;
  username: string;
  rating: number;
}

interface Challenge {
  id: string;
  title: string;
  description: string;
  difficulty: "easy" | "medium" | "hard" | "expert";
}

interface MatchEvent {
  id: number;
  matchId: string;
  playerId: string;
  eventType: "code_update" | "test_run" | "submission" | "cursor_move";
  timestamp: number;
  data: any;
  createdAt: string;
}

interface Match {
  id: string;
  challengeId: string;
  player1Id: string;
  player2Id: string;
  winnerId?: string;
  player1Score?: number;
  player2Score?: number;
  player1Code?: string;
  player2Code?: string;
  player1Language: string;
  player2Language: string;
  duration?: number;
  status: string;
  startedAt?: string;
  completedAt?: string;
}

interface ReplayData {
  match: Match;
  events: MatchEvent[];
  player1: Player;
  player2: Player;
  challenge: Challenge;
}

type PlaybackSpeed = 0.5 | 1 | 2 | 4;

interface KeyMoment {
  timestamp: number;
  label: string;
  type: "test_pass" | "submission" | "start";
}

export default function ReplayPlayerPage() {
  const params = useParams();
  const router = useRouter();
  const matchId = params.matchId as string;

  const [replayData, setReplayData] = useState<ReplayData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<PlaybackSpeed>(1);
  const [player1Code, setPlayer1Code] = useState("");
  const [player2Code, setPlayer2Code] = useState("");
  const [player1Cursor, setPlayer1Cursor] = useState<{ line: number; column: number } | undefined>();
  const [player2Cursor, setPlayer2Cursor] = useState<{ line: number; column: number } | undefined>();

  const playbackTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastUpdateTimeRef = useRef<number>(0);

  // Calculate key moments from events
  const keyMoments = useRef<KeyMoment[]>([]);

  useEffect(() => {
    const fetchReplayData = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          router.push("/login");
          return;
        }

        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/api/matches/${matchId}/replay`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error("Failed to fetch replay data");
        }

        const data: ReplayData = await response.json();
        setReplayData(data);

        // Initialize code as empty - will be populated by replay events
        setPlayer1Code("");
        setPlayer2Code("");

        // Calculate key moments (convert timestamps from ms to seconds for UI)
        const moments: KeyMoment[] = [{ timestamp: 0, label: "Match Start", type: "start" }];

        data.events.forEach((event) => {
          if (event.eventType === "test_run" && event.data?.results) {
            const allPassed = event.data.results.every((r: any) => r.passed);
            if (allPassed) {
              moments.push({
                timestamp: event.timestamp / 1000, // Convert ms to seconds
                label: `${event.playerId === data.player1.id ? data.player1.username : data.player2.username} - All Tests Pass`,
                type: "test_pass",
              });
            }
          } else if (event.eventType === "submission") {
            moments.push({
              timestamp: event.timestamp / 1000, // Convert ms to seconds
              label: `${event.playerId === data.player1.id ? data.player1.username : data.player2.username} - Submitted`,
              type: "submission",
            });
          }
        });

        keyMoments.current = moments;
        setIsLoading(false);
      } catch (err) {
        console.error("Error fetching replay data:", err);
        setError(err instanceof Error ? err.message : "Failed to load replay");
        setIsLoading(false);
      }
    };

    fetchReplayData();
  }, [matchId, router]);

  // Apply events up to current time
  const applyEventsUpToTime = useCallback(
    (time: number) => {
      if (!replayData) return;

      let p1Code = "";
      let p2Code = "";
      let p1Cursor: { line: number; column: number } | undefined;
      let p2Cursor: { line: number; column: number } | undefined;

      // Convert time from seconds to milliseconds for comparison with event timestamps
      const timeMs = time * 1000;

      replayData.events.forEach((event) => {
        if (event.timestamp <= timeMs) {
          if (event.eventType === "code_update") {
            if (event.playerId === replayData.player1.id) {
              p1Code = event.data.code || "";
              if (event.data.cursor) {
                p1Cursor = event.data.cursor;
              }
            } else if (event.playerId === replayData.player2.id) {
              p2Code = event.data.code || "";
              if (event.data.cursor) {
                p2Cursor = event.data.cursor;
              }
            }
          } else if (event.eventType === "cursor_move") {
            if (event.playerId === replayData.player1.id && event.data.cursor) {
              p1Cursor = event.data.cursor;
            } else if (event.playerId === replayData.player2.id && event.data.cursor) {
              p2Cursor = event.data.cursor;
            }
          }
        }
      });

      setPlayer1Code(p1Code);
      setPlayer2Code(p2Code);
      setPlayer1Cursor(p1Cursor);
      setPlayer2Cursor(p2Cursor);
    },
    [replayData]
  );

  // Playback loop
  useEffect(() => {
    if (!isPlaying || !replayData) return;

    const maxTime = replayData.match.duration || 0;

    playbackTimerRef.current = setInterval(() => {
      setCurrentTime((prev) => {
        const newTime = prev + (100 * playbackSpeed) / 1000; // 100ms intervals
        if (newTime >= maxTime) {
          setIsPlaying(false);
          return maxTime;
        }
        return newTime;
      });
    }, 100);

    return () => {
      if (playbackTimerRef.current) {
        clearInterval(playbackTimerRef.current);
      }
    };
  }, [isPlaying, playbackSpeed, replayData]);

  // Update code when currentTime changes
  useEffect(() => {
    if (Math.abs(currentTime - lastUpdateTimeRef.current) > 0.05) {
      applyEventsUpToTime(currentTime);
      lastUpdateTimeRef.current = currentTime;
    }
  }, [currentTime, applyEventsUpToTime]);

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handleSpeedChange = (speed: PlaybackSpeed) => {
    setPlaybackSpeed(speed);
  };

  const handleTimelineChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    applyEventsUpToTime(newTime);
  };

  const handleJumpToMoment = (timestamp: number) => {
    setCurrentTime(timestamp);
    applyEventsUpToTime(timestamp);
  };

  const handleDownloadReplay = () => {
    if (!replayData) return;

    const dataStr = JSON.stringify(replayData, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `replay-${matchId}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (isLoading) {
    return (
      <main className="min-h-screen bg-background-primary flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-4 border-accent-cyan/20 border-t-accent-cyan"></div>
      </main>
    );
  }

  if (error || !replayData) {
    return (
      <main className="min-h-screen bg-background-primary flex items-center justify-center">
        <div className="glass-card p-8 max-w-md text-center">
          <h1 className="text-2xl font-bold text-accent-red mb-4">Error</h1>
          <p className="text-text-secondary mb-6">{error || "Replay not found"}</p>
          <button onClick={() => router.push("/dashboard")} className="px-6 py-2 bg-accent-cyan text-background-primary rounded-lg font-semibold hover:bg-accent-cyan/90 transition-colors">
            Return to Dashboard
          </button>
        </div>
      </main>
    );
  }

  const maxTime = replayData.match.duration || 0;

  return (
    <main className="h-screen bg-background-primary flex flex-col overflow-hidden relative selection:bg-accent-cyan/20 selection:text-accent-cyan">
      {/* Background Grid Pattern */}
      <div
        className="fixed inset-0 z-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: `linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px)`,
          backgroundSize: "4rem 4rem",
        }}
      />

      {/* Top Bar */}
      <div className="glass-card-strong border-b border-white/10 px-6 py-4 flex items-center justify-between relative z-10">
        <div className="flex items-center gap-6">
          <button onClick={() => router.push("/dashboard")} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-text-secondary hover:text-white transition-all duration-300 border border-white/5 hover:border-white/20">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-accent-magenta/10 border border-accent-magenta/30">
              <div className="w-2 h-2 rounded-full bg-accent-magenta animate-pulse" />
              <span className="text-accent-magenta font-bold text-xs uppercase tracking-wider">Replay Mode</span>
            </div>

            <div>
              <h1 className="text-xl font-header font-bold text-white tracking-tight">{replayData.challenge.title}</h1>
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${replayData.challenge.difficulty === "easy" ? "bg-accent-lime/10 border-accent-lime/30 text-accent-lime" : replayData.challenge.difficulty === "medium" ? "bg-yellow-500/10 border-yellow-500/30 text-yellow-500" : "bg-accent-red/10 border-accent-red/30 text-accent-red"}`}>{replayData.challenge.difficulty}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button onClick={handleDownloadReplay} className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-text-secondary hover:text-white hover:bg-white/10 hover:border-white/20 transition-all duration-300 text-xs font-bold uppercase tracking-wider group">
            <svg className="w-4 h-4 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download Replay
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden relative z-10">
        {/* Left Side - Player 1 (50%) */}
        <div className="w-1/2 border-r border-white/10 flex flex-col bg-background-primary/50 backdrop-blur-sm">
          {/* Player 1 Info */}
          <div className="bg-white/5 px-4 py-3 border-b border-white/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-accent-cyan/20 border border-accent-cyan/50 flex items-center justify-center text-accent-cyan font-bold shadow-[0_0_10px_rgba(0,240,255,0.2)]">{replayData.player1.username.charAt(0).toUpperCase()}</div>
                <div>
                  <p className="text-white font-bold text-sm tracking-wide">{replayData.player1.username}</p>
                  <p className="text-accent-cyan text-xs font-code">RATING: {replayData.player1.rating}</p>
                </div>
              </div>
              {replayData.match.winnerId === replayData.player1.id && (
                <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-accent-lime bg-accent-lime/10 px-2 py-1 rounded border border-accent-lime/20 shadow-[0_0_10px_rgba(57,255,20,0.2)]">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  Winner
                </span>
              )}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-[10px] uppercase text-text-muted font-bold tracking-wider">Language:</span>
              <span className="text-xs text-white font-code bg-white/5 px-1.5 py-0.5 rounded border border-white/10">{replayData.match.player1Language}</span>
            </div>
          </div>

          {/* Player 1 Editor */}
          <div className="flex-1 overflow-hidden relative">
            <CodeEditor language={replayData.match.player1Language as any} initialCode={player1Code} onChange={() => {}} readOnly={true} showCursor={player1Cursor} height="100%" />
          </div>
        </div>

        {/* Right Side - Player 2 (50%) */}
        <div className="w-1/2 flex flex-col bg-background-secondary/30 backdrop-blur-sm">
          {/* Player 2 Info */}
          <div className="bg-white/5 px-4 py-3 border-b border-white/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-accent-magenta/20 border border-accent-magenta/50 flex items-center justify-center text-accent-magenta font-bold shadow-[0_0_10px_rgba(255,0,60,0.2)]">{replayData.player2.username.charAt(0).toUpperCase()}</div>
                <div>
                  <p className="text-white font-bold text-sm tracking-wide">{replayData.player2.username}</p>
                  <p className="text-accent-magenta text-xs font-code">RATING: {replayData.player2.rating}</p>
                </div>
              </div>
              {replayData.match.winnerId === replayData.player2.id && (
                <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-accent-lime bg-accent-lime/10 px-2 py-1 rounded border border-accent-lime/20 shadow-[0_0_10px_rgba(57,255,20,0.2)]">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  Winner
                </span>
              )}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-[10px] uppercase text-text-muted font-bold tracking-wider">Language:</span>
              <span className="text-xs text-white font-code bg-white/5 px-1.5 py-0.5 rounded border border-white/10">{replayData.match.player2Language}</span>
            </div>
          </div>

          {/* Player 2 Editor */}
          <div className="flex-1 overflow-hidden relative">
            <CodeEditor language={replayData.match.player2Language as any} initialCode={player2Code} onChange={() => {}} readOnly={true} showCursor={player2Cursor} height="100%" />
          </div>
        </div>
      </div>

      {/* Control Bar */}
      <div className="glass-card-strong border-t border-white/10 px-6 py-4 relative z-20">
        {/* Key Moments */}
        {keyMoments.current.length > 0 && (
          <div className="mb-4 flex gap-2 flex-wrap items-center">
            <span className="text-text-secondary text-xs font-bold uppercase tracking-wider mr-2">Key Moments:</span>
            {keyMoments.current.map((moment, index) => (
              <button key={index} onClick={() => handleJumpToMoment(moment.timestamp)} className={`px-3 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-all duration-300 border ${moment.type === "start" ? "bg-accent-cyan/10 border-accent-cyan/30 text-accent-cyan hover:bg-accent-cyan/20" : moment.type === "test_pass" ? "bg-accent-lime/10 border-accent-lime/30 text-accent-lime hover:bg-accent-lime/20" : "bg-accent-magenta/10 border-accent-magenta/30 text-accent-magenta hover:bg-accent-magenta/20"}`}>
                {moment.label}
              </button>
            ))}
          </div>
        )}

        {/* Timeline */}
        <div className="mb-4 relative group">
          <input type="range" min="0" max={maxTime} step="0.1" value={currentTime} onChange={handleTimelineChange} className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer slider hover:bg-white/20 transition-colors" />
          <div className="flex justify-between text-text-muted text-xs font-code mt-2">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(maxTime)}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-8">
          {/* Play/Pause */}
          <button onClick={handlePlayPause} className="w-14 h-14 flex items-center justify-center bg-accent-cyan text-background-primary rounded-full hover:bg-accent-cyan/90 transition-all duration-300 shadow-[0_0_20px_rgba(0,240,255,0.3)] hover:shadow-[0_0_30px_rgba(0,240,255,0.5)] hover:scale-105">
            {isPlaying ? (
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-6 h-6 ml-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
              </svg>
            )}
          </button>

          {/* Speed Controls */}
          <div className="flex items-center gap-1 bg-white/5 p-1 rounded-lg border border-white/10">
            {([0.5, 1, 2, 4] as PlaybackSpeed[]).map((speed) => (
              <button key={speed} onClick={() => handleSpeedChange(speed)} className={`px-3 py-1.5 rounded text-xs font-bold transition-all duration-300 ${playbackSpeed === speed ? "bg-accent-cyan text-background-primary shadow-sm" : "text-text-secondary hover:text-white hover:bg-white/5"}`}>
                {speed}x
              </button>
            ))}
          </div>
        </div>
      </div>

      <style jsx global>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #00ffff;
          cursor: pointer;
          box-shadow: 0 0 10px rgba(0, 255, 255, 0.8);
          margin-top: -6px;
          transition: transform 0.1s;
        }
        .slider::-webkit-slider-thumb:hover {
          transform: scale(1.2);
        }

        .slider::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #00ffff;
          cursor: pointer;
          border: none;
          box-shadow: 0 0 10px rgba(0, 255, 255, 0.8);
          transition: transform 0.1s;
        }
        .slider::-moz-range-thumb:hover {
          transform: scale(1.2);
        }

        .slider::-webkit-slider-runnable-track {
          background: linear-gradient(to right, #00ffff 0%, #00ffff ${(currentTime / maxTime) * 100}%, rgba(255, 255, 255, 0.1) ${(currentTime / maxTime) * 100}%, rgba(255, 255, 255, 0.1) 100%);
          height: 4px;
          border-radius: 2px;
        }

        .slider::-moz-range-track {
          background: rgba(255, 255, 255, 0.1);
          height: 4px;
          border-radius: 2px;
        }

        .slider::-moz-range-progress {
          background: #00ffff;
          height: 4px;
          border-radius: 2px;
        }
      `}</style>
    </main>
  );
}
