"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { SkillTreeGraph } from "@/components/SkillTreeGraph";
import { ChallengeDetailsModal } from "@/components/ChallengeDetailsModal";
import { skillTreeApi, SkillTreeNode, SkillTreeEdge } from "@/lib/api";

type Category = "all" | "arrays" | "strings" | "trees" | "graphs" | "dp";

const categories: { value: Category; label: string; icon: string }[] = [
  { value: "all", label: "All", icon: "🌐" },
  { value: "arrays", label: "Arrays", icon: "📊" },
  { value: "strings", label: "Strings", icon: "📝" },
  { value: "trees", label: "Trees", icon: "🌳" },
  { value: "graphs", label: "Graphs", icon: "🔗" },
  { value: "dp", label: "Dynamic Programming", icon: "🧮" },
];

export default function SkillTreePage() {
  const router = useRouter();
  const [nodes, setNodes] = useState<SkillTreeNode[]>([]);
  const [edges, setEdges] = useState<SkillTreeEdge[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<Category>("all");
  const [selectedNode, setSelectedNode] = useState<SkillTreeNode | null>(null);

  const fetchSkillTree = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await skillTreeApi.getSkillTree();
      setNodes(response.nodes);
      setEdges(response.edges);
    } catch (err) {
      console.error("Failed to fetch skill tree:", err);
      setError("Failed to load skill tree. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSkillTree();
  }, [fetchSkillTree]);

  const handleNodeClick = useCallback((node: SkillTreeNode) => {
    setSelectedNode(node);
  }, []);

  const handleCloseModal = useCallback(() => {
    setSelectedNode(null);
  }, []);

  // Calculate stats
  const totalChallenges = nodes.length;
  const completedChallenges = nodes.filter((n) => n.isCompleted).length;
  const masteredChallenges = nodes.filter((n) => n.isMastered).length;
  const unlockedChallenges = nodes.filter((n) => n.isUnlocked).length;

  return (
    <ProtectedRoute>
      <main className="min-h-screen bg-background-primary relative overflow-hidden selection:bg-accent-cyan/20 selection:text-accent-cyan">
        {/* Background Grid Pattern */}
        <div
          className="fixed inset-0 z-0 pointer-events-none opacity-20"
          style={{
            backgroundImage: `linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px)`,
            backgroundSize: "4rem 4rem",
          }}
        />

        {/* Ambient Glows */}
        <div className="fixed top-0 left-0 w-[600px] h-[600px] bg-accent-cyan/5 blur-[120px] rounded-full pointer-events-none z-0" />
        <div className="fixed bottom-0 right-0 w-[600px] h-[600px] bg-accent-magenta/5 blur-[120px] rounded-full pointer-events-none z-0" />

        <div className="relative z-10 flex flex-col min-h-screen">
          {/* Header */}
          <div className="border-b border-white/5 bg-background-secondary/50 backdrop-blur-xl sticky top-0 z-20">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-header font-bold text-white tracking-tight flex items-center gap-3">
                    <span className="text-accent-cyan">SKILL</span> TREE
                  </h1>
                  <p className="text-text-secondary text-sm mt-1 font-code">NEURAL NETWORK SYNCHRONIZATION</p>
                </div>
                <button onClick={() => router.push("/dashboard")} className="group flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-accent-cyan/50 text-white rounded-lg transition-all duration-300 text-sm font-bold uppercase tracking-wider">
                  <svg className="w-4 h-4 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Return to Base
                </button>
              </div>
            </div>
          </div>

          {/* Stats bar */}
          {!isLoading && !error && (
            <div className="border-b border-white/5 bg-black/20 backdrop-blur-sm">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
                <div className="flex flex-wrap gap-4 sm:gap-8 text-sm">
                  <div className="flex items-center gap-3 px-4 py-2 rounded-lg bg-white/5 border border-white/5">
                    <span className="text-text-muted font-code uppercase text-xs">Total Nodes</span>
                    <span className="text-white font-bold font-header text-lg">{totalChallenges}</span>
                  </div>
                  <div className="flex items-center gap-3 px-4 py-2 rounded-lg bg-accent-cyan/10 border border-accent-cyan/20">
                    <div className="w-2 h-2 rounded-full bg-accent-cyan shadow-[0_0_10px_rgba(0,240,255,0.5)]" />
                    <span className="text-text-muted font-code uppercase text-xs">Unlocked</span>
                    <span className="text-accent-cyan font-bold font-header text-lg">{unlockedChallenges}</span>
                  </div>
                  <div className="flex items-center gap-3 px-4 py-2 rounded-lg bg-accent-lime/10 border border-accent-lime/20">
                    <div className="w-2 h-2 rounded-full bg-accent-lime shadow-[0_0_10px_rgba(57,255,20,0.5)]" />
                    <span className="text-text-muted font-code uppercase text-xs">Completed</span>
                    <span className="text-accent-lime font-bold font-header text-lg">{completedChallenges}</span>
                  </div>
                  <div className="flex items-center gap-3 px-4 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                    <div className="w-2 h-2 rounded-full bg-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.5)]" />
                    <span className="text-text-muted font-code uppercase text-xs">Mastered</span>
                    <span className="text-yellow-400 font-bold font-header text-lg">{masteredChallenges}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Category filter tabs */}
          <div className="border-b border-white/5 bg-background-primary/80 backdrop-blur-sm">
            <div className="max-w-7xl mx-auto px-4 sm:px-6">
              <div className="flex overflow-x-auto scrollbar-hide">
                {categories.map((category) => (
                  <button
                    key={category.value}
                    onClick={() => setSelectedCategory(category.value)}
                    className={`
                      flex items-center gap-2 px-6 py-4 text-sm font-bold uppercase tracking-wider whitespace-nowrap
                      border-b-2 transition-all duration-300 relative group
                      ${selectedCategory === category.value ? "border-accent-cyan text-accent-cyan bg-accent-cyan/5" : "border-transparent text-text-muted hover:text-white hover:bg-white/5"}
                    `}
                  >
                    <span className="text-lg group-hover:scale-110 transition-transform duration-300">{category.icon}</span>
                    <span>{category.label}</span>
                    {category.value !== "all" && (
                      <span
                        className={`
                        ml-2 text-xs px-1.5 py-0.5 rounded font-code
                        ${selectedCategory === category.value ? "bg-accent-cyan/20 text-accent-cyan" : "bg-white/10 text-text-muted"}
                      `}
                      >
                        {nodes.filter((n) => n.category === category.value).length}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Main content */}
          <div className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 flex flex-col">
            {/* Loading state */}
            {isLoading && (
              <div className="flex-1 flex flex-col items-center justify-center gap-6 min-h-[400px]">
                <div className="relative">
                  <div className="w-16 h-16 border-4 border-accent-cyan/30 border-t-accent-cyan rounded-full animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-8 h-8 bg-accent-cyan/20 rounded-full animate-pulse" />
                  </div>
                </div>
                <p className="text-accent-cyan font-code tracking-widest animate-pulse">INITIALIZING NEURAL INTERFACE...</p>
              </div>
            )}

            {/* Error state */}
            {error && (
              <div className="flex-1 flex flex-col items-center justify-center gap-6 min-h-[400px]">
                <div className="w-20 h-20 rounded-full bg-accent-red/10 flex items-center justify-center border border-accent-red/30">
                  <svg className="w-10 h-10 text-accent-red" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div className="text-center">
                  <h3 className="text-xl font-bold text-white mb-2">CONNECTION FAILURE</h3>
                  <p className="text-accent-red font-code">{error}</p>
                </div>
                <button onClick={fetchSkillTree} className="px-8 py-3 bg-accent-cyan text-background-primary font-bold rounded-lg hover:bg-accent-cyan/90 transition-all duration-300 uppercase tracking-wider shadow-[0_0_20px_rgba(0,240,255,0.3)] hover:shadow-[0_0_30px_rgba(0,240,255,0.5)]">
                  Retry Connection
                </button>
              </div>
            )}

            {/* Skill tree graph */}
            {!isLoading && !error && (
              <div className="flex-1 relative glass-card-strong rounded-2xl border border-white/10 overflow-hidden min-h-[600px]">
                <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
                <SkillTreeGraph nodes={nodes} edges={edges} onNodeClick={handleNodeClick} selectedNodeId={selectedNode?.id} categoryFilter={selectedCategory === "all" ? undefined : selectedCategory} />

                {/* Legend Overlay */}
                <div className="absolute bottom-6 right-6 glass-card p-4 rounded-xl border border-white/10 backdrop-blur-md">
                  <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-3 border-b border-white/10 pb-2">Node Status</h3>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded bg-gray-800/60 border border-gray-600" />
                      <span className="text-text-muted text-xs font-code">LOCKED</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded bg-background-secondary/80 border-2 border-accent-cyan shadow-[0_0_10px_rgba(0,240,255,0.3)]" />
                      <span className="text-white text-xs font-code">UNLOCKED</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded bg-accent-lime/20 border-2 border-accent-lime shadow-[0_0_10px_rgba(57,255,20,0.3)]" />
                      <span className="text-accent-lime text-xs font-code">COMPLETED</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded bg-yellow-500/20 border-2 border-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.3)]" />
                      <span className="text-yellow-400 text-xs font-code">MASTERED</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Challenge details modal */}
          {selectedNode && <ChallengeDetailsModal node={selectedNode} onClose={handleCloseModal} allNodes={nodes} />}
        </div>
      </main>
    </ProtectedRoute>
  );
}
