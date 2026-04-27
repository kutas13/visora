import { HTMLAttributes, forwardRef } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "bordered" | "elevated";
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className = "", variant = "default", children, ...props }, ref) => {
    const variants = {
      default:
        "bg-white/85 backdrop-blur-md border border-slate-200/70 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(79,70,229,0.18)]",
      bordered: "bg-white border border-slate-200",
      elevated:
        "bg-white border border-slate-200/70 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_20px_50px_-20px_rgba(79,70,229,0.30)]",
    };

    return (
      <div ref={ref} className={`rounded-2xl ${variants[variant]} ${className}`} {...props}>
        {children}
      </div>
    );
  }
);

Card.displayName = "Card";
export default Card;
