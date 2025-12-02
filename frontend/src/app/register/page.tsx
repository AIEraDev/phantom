"use client";

import Link from "next/link";
import { RegisterForm } from "@/components/RegisterForm";
import { useAuthRedirect } from "@/hooks/useAuthRedirect";
import { PageLayout } from "@/components/PageLayout";

export default function RegisterPage() {
  const { isLoading, isAuthenticated } = useAuthRedirect();

  // Show nothing while checking auth or if authenticated (will redirect)
  if (isLoading || isAuthenticated) {
    return (
      <PageLayout className="flex items-center justify-center">
        <div className="w-12 h-12 border-2 border-accent-cyan border-t-transparent rounded-full animate-spin relative z-10" />
      </PageLayout>
    );
  }

  return (
    <PageLayout className="flex items-center justify-center p-6" glowColor="magenta">
      <div className="w-full min-w-[40rem] relative z-10 animate-slide-in-up">
        <div className="text-center mb-10">
          <Link href="/" className="inline-block group">
            <h1 className="text-5xl font-header font-bold text-white mb-2 tracking-tight group-hover:text-accent-magenta transition-colors">
              PHANTOM<span className="text-accent-magenta group-hover:text-white transition-colors">.</span>
            </h1>
          </Link>
          <p className="text-text-secondary text-lg">Join the ranks. Prove your worth.</p>
        </div>

        <div className="glass-card-strong rounded-xl p-8 border border-white/10 shadow-2xl backdrop-blur-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-accent-magenta to-transparent opacity-50" />

          <RegisterForm />

          <div className="mt-8 pt-6 border-t border-white/5 text-center">
            <p className="text-text-secondary text-sm">
              Already an operative?{" "}
              <Link href="/login" className="text-accent-magenta font-bold hover:text-accent-magenta/80 transition-colors">
                Access Terminal
              </Link>
            </p>
          </div>
        </div>

        <div className="mt-8 text-center text-xs text-text-muted font-code">ENCRYPTION LEVEL: MAXIMUM</div>
      </div>
    </PageLayout>
  );
}
