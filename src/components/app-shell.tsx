import { useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  BarChart3,
  FileText,
  Briefcase,
  Sparkles,
  Receipt,
  ShieldCheck,
  Users,
  GraduationCap,
  LogOut,
  Menu,
  X,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/logo";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { to: "/analyze", label: "New analysis", icon: Sparkles },
  { to: "/screening", label: "Recruiter screening", icon: Users },
  { to: "/coach", label: "Skill gap coach", icon: GraduationCap },
  { to: "/resumes", label: "Resumes", icon: FileText },
  { to: "/jobs", label: "Job roles", icon: Briefcase },
  { to: "/reports", label: "Reports", icon: BarChart3 },
  { to: "/billing", label: "Billing", icon: Receipt },
  { to: "/admin", label: "Admin", icon: ShieldCheck },
] as const;


export function AppShell({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const nav = (
    <nav className="flex flex-col gap-1">
      {NAV.map((item) => {
        const active = pathname.startsWith(item.to);
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={() => setOpen(false)}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
            )}
          >
            <item.icon className="size-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar px-4 py-5 lg:flex">
        <Link to="/dashboard" className="mb-7 px-2">
          <Logo />
        </Link>
        {nav}
        <div className="mt-auto">
          <Button variant="ghost" className="w-full justify-start gap-3" onClick={signOut}>
            <LogOut className="size-4" />
            Sign out
          </Button>
        </div>
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/85 px-4 py-3 backdrop-blur lg:hidden">
        <Link to="/dashboard">
          <Logo />
        </Link>
        <Button variant="ghost" size="icon" onClick={() => setOpen((v) => !v)}>
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </Button>
      </header>

      {open ? (
        <div className="sticky top-14 z-30 border-b border-border bg-sidebar px-4 py-3 lg:hidden">
          {nav}
          <Button variant="ghost" className="mt-2 w-full justify-start gap-3" onClick={signOut}>
            <LogOut className="size-4" />
            Sign out
          </Button>
        </div>
      ) : null}

      <main className="lg:pl-64">
        <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-10">{children}</div>
      </main>
    </div>
  );
}
