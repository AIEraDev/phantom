"use client";

import React, { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { authApi, ApiError } from "@/lib/api";
import { validateEmail } from "@/lib/validation";

export function LoginForm() {
  const router = useRouter();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState("");

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    const emailValidation = validateEmail(email);
    if (!emailValidation.isValid) {
      newErrors.email = emailValidation.error!;
    }

    if (!password) {
      newErrors.password = "Password is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setApiError("");

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await authApi.login({ email, password });
      login(response.token, response.user);
      router.push("/dashboard");
    } catch (error) {
      if (error instanceof ApiError) {
        setApiError(error.message);
      } else {
        setApiError("An unexpected error occurred. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-6">
      <div className="space-y-2">
        <label htmlFor="email" className="block text-xs font-bold text-text-secondary uppercase tracking-wider font-code">
          Email Address
        </label>
        <div className="relative group">
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (errors.email) {
                setErrors({ ...errors, email: "" });
              }
            }}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-text-muted focus:outline-none focus:border-accent-cyan/50 focus:bg-white/10 transition-all duration-300 font-code text-sm group-hover:border-white/20"
            placeholder="OPERATOR@PHANTOM.NET"
            disabled={isSubmitting}
          />
          <div className="absolute inset-0 rounded-lg bg-accent-cyan/5 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-300" />
        </div>
        {errors.email && <p className="text-xs text-accent-red font-bold tracking-wide animate-shake">{errors.email}</p>}
      </div>

      <div className="space-y-2">
        <label htmlFor="password" className="block text-xs font-bold text-text-secondary uppercase tracking-wider font-code">
          Password
        </label>
        <div className="relative group">
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (errors.password) {
                setErrors({ ...errors, password: "" });
              }
            }}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-text-muted focus:outline-none focus:border-accent-cyan/50 focus:bg-white/10 transition-all duration-300 font-code text-sm group-hover:border-white/20"
            placeholder="••••••••"
            disabled={isSubmitting}
          />
          <div className="absolute inset-0 rounded-lg bg-accent-cyan/5 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-300" />
        </div>
        {errors.password && <p className="text-xs text-accent-red font-bold tracking-wide animate-shake">{errors.password}</p>}
      </div>

      {apiError && (
        <div className="p-3 bg-accent-red/10 border border-accent-red/30 rounded-lg animate-shake">
          <p className="text-xs font-bold text-accent-red flex items-center gap-2">
            <span className="text-lg">⚠️</span> {apiError}
          </p>
        </div>
      )}

      <button type="submit" disabled={isSubmitting} className="w-full px-6 py-4 bg-accent-cyan text-background-primary font-bold text-lg rounded-lg hover:bg-accent-cyan/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-[0_0_20px_rgba(0,240,255,0.3)] hover:shadow-[0_0_30px_rgba(0,240,255,0.5)] hover:-translate-y-0.5 uppercase tracking-widest relative overflow-hidden group">
        <span className="relative z-10">{isSubmitting ? "AUTHENTICATING..." : "ACCESS TERMINAL"}</span>
        <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
      </button>
    </form>
  );
}
