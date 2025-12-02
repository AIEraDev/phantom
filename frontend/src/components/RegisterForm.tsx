"use client";

import React, { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { authApi, ApiError } from "@/lib/api";
import { validateEmail, validatePassword, validateUsername } from "@/lib/validation";

export function RegisterForm() {
  const router = useRouter();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState("");

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    const emailValidation = validateEmail(email);
    if (!emailValidation.isValid) {
      newErrors.email = emailValidation.error!;
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      newErrors.password = passwordValidation.error!;
    }

    const usernameValidation = validateUsername(username);
    if (!usernameValidation.isValid) {
      newErrors.username = usernameValidation.error!;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    console.log("Form submitted");
    setApiError("");

    if (!validateForm()) {
      console.log("Validation failed", errors);
      return;
    }

    setIsSubmitting(true);
    console.log("Calling API...");

    try {
      const response = await authApi.register({ email, password, username });
      console.log("Registration successful", response);
      login(response.token, response.user);
      router.push("/dashboard");
    } catch (error) {
      console.error("Registration error:", error);
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
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-text-muted focus:outline-none focus:border-accent-magenta/50 focus:bg-white/10 transition-all duration-300 font-code text-sm group-hover:border-white/20"
            placeholder="OPERATOR@PHANTOM.NET"
            disabled={isSubmitting}
          />
          <div className="absolute inset-0 rounded-lg bg-accent-magenta/5 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-300" />
        </div>
        {errors.email && <p className="text-xs text-accent-red font-bold tracking-wide animate-shake">{errors.email}</p>}
      </div>

      <div className="space-y-2">
        <label htmlFor="username" className="block text-xs font-bold text-text-secondary uppercase tracking-wider font-code">
          Codename
        </label>
        <div className="relative group">
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              if (errors.username) {
                setErrors({ ...errors, username: "" });
              }
            }}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-text-muted focus:outline-none focus:border-accent-magenta/50 focus:bg-white/10 transition-all duration-300 font-code text-sm group-hover:border-white/20"
            placeholder="PHANTOM_CODER"
            disabled={isSubmitting}
          />
          <div className="absolute inset-0 rounded-lg bg-accent-magenta/5 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-300" />
        </div>
        {errors.username && <p className="text-xs text-accent-red font-bold tracking-wide animate-shake">{errors.username}</p>}
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
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-text-muted focus:outline-none focus:border-accent-magenta/50 focus:bg-white/10 transition-all duration-300 font-code text-sm group-hover:border-white/20"
            placeholder="••••••••"
            disabled={isSubmitting}
          />
          <div className="absolute inset-0 rounded-lg bg-accent-magenta/5 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-300" />
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

      <button type="submit" disabled={isSubmitting} className="w-full px-6 py-4 bg-accent-magenta text-background-primary font-bold text-lg rounded-lg hover:bg-accent-magenta/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-[0_0_20px_rgba(255,0,60,0.3)] hover:shadow-[0_0_30px_rgba(255,0,60,0.5)] hover:-translate-y-0.5 uppercase tracking-widest relative overflow-hidden group">
        <span className="relative z-10">{isSubmitting ? "INITIALIZING..." : "INITIATE SEQUENCE"}</span>
        <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
      </button>
    </form>
  );
}
