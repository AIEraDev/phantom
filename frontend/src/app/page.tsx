"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthRedirect } from "@/hooks/useAuthRedirect";

export default function LandingPage() {
  const router = useRouter();
  const { isLoading: authLoading, isAuthenticated } = useAuthRedirect();
  const [liveMatchCount, setLiveMatchCount] = useState(0);
  const [animatedCode, setAnimatedCode] = useState("");
  const [cursorVisible, setCursorVisible] = useState(true);

  const codeSnippet = `function quickSort(arr) {
  if (arr.length <= 1) return arr;
  const pivot = arr[0];
  const left = arr.filter(x => x < pivot);
  const right = arr.filter(x => x > pivot);
  return [...quickSort(left), pivot, ...quickSort(right)];
}`;

  // Animated typing effect for code snippet
  useEffect(() => {
    let currentIndex = 0;
    const typingInterval = setInterval(() => {
      if (currentIndex <= codeSnippet.length) {
        setAnimatedCode(codeSnippet.slice(0, currentIndex));
        currentIndex++;
      } else {
        clearInterval(typingInterval);
      }
    }, 50);

    return () => clearInterval(typingInterval);
  }, []);

  // Cursor blink effect
  useEffect(() => {
    const cursorInterval = setInterval(() => {
      setCursorVisible((prev) => !prev);
    }, 500);

    return () => clearInterval(cursorInterval);
  }, []);

  // Fetch live match count
  useEffect(() => {
    const fetchMatchCount = async () => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/stats/live-matches`);
        if (response.ok) {
          const data = await response.json();
          setLiveMatchCount(data.count || 0);
        }
      } catch (error) {
        // Fallback to mock data for demo
        setLiveMatchCount(Math.floor(Math.random() * 50) + 10);
      }
    };

    fetchMatchCount();
    const interval = setInterval(fetchMatchCount, 10000); // Update every 10 seconds

    return () => clearInterval(interval);
  }, []);

  // Smooth scroll handler
  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  // Show loading spinner while checking auth
  if (authLoading || isAuthenticated) {
    return (
      <main className="min-h-screen bg-gradient-cyber flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-accent-cyan border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background-primary overflow-x-hidden selection:bg-accent-cyan/20 selection:text-accent-cyan">
      {/* Background Grid Pattern */}
      <div
        className="fixed inset-0 z-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: `linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px)`,
          backgroundSize: '4rem 4rem'
        }}
      />

      {/* Ambient Glows */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-accent-cyan/10 blur-[120px] rounded-full pointer-events-none z-0" />
      <div className="fixed bottom-0 right-0 w-[800px] h-[600px] bg-accent-magenta/5 blur-[120px] rounded-full pointer-events-none z-0" />

      {/* Navbar Placeholder (if needed, or just keep it clean) */}
      <nav className="relative z-50 px-6 py-6 flex justify-between items-center max-w-7xl mx-auto">
        <div className="text-2xl font-header font-bold tracking-tighter text-white">
          PHANTOM<span className="text-accent-cyan">.</span>
        </div>
        <div className="flex items-center gap-6">
          <Link href="/login" className="text-sm font-medium text-text-secondary hover:text-white transition-colors">
            Login
          </Link>
          <Link href="/register" className="px-5 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-sm font-medium text-white transition-all backdrop-blur-sm">
            Sign Up
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 min-h-[90vh] flex items-center justify-center px-4 sm:px-6">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
          {/* Left Content */}
          <div className="space-y-8 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-cyan/10 border border-accent-cyan/20 text-accent-cyan text-xs font-medium tracking-wide uppercase animate-fade-in">
              <span className="w-2 h-2 rounded-full bg-accent-cyan animate-pulse" />
              System Online
            </div>

            <h1 className="text-6xl sm:text-7xl md:text-8xl font-header font-bold tracking-tight leading-[0.9] text-white animate-slide-in-up">
              CODE<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent-cyan to-accent-magenta">BATTLE</span><br />
              DOMINATE
            </h1>

            <p className="text-lg sm:text-xl text-text-secondary max-w-xl mx-auto lg:mx-0 leading-relaxed animate-slide-in-up" style={{ animationDelay: "100ms" }}>
              The ultimate competitive coding arena. Face off against developers worldwide in real-time battles. Write code, execute tests, and prove your supremacy.
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start animate-slide-in-up" style={{ animationDelay: "200ms" }}>
              <Link
                href="/register"
                className="group relative px-8 py-4 bg-accent-cyan text-background-primary font-bold text-lg rounded-none skew-x-[-10deg] hover:bg-accent-cyan/90 transition-all"
              >
                <span className="block skew-x-[10deg]">INITIATE SEQUENCE</span>
                <div className="absolute inset-0 border border-white/20 skew-x-[-10deg] translate-x-1 translate-y-1 group-hover:translate-x-0 group-hover:translate-y-0 transition-transform" />
              </Link>

              <Link
                href="/matchmaking"
                className="group px-8 py-4 bg-transparent border border-white/10 text-white font-bold text-lg rounded-none skew-x-[-10deg] hover:border-accent-magenta/50 hover:text-accent-magenta transition-all backdrop-blur-sm"
              >
                <span className="block skew-x-[10deg]">QUICK PLAY</span>
              </Link>
            </div>

            <div className="pt-8 flex items-center justify-center lg:justify-start gap-8 text-text-muted text-sm font-code">
              <div className="flex items-center gap-2">
                <span className="text-accent-lime">{liveMatchCount}</span>
                <span>ACTIVE BATTLES</span>
              </div>
              <div className="w-px h-4 bg-white/10" />
              <div className="flex items-center gap-2">
                <span className="text-accent-cyan">v2.0.4</span>
                <span>STABLE</span>
              </div>
            </div>
          </div>

          {/* Right Content - Code Terminal */}
          <div className="relative hidden lg:block animate-float-3d">
            <div className="absolute -inset-1 bg-gradient-to-r from-accent-cyan to-accent-magenta rounded-xl blur opacity-20" />
            <div className="relative bg-[#0a0a12] border border-white/10 rounded-xl overflow-hidden shadow-2xl">
              <div className="flex items-center justify-between px-4 py-3 bg-white/5 border-b border-white/5">
                <div className="flex gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/50" />
                  <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50" />
                </div>
                <div className="text-xs text-text-muted font-code">quickSort.js</div>
              </div>
              <div className="p-6 font-code text-sm leading-relaxed overflow-x-auto">
                <pre>
                  <code className="text-text-secondary">
                    {animatedCode}
                    {cursorVisible && <span className="inline-block w-2 h-5 bg-accent-cyan align-middle ml-1" />}
                  </code>
                </pre>
              </div>
              {/* Terminal Footer */}
              <div className="px-4 py-2 bg-accent-cyan/5 border-t border-accent-cyan/10 flex justify-between items-center text-xs font-code">
                <span className="text-accent-cyan">-- INSERT --</span>
                <span className="text-text-muted">Ln {animatedCode.split('\n').length}, Col 1</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="relative z-10 py-32 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-header font-bold text-white mb-6">
              SYSTEM <span className="text-accent-magenta">CAPABILITIES</span>
            </h2>
            <p className="text-text-secondary max-w-2xl mx-auto text-lg">
              Advanced tools and features designed for the modern competitive programmer.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                title: "Real-Time Sync",
                desc: "Sub-millisecond latency updates. Watch every keystroke as it happens.",
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                ),
                color: "cyan"
              },
              {
                title: "AI Analysis",
                desc: "Instant feedback on complexity, style, and potential optimizations.",
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                ),
                color: "magenta"
              },
              {
                title: "Global Rank",
                desc: "ELO-based matchmaking system. Climb from Script Kiddie to Grandmaster.",
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                ),
                color: "lime"
              },
              {
                title: "Spectator Mode",
                desc: "Learn from the best. Watch high-stakes matches live with full playback controls.",
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                ),
                color: "cyan"
              },
              {
                title: "Battle Replays",
                desc: "Analyze your past matches. Step-by-step execution review.",
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ),
                color: "magenta"
              },
              {
                title: "Polyglot",
                desc: "Support for 20+ languages including Python, Rust, Go, and TypeScript.",
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                  </svg>
                ),
                color: "lime"
              }
            ].map((feature, i) => (
              <div
                key={i}
                className="group relative p-8 bg-background-secondary/40 border border-white/5 hover:border-white/10 transition-all duration-300 overflow-hidden"
              >
                <div className={`absolute inset-0 bg-gradient-to-br from-accent-${feature.color}/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity`} />

                <div className={`w-12 h-12 mb-6 rounded-lg bg-accent-${feature.color}/10 flex items-center justify-center text-accent-${feature.color} group-hover:scale-110 transition-transform duration-300`}>
                  {feature.icon}
                </div>

                <h3 className="text-xl font-header font-bold text-white mb-3 relative z-10">
                  {feature.title}
                </h3>
                <p className="text-text-secondary text-sm leading-relaxed relative z-10">
                  {feature.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-32 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-accent-cyan/5 skew-y-3 transform origin-top-left scale-110" />

        <div className="relative z-10 max-w-4xl mx-auto text-center space-y-8">
          <h2 className="text-5xl md:text-7xl font-header font-bold text-white tracking-tight">
            READY TO <span className="text-accent-magenta">ASCEND</span>?
          </h2>
          <p className="text-xl text-text-secondary max-w-2xl mx-auto">
            Join the elite. Prove your worth. The leaderboard awaits.
          </p>

          <div className="flex flex-wrap justify-center gap-6 pt-8">
            <Link
              href="/register"
              className="px-10 py-4 bg-white text-background-primary font-bold text-lg hover:bg-gray-200 transition-colors"
            >
              START FREE
            </Link>
            <Link
              href="/leaderboard"
              className="px-10 py-4 bg-transparent border border-white/20 text-white font-bold text-lg hover:bg-white/5 transition-colors"
            >
              VIEW RANKINGS
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 py-12 px-6 border-t border-white/5 bg-background-secondary/30">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-2xl font-header font-bold tracking-tighter text-white opacity-50">
            PHANTOM
          </div>

          <div className="flex gap-8 text-sm text-text-muted">
            <Link href="#" className="hover:text-white transition-colors">Terms</Link>
            <Link href="#" className="hover:text-white transition-colors">Privacy</Link>
            <Link href="#" className="hover:text-white transition-colors">Discord</Link>
            <Link href="#" className="hover:text-white transition-colors">Twitter</Link>
          </div>

          <div className="text-sm text-text-muted">
            &copy; 2025 Phantom Inc.
          </div>
        </div>
      </footer>
    </main>
  );
}
