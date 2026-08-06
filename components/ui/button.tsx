import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tbc-red/20 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-tbc-red text-white hover:bg-tbc-red-hover",
        destructive:
          "border border-tbc-red/30 bg-transparent text-tbc-red hover:bg-tbc-red-light",
        outline:
          "border border-[#E5E7EB] bg-white text-tbc-red hover:bg-tbc-red-light hover:border-tbc-red/40 dark:border-[#2a2a2a] dark:bg-transparent dark:hover:bg-[#1f1f1f]",
        secondary:
          "border border-[#E5E7EB] bg-white text-[#111111] hover:bg-[#F3F4F6] dark:border-[#2a2a2a] dark:bg-[#161616] dark:text-white dark:hover:bg-[#1f1f1f]",
        ghost:
          "text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111111] dark:hover:bg-[#1f1f1f] dark:hover:text-white",
        link: "text-tbc-red underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-xl px-3",
        lg: "h-11 rounded-xl px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
