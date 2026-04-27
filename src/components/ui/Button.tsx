"use client";

import { ButtonHTMLAttributes, forwardRef } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = "", variant = "primary", size = "md", children, ...props }, ref) => {
    const variants = {
      primary:
        "text-white bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 hover:brightness-110 focus:ring-indigo-400 shadow-[0_8px_24px_-8px_rgba(99,102,241,0.6)]",
      secondary: "bg-slate-900 text-white hover:bg-slate-800 focus:ring-slate-500",
      outline:
        "border border-slate-300 text-slate-700 bg-white hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/50 focus:ring-indigo-400",
      ghost: "text-slate-600 hover:bg-slate-100 focus:ring-slate-400",
    };

    const sizes = {
      sm: "px-3 py-1.5 text-sm",
      md: "px-4 py-2 text-sm",
      lg: "px-6 py-3 text-base",
    };

    return (
      <button
        ref={ref}
        className={`inline-flex items-center justify-center font-semibold rounded-xl tracking-tight transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
export default Button;
