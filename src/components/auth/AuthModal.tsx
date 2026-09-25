"use client";

import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { isConfigured, signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGoogleLogin = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);
    try {
      const { error } = await signInWithGoogle();
      if (error) {
        setErrorMsg(error.message || "Failed to initiate Google sign in.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg("Please enter both email and password.");
      return;
    }

    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      if (mode === "signin") {
        const { error } = await signInWithEmail(email, password);
        if (error) {
          setErrorMsg(error.message || "Invalid credentials.");
        } else {
          setSuccessMsg("Signed in successfully!");
          setTimeout(() => {
            onClose();
          }, 800);
        }
      } else {
        const { error } = await signUpWithEmail(email, password);
        if (error) {
          setErrorMsg(error.message || "Registration failed.");
        } else {
          setSuccessMsg("Account created! Check your email inbox to verify your account.");
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-[fadeIn_0.2s_ease-out]">
      <div
        className="w-full max-w-md bg-[#0D111A] border border-slate-700/60 rounded-xl shadow-2xl overflow-hidden relative flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top telemetry accent stripe */}
        <div className="h-1 w-full bg-gradient-to-r from-blue-500 via-cyan-400 to-emerald-400"></div>

        {/* Modal Header */}
        <div className="px-6 pt-5 pb-4 flex items-start justify-between border-b border-slate-800/80">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded font-semibold">
                Telemetry Credentials
              </span>
              <span className="text-[11px] font-mono text-slate-500">ApexWall Auth</span>
            </div>
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#38BDF8" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <span>{mode === "signin" ? "Driver Sign In" : "Register Driver Account"}</span>
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
            title="Close modal"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tab switchers */}
        <div className="flex border-b border-slate-800/80 bg-slate-900/40 p-1">
          <button
            type="button"
            onClick={() => {
              setMode("signin");
              setErrorMsg(null);
              setSuccessMsg(null);
            }}
            className={`flex-1 py-2 text-xs font-semibold rounded-md transition-all font-mono ${
              mode === "signin"
                ? "bg-slate-800 text-cyan-400 shadow-sm border border-slate-700/50"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            SIGN IN
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("signup");
              setErrorMsg(null);
              setSuccessMsg(null);
            }}
            className={`flex-1 py-2 text-xs font-semibold rounded-md transition-all font-mono ${
              mode === "signup"
                ? "bg-slate-800 text-cyan-400 shadow-sm border border-slate-700/50"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            CREATE ACCOUNT
          </button>
        </div>

        {/* Body content */}
        <div className="p-6 space-y-4">
          {/* Missing Configuration Notice */}
          {!isConfigured && (
            <div className="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs leading-relaxed">
              <div className="font-semibold flex items-center gap-1.5 mb-1 text-amber-200">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4m0 4h.01" />
                </svg>
                <span>Supabase Setup Required</span>
              </div>
              Add <code className="bg-black/40 px-1 py-0.5 rounded font-mono text-[11px]">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
              <code className="bg-black/40 px-1 py-0.5 rounded font-mono text-[11px]">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to your environment variables to activate live cloud authentication.
            </div>
          )}

          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs">
              {successMsg}
            </div>
          )}

          {/* Primary Action: Google Login */}
          <button
            type="button"
            disabled={loading}
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-lg bg-white hover:bg-slate-100 text-slate-900 font-medium text-sm transition-all duration-150 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed group"
          >
            {/* Google SVG Logo */}
            <svg viewBox="0 0 24 24" width="18" height="18">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span className="font-semibold tracking-tight">
              {mode === "signin" ? "Continue with Google" : "Sign up with Google"}
            </span>
          </button>

          {/* Divider */}
          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-slate-800"></div>
            <span className="flex-shrink mx-3 text-[11px] font-mono text-slate-500 uppercase tracking-wider">
              Or with credentials
            </span>
            <div className="flex-grow border-t border-slate-800"></div>
          </div>

          {/* Email / Password Form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
                Driver Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="driver@apexwall.ai"
                className="w-full px-3 py-2 bg-slate-900/90 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400 font-sans transition-colors"
              />
            </div>

            <div>
              <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full px-3 py-2 bg-slate-900/90 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400 font-sans transition-colors pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 text-xs"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 mt-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs tracking-wider uppercase font-mono transition-all duration-150 shadow-md shadow-blue-600/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading && (
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              )}
              <span>{mode === "signin" ? "Sign In to ApexWall" : "Complete Registration"}</span>
            </button>
          </form>
        </div>

        {/* Footer info */}
        <div className="px-6 py-3 bg-slate-950/60 border-t border-slate-800/80 text-[11px] text-slate-500 text-center font-mono">
          Cloud telemetry encryption & vault persistence enabled.
        </div>
      </div>
    </div>
  );
};
