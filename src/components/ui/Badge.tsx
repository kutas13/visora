interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "error" | "info" | "purple";
  size?: "sm" | "md";
  className?: string;
  dot?: boolean;
}

const DOT_COLORS: Record<string, string> = {
  default: "bg-navy-400",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  error: "bg-red-500",
  info: "bg-blue-500",
  purple: "bg-violet-500",
};

export default function Badge({ children, variant = "default", size = "sm", className = "", dot = true }: BadgeProps) {
  const variants = {
    default: "bg-slate-50 text-slate-700 border-slate-200/80 shadow-slate-100",
    success: "bg-emerald-50 text-emerald-700 border-emerald-200/80 shadow-emerald-100",
    warning: "bg-amber-50 text-amber-700 border-amber-200/80 shadow-amber-100",
    error: "bg-red-50 text-red-700 border-red-200/80 shadow-red-100",
    info: "bg-blue-50 text-blue-700 border-blue-200/80 shadow-blue-100",
    purple: "bg-violet-50 text-violet-700 border-violet-200/80 shadow-violet-100",
  };

  const sizes = {
    sm: "px-2.5 py-0.5 text-[11px]",
    md: "px-3 py-1 text-xs",
  };

  return (
    <span className={`inline-flex items-center gap-1.5 font-semibold rounded-md border shadow-sm tracking-wide ${variants[variant]} ${sizes[size]} ${className}`}>
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${DOT_COLORS[variant]} flex-shrink-0`} />}
      {children}
    </span>
  );
}
