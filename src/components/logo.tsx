import { Target } from "lucide-react";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span className="signal-gradient flex size-8 items-center justify-center rounded-lg text-primary-foreground">
        <Target className="size-4" />
      </span>
      <span className="font-display text-lg font-bold tracking-tight text-foreground">
        Match<span className="text-primary">Score</span>
      </span>
    </span>
  );
}
