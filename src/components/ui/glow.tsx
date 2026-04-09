import React from "react";
import { cn } from "../../lib/utils";
import { cva, VariantProps } from "class-variance-authority";

const glowVariants = cva("absolute w-full pointer-events-none", {
  variants: {
    variant: {
      top: "top-0",
      above: "-top-[128px]",
      bottom: "bottom-0",
      below: "-bottom-[128px]",
      center: "top-[50%]",
    },
  },
  defaultVariants: { variant: "top" },
});

const Glow = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof glowVariants>
>(({ className, variant, ...props }, ref) => (
  <div ref={ref} className={cn(glowVariants({ variant }), className)} {...props}>
    {/* Outer glow — verde lima difuso */}
    <div
      className={cn(
        "absolute left-1/2 h-[256px] w-[70%] -translate-x-1/2 scale-[2.5] rounded-[50%] sm:h-[512px]",
        variant === "center" && "-translate-y-1/2",
      )}
      style={{
        background:
          "radial-gradient(ellipse at center, rgba(148,163,184,0.22) 10%, rgba(148,163,184,0) 65%)",
      }}
    />
    {/* Inner glow — cinza mais suave */}
    <div
      className={cn(
        "absolute left-1/2 h-[128px] w-[40%] -translate-x-1/2 scale-[2] rounded-[50%] sm:h-[256px]",
        variant === "center" && "-translate-y-1/2",
      )}
      style={{
        background:
          "radial-gradient(ellipse at center, rgba(203,213,225,0.18) 10%, rgba(148,163,184,0) 60%)",
      }}
    />
  </div>
));
Glow.displayName = "Glow";

export { Glow };
