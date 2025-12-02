"use client";

import React, { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { PracticeChallenge } from "@/lib/api";

interface PracticeChallengeBrowserProps {
  challenges: PracticeChallenge[];
  onSelectChallenge: (challenge: PracticeChallenge) => void;
  onGhostRace?: (challenge: PracticeChallenge) => void;
  isLoading?: boolean;
}

type Difficulty = "all" | "easy" | "medium" | "hard" | "expert";
type Category = "all" | "arrays" | "strings" | "trees" | "graphs" | "dp";

const difficultyColors: Record<string, string> = {
  easy: "text-accent-lime border-accent-lime bg-accent-lime/10",
  medium: "text-yellow-400 border-yellow-400 bg-yellow-400/10",
  hard: "text-accent-magenta border-accent-magenta bg-accent-magenta/10",
  expert: "text-accent-red border-accent-red bg-accent-red/10",
};

const categories: { value: Category; label: string; icon: string }[] = [
  { value: "all", label: "All", icon: "🌐" },
  { value: "arrays", label: "Arrays", icon: "📊" },
  { value: "strings", label: "Strings", icon: "📝" },
  { value: "trees", label: "Trees", icon: "🌳" },
  { value: "graphs", label: "Graphs", icon: "🔗" },
  { value: "dp", label: "DP", icon: "🧮" },
];

const difficulties: { value: Difficulty; label: string }[] = [
  { value: "all", label: "All Levels" },
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
  { value: "expert", label: "Expert" },
];

/**
 * PracticeChallengeBrowser Component
 * Display unlocked challenges with filtering and search
 * Requirements: 17.1
 */
export function PracticeChallengeBrowser({ challenges, onSelectChallenge, onGhostRace, isLoading = false }: PracticeChallengeBrowserProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty>("all");
  const [selectedCategory, setSelectedCategory] = useState<Category>("all");

  // Filter challenges based on search, difficulty, and category
  const filteredChallenges = useMemo(() => {
    return challenges.filter((challenge) => {
      // Search filter
      const matchesSearch = searchQuery === "" || challenge.title.toLowerCase().includes(searchQuery.toLowerCase()) || challenge.description.toLowerCase().includes(searchQuery.toLowerCase());

      // Difficulty filter
      const matchesDifficulty = selectedDifficulty === "all" || challenge.difficulty === selectedDifficulty;

      // Category filter
      const matchesCategory = selectedCategory === "all" || challenge.tags.includes(selectedCategory);

      return matchesSearch && matchesDifficulty && matchesCategory;
    });
  }, [challenges, searchQuery, selectedDifficulty, selectedCategory]);

  return (
    <div className="space-y-6">
      {/* Search and Filters */}
      <div className="space-y-4">
        {/* Search Input */}
        <div className="relative">
          <input type="text" placeholder="Search challenges..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full px-4 py-3 pl-10 bg-background-secondary border border-border-default rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-cyan transition-colors" />
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        {/* Difficulty Filter */}
        <div className="flex flex-wrap gap-2">
          {difficulties.map((diff) => (
            <button key={diff.value} onClick={() => setSelectedDifficulty(diff.value)} className={`px-3 py-1.5 text-sm rounded-lg border transition-all duration-200 ${selectedDifficulty === diff.value ? "bg-accent-cyan/20 border-accent-cyan text-accent-cyan" : "bg-background-secondary border-border-default text-text-secondary hover:border-accent-cyan/50"}`}>
              {diff.label}
            </button>
          ))}
        </div>

        {/* Category Filter */}
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button key={cat.value} onClick={() => setSelectedCategory(cat.value)} className={`px-3 py-1.5 text-sm rounded-lg border transition-all duration-200 flex items-center gap-1.5 ${selectedCategory === cat.value ? "bg-accent-cyan/20 border-accent-cyan text-accent-cyan" : "bg-background-secondary border-border-default text-text-secondary hover:border-accent-cyan/50"}`}>
              <span>{cat.icon}</span>
              <span>{cat.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Results Count */}
      <div className="text-sm text-text-muted">
        {filteredChallenges.length} challenge{filteredChallenges.length !== 1 ? "s" : ""} found
      </div>

      {/* Challenge List */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-40 bg-background-secondary rounded-lg animate-pulse" />
          ))}
        </div>
      ) : filteredChallenges.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-4xl mb-4">🔍</div>
          <p className="text-text-secondary">No challenges found matching your criteria.</p>
          <button
            onClick={() => {
              setSearchQuery("");
              setSelectedDifficulty("all");
              setSelectedCategory("all");
            }}
            className="mt-4 text-accent-cyan hover:underline"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredChallenges.map((challenge, index) => (
            <motion.div key={challenge.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}>
              <div className="w-full text-left p-4 bg-background-secondary border border-border-default rounded-lg hover:border-accent-cyan transition-all duration-200 group">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-text-primary group-hover:text-accent-cyan transition-colors line-clamp-1">{challenge.title}</h3>
                  <span className={`px-2 py-0.5 text-xs border rounded capitalize shrink-0 ml-2 ${difficultyColors[challenge.difficulty]}`}>{challenge.difficulty}</span>
                </div>
                <p className="text-sm text-text-secondary line-clamp-2 mb-3">{challenge.description}</p>
                <div className="flex items-center justify-between text-xs text-text-muted mb-3">
                  <div className="flex flex-wrap gap-1">
                    {challenge.tags.slice(0, 3).map((tag) => (
                      <span key={tag} className="px-1.5 py-0.5 bg-background-primary rounded">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <span className="flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {challenge.time_limit}s
                  </span>
                </div>
                {/* Action Buttons */}
                <div className="flex gap-2">
                  <button onClick={() => onSelectChallenge(challenge)} className="flex-1 px-3 py-2 text-sm bg-accent-cyan/10 border border-accent-cyan/30 text-accent-cyan rounded-lg hover:bg-accent-cyan/20 transition-colors">
                    🧘 Practice
                  </button>
                  {onGhostRace && (
                    <button onClick={() => onGhostRace(challenge)} className="flex-1 px-3 py-2 text-sm bg-accent-magenta/10 border border-accent-magenta/30 text-accent-magenta rounded-lg hover:bg-accent-magenta/20 transition-colors">
                      👻 Ghost Race
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

export default PracticeChallengeBrowser;
