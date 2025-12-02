"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import { userApi } from "@/lib/api";
import { User } from "@/types/auth";
import { UserStats as UserStatsType, Match } from "@/types/match";
import { UserStats } from "@/components/UserStats";
import { MatchHistory } from "@/components/MatchHistory";

export default function ProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const userId = params.userId as string;

  const [user, setUser] = useState<User | null>(null);
  const [stats, setStats] = useState<UserStatsType | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [totalMatches, setTotalMatches] = useState(0);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [isLoadingMatches, setIsLoadingMatches] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ displayName: "", avatarUrl: "" });
  const [isSaving, setIsSaving] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const matchesPerPage = 10;

  const isOwnProfile = currentUser?.id === userId;

  useEffect(() => {
    if (userId) {
      fetchUserData();
    }
  }, [userId, currentPage]);

  const fetchUserData = async () => {
    try {
      setError(null);

      // Fetch user profile
      setIsLoadingUser(true);
      const userResponse = await userApi.getUser(userId);
      setUser(userResponse.user);
      setEditForm({
        displayName: userResponse.user.displayName || "",
        avatarUrl: userResponse.user.avatarUrl || "",
      });
      setAvatarPreview(null);
      setIsLoadingUser(false);

      // Fetch stats
      setIsLoadingStats(true);
      const statsResponse = await userApi.getUserStats(userId);
      setStats(statsResponse.stats);
      setIsLoadingStats(false);

      // Fetch matches
      setIsLoadingMatches(true);
      const matchesResponse = await userApi.getUserMatches(userId, matchesPerPage, currentPage * matchesPerPage);
      setMatches(matchesResponse.matches);
      setTotalMatches(matchesResponse.total);
      setIsLoadingMatches(false);
    } catch (err) {
      console.error("Failed to fetch user data:", err);
      setError("Failed to load profile data");
      setIsLoadingUser(false);
      setIsLoadingStats(false);
      setIsLoadingMatches(false);
    }
  };

  const handleEditProfile = () => {
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setAvatarPreview(null);
    if (user) {
      setEditForm({
        displayName: user.displayName || "",
        avatarUrl: user.avatarUrl || "",
      });
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith("image/")) {
        setError("Please select an image file");
        return;
      }
      // Validate file size (max 2MB)
      if (file.size > 2 * 1024 * 1024) {
        setError("Image must be less than 2MB");
        return;
      }
      // Create preview and convert to base64
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setAvatarPreview(base64);
        setEditForm({ ...editForm, avatarUrl: base64 });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;

    try {
      setIsSaving(true);
      const response = await userApi.updateUser(userId, editForm);
      setUser(response.user);
      setIsEditing(false);
      setIsSaving(false);
    } catch (err) {
      console.error("Failed to update profile:", err);
      setError("Failed to update profile");
      setIsSaving(false);
    }
  };

  const handleNextPage = () => {
    if ((currentPage + 1) * matchesPerPage < totalMatches) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

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
        <div className="fixed top-0 right-0 w-[600px] h-[600px] bg-accent-cyan/5 blur-[120px] rounded-full pointer-events-none z-0" />
        <div className="fixed bottom-0 left-0 w-[600px] h-[600px] bg-accent-magenta/5 blur-[120px] rounded-full pointer-events-none z-0" />

        <div className="max-w-7xl mx-auto p-4 sm:p-8 relative z-10">
          {/* Back Button */}
          <button onClick={() => router.push("/dashboard")} className="mb-8 group flex items-center gap-2 text-text-secondary hover:text-white transition-colors duration-300">
            <div className="p-2 rounded-lg bg-white/5 border border-white/10 group-hover:border-accent-cyan/50 transition-all">
              <svg className="w-5 h-5 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </div>
            <span className="font-code text-sm tracking-wider uppercase">Return to Base</span>
          </button>

          {/* Error Message */}
          {error && (
            <div className="mb-8 p-4 bg-accent-red/10 border border-accent-red/30 rounded-xl flex items-center gap-3">
              <svg className="w-6 h-6 text-accent-red" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-accent-red font-bold">{error}</p>
            </div>
          )}

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Left Column: Profile Card */}
            <div className="lg:col-span-1 space-y-8">
              <div className="glass-card-strong p-8 rounded-2xl border border-white/10 relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-accent-cyan via-accent-magenta to-accent-cyan opacity-50" />

                {isLoadingUser ? (
                  <div className="animate-pulse flex flex-col items-center">
                    <div className="w-32 h-32 bg-white/10 rounded-full mb-6"></div>
                    <div className="h-8 bg-white/10 rounded w-48 mb-3"></div>
                    <div className="h-4 bg-white/10 rounded w-32"></div>
                  </div>
                ) : user ? (
                  <div className="flex flex-col items-center text-center">
                    {!isEditing ? (
                      <>
                        <div className="relative mb-6">
                          <div className="absolute inset-0 bg-accent-cyan/20 blur-xl rounded-full" />
                          <div className="w-32 h-32 relative rounded-full bg-black border-2 border-accent-cyan p-1">
                            <div className="w-full h-full rounded-full overflow-hidden bg-gradient-to-br from-accent-cyan/20 to-transparent flex items-center justify-center">{user.avatarUrl ? <img src={user.avatarUrl} alt={user.username} className="w-full h-full object-cover" /> : <span className="text-5xl font-bold text-accent-cyan">{user.username.charAt(0).toUpperCase()}</span>}</div>
                          </div>
                          <div className="absolute bottom-0 right-0 w-8 h-8 bg-background-primary rounded-full flex items-center justify-center border border-white/10" title="Online Status">
                            <div className="w-3 h-3 bg-accent-lime rounded-full animate-pulse" />
                          </div>
                        </div>

                        <h1 className="text-3xl font-header font-bold text-white mb-2 tracking-tight">{user.displayName || user.username}</h1>
                        <div className="flex items-center gap-2 text-text-secondary mb-6 font-code text-sm">
                          <span>@{user.username}</span>
                          <span className="w-1 h-1 bg-text-muted rounded-full" />
                          <span>Joined {user.createdAt ? new Date(user.createdAt).getFullYear() : "Unknown"}</span>
                        </div>

                        {isOwnProfile && (
                          <button onClick={handleEditProfile} className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-accent-cyan/50 text-white rounded-xl transition-all duration-300 font-bold uppercase tracking-wider text-sm flex items-center justify-center gap-2 group-hover:shadow-[0_0_20px_rgba(0,240,255,0.1)]">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            Edit Profile
                          </button>
                        )}
                      </>
                    ) : (
                      <div className="w-full space-y-6 animate-fade-in">
                        <h3 className="text-xl font-bold text-white border-b border-white/10 pb-4 w-full text-left">EDIT PROFILE</h3>
                        <div className="space-y-4 text-left">
                          <div>
                            <label className="block text-text-secondary text-xs font-bold uppercase tracking-wider mb-2">Display Name</label>
                            <input type="text" value={editForm.displayName} onChange={(e) => setEditForm({ ...editForm, displayName: e.target.value })} className="w-full px-4 py-3 bg-black/40 text-white border border-white/10 rounded-lg focus:border-accent-cyan focus:outline-none focus:ring-1 focus:ring-accent-cyan transition-all font-code text-sm" placeholder="Enter display name" />
                          </div>
                          <div>
                            <label className="block text-text-secondary text-xs font-bold uppercase tracking-wider mb-2">Avatar</label>
                            <div className="flex items-center gap-4">
                              <div className="w-16 h-16 rounded-full overflow-hidden bg-black/40 border border-white/10 flex items-center justify-center">{avatarPreview || editForm.avatarUrl ? <img src={avatarPreview || editForm.avatarUrl} alt="Preview" className="w-full h-full object-cover" /> : <span className="text-2xl font-bold text-accent-cyan">{user?.username.charAt(0).toUpperCase()}</span>}</div>
                              <div className="flex-1">
                                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
                                <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full px-4 py-3 bg-black/40 text-white border border-white/10 rounded-lg hover:border-accent-cyan/50 transition-all font-code text-sm text-left">
                                  {avatarPreview ? "Change Image" : "Upload Image"}
                                </button>
                                <p className="text-text-muted text-xs mt-1">Max 2MB, JPG/PNG/GIF</p>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-3 pt-2">
                          <button onClick={handleSaveProfile} disabled={isSaving} className="flex-1 py-3 bg-accent-cyan text-background-primary font-bold rounded-lg hover:bg-accent-cyan/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 uppercase tracking-wider text-sm">
                            {isSaving ? "Saving..." : "Save"}
                          </button>
                          <button onClick={handleCancelEdit} disabled={isSaving} className="flex-1 py-3 bg-transparent text-white border border-white/10 rounded-lg hover:bg-white/5 hover:border-white/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 uppercase tracking-wider text-sm">
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>

              {/* Quick Stats Summary */}
              {stats && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="glass-card p-4 rounded-xl border border-white/5 text-center">
                    <div className="text-text-secondary text-xs font-bold uppercase tracking-wider mb-1">Rating</div>
                    <div className="text-2xl font-header font-bold text-accent-cyan">{stats.rating}</div>
                  </div>
                  <div className="glass-card p-4 rounded-xl border border-white/5 text-center">
                    <div className="text-text-secondary text-xs font-bold uppercase tracking-wider mb-1">Win Rate</div>
                    <div className="text-2xl font-header font-bold text-accent-magenta">{stats.winRate.toFixed(1)}%</div>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Stats & History */}
            <div className="lg:col-span-2 space-y-8">
              {/* Detailed Stats */}
              <div className="glass-card p-8 rounded-2xl border border-white/10">
                <h2 className="text-2xl font-header font-bold text-white mb-6 flex items-center gap-3">
                  <svg className="w-6 h-6 text-accent-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  COMBAT STATISTICS
                </h2>
                {stats ? <UserStats stats={stats} isLoading={isLoadingStats} /> : <UserStats stats={{ rating: 0, wins: 0, losses: 0, totalMatches: 0, winRate: 0 }} isLoading={isLoadingStats} />}
              </div>

              {/* Match History */}
              <div className="glass-card p-8 rounded-2xl border border-white/10">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-header font-bold text-white flex items-center gap-3">
                    <svg className="w-6 h-6 text-accent-magenta" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    BATTLE LOGS
                  </h2>
                  <div className="text-sm font-code text-text-secondary">
                    TOTAL MATCHES: <span className="text-white font-bold">{totalMatches}</span>
                  </div>
                </div>

                <MatchHistory matches={matches} currentUserId={userId} isLoading={isLoadingMatches} />

                {/* Pagination */}
                {totalMatches > matchesPerPage && (
                  <div className="mt-8 flex items-center justify-between border-t border-white/5 pt-6">
                    <p className="text-text-muted text-sm font-code">
                      SHOWING {currentPage * matchesPerPage + 1} - {Math.min((currentPage + 1) * matchesPerPage, totalMatches)} OF {totalMatches}
                    </p>
                    <div className="flex gap-3">
                      <button onClick={handlePrevPage} disabled={currentPage === 0} className="px-4 py-2 bg-white/5 text-white border border-white/10 rounded-lg hover:bg-white/10 hover:border-accent-cyan/50 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-300 font-bold uppercase tracking-wider text-xs">
                        Previous
                      </button>
                      <button onClick={handleNextPage} disabled={(currentPage + 1) * matchesPerPage >= totalMatches} className="px-4 py-2 bg-white/5 text-white border border-white/10 rounded-lg hover:bg-white/10 hover:border-accent-cyan/50 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-300 font-bold uppercase tracking-wider text-xs">
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Coming Soon Section */}
              <div className="grid md:grid-cols-2 gap-6">
                <div className="glass-card-subtle p-6 rounded-xl border border-white/5 relative overflow-hidden group">
                  <div className="absolute inset-0 bg-gradient-to-br from-accent-cyan/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="relative z-10 text-center">
                    <div className="text-4xl mb-3 opacity-50 group-hover:opacity-100 transition-opacity transform group-hover:scale-110 duration-300">📈</div>
                    <h3 className="text-lg font-bold text-white mb-1">RATING HISTORY</h3>
                    <p className="text-text-secondary text-sm">Visualization module initializing...</p>
                  </div>
                </div>
                <div className="glass-card-subtle p-6 rounded-xl border border-white/5 relative overflow-hidden group">
                  <div className="absolute inset-0 bg-gradient-to-br from-accent-magenta/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="relative z-10 text-center">
                    <div className="text-4xl mb-3 opacity-50 group-hover:opacity-100 transition-opacity transform group-hover:scale-110 duration-300">🏆</div>
                    <h3 className="text-lg font-bold text-white mb-1">ACHIEVEMENTS</h3>
                    <p className="text-text-secondary text-sm">Badge system coming soon.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </ProtectedRoute>
  );
}
