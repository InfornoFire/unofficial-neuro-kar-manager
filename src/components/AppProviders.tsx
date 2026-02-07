import type { PropsWithChildren } from "react";
import { TouchProvider } from "@/components/ui/hybrid-tooltip";
import { TooltipProvider } from "@/components/ui/tooltip";

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <TouchProvider>
      <TooltipProvider>{children}</TooltipProvider>
    </TouchProvider>
  );
}
