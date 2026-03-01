import type { CSSProperties } from 'react';

const light = {
  bg: "#f7f7f8", bgSubtle: "#f0f0f2", surface: "#ffffff",
  surfaceHover: "#fafafa", surfaceActive: "#f5f5f7",
  textPrimary: "#111827", textSecondary: "#4b5563",
  textTertiary: "#6b7280", textMuted: "#9ca3af",
  primary: "#2563eb", primaryHover: "#1d4ed8",
  primaryLight: "#eff6ff", primaryMedium: "#bfdbfe", primaryText: "#1e40af",
  success: "#059669", successLight: "#ecfdf5",
  successMedium: "#a7f3d0", successText: "#047857",
  warning: "#d97706", warningLight: "#fffbeb",
  warningMedium: "#fde68a", warningText: "#b45309",
  error: "#dc2626", errorLight: "#fef2f2",
  border: "#e5e7eb", borderLight: "#f3f4f6", borderFocus: "#2563eb",
  xs: "0 1px 2px rgba(0,0,0,0.04)",
  sm: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
  md: "0 4px 12px rgba(0,0,0,0.07)",
  lg: "0 12px 32px rgba(0,0,0,0.1)",
  glow: "0 0 0 3px rgba(37, 99, 235, 0.12)",
};

const dark = {
  bg: "#0e0f13", bgSubtle: "#16171d", surface: "#1c1d25",
  surfaceHover: "#22232d", surfaceActive: "#282934",
  textPrimary: "#e5e7eb", textSecondary: "#9ca3af",
  textTertiary: "#6b7280", textMuted: "#4b5563",
  primary: "#3b82f6", primaryHover: "#2563eb",
  primaryLight: "#172033", primaryMedium: "#1e3a5f", primaryText: "#93c5fd",
  success: "#34d399", successLight: "#0d2119",
  successMedium: "#065f46", successText: "#6ee7b7",
  warning: "#fbbf24", warningLight: "#231c0b",
  warningMedium: "#78350f", warningText: "#fcd34d",
  error: "#f87171", errorLight: "#2a1313",
  border: "#2a2b36", borderLight: "#1f2029", borderFocus: "#3b82f6",
  xs: "0 1px 2px rgba(0,0,0,0.3)",
  sm: "0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3)",
  md: "0 4px 12px rgba(0,0,0,0.4)",
  lg: "0 12px 32px rgba(0,0,0,0.5)",
  glow: "0 0 0 3px rgba(59, 130, 246, 0.25)",
};

export const T: typeof light = { ...light };

export function applyScheme(isDark: boolean) {
  Object.assign(T, isDark ? dark : light);
}

export const font = `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
export const fontMono = `'JetBrains Mono', 'SF Mono', 'Fira Code', monospace`;

export function pageBase(): CSSProperties {
  return {
    minHeight: "100vh", background: T.bg, fontFamily: font, color: T.textPrimary,
    WebkitFontSmoothing: "antialiased",
  };
}

export function card(): CSSProperties {
  return {
    background: T.surface, borderRadius: 12,
    border: `1px solid ${T.border}`, boxShadow: T.xs, overflow: "hidden",
  };
}

export function container(mob: boolean): CSSProperties {
  return { maxWidth: 700, margin: "0 auto", padding: mob ? "16px 14px 120px" : "24px 20px 120px" };
}

export function anim(fade: boolean, delay = 0): CSSProperties {
  return {
    opacity: fade ? 1 : 0,
    transform: fade ? "translateY(0)" : "translateY(8px)",
    transition: `all .4s cubic-bezier(.16,1,.3,1) ${delay}s`,
  };
}

export const globalCSS = `
  @keyframes sd{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
  @keyframes su{from{opacity:0;transform:translateY(100%)}to{opacity:1;transform:translateY(0)}}
  @keyframes fi{from{opacity:0}to{opacity:1}}
  @keyframes si{from{opacity:0;transform:scale(.97)}to{opacity:1;transform:scale(1)}}
  *,*::before,*::after{box-sizing:border-box}
  body{margin:0;-webkit-text-size-adjust:100%}
  button{-webkit-tap-highlight-color:transparent}
`;
