import React from "react";
import { cn } from "../../lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

const mockupVariants = cva(
  "flex flex-col relative z-10 overflow-hidden shadow-2xl border border-slate-200/60 border-t-slate-200",
  {
    variants: {
      type: {
        mobile: "rounded-[48px] max-w-[350px]",
        responsive: "rounded-2xl",
      },
    },
    defaultVariants: { type: "responsive" },
  },
);

export interface MockupProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof mockupVariants> {}

const Mockup = React.forwardRef<HTMLDivElement, MockupProps>(
  ({ className, type, ...props }, ref) => (
    <div ref={ref} className={cn(mockupVariants({ type, className }))} {...props} />
  ),
);
Mockup.displayName = "Mockup";

const MockupFrame = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("bg-slate-50/50 flex relative z-10 overflow-hidden rounded-2xl p-2", className)}
    {...props}
  />
));
MockupFrame.displayName = "MockupFrame";

export { Mockup, MockupFrame };
