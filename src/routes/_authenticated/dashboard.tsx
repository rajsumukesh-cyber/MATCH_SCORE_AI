import { formatInr } from "@/lib/currency";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, FileText, Briefcase, Sparkles, Wallet } from "lucide-react";
import { fetchAnalyses, fetchDashboardStats } from "@/lib/analysis.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScoreBar, scoreLabel } from "@/components/score-ring";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — MatchScore" },
      { name: "description", content: "Track your resume match scores, spend and progress." },
      { property: "og:title", content: "Dashboard — MatchScore" },
      { property: "og:description", content: "Track your resume match scores and progress." },
    ],
  }),
  component: DashboardPage,
});

function Stat({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ElementType;
}) {
  return (
    <Card className="surface-panel">
      <CardContent className="flex items-start justify-between gap-3 p-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <p className="mt-2 font-display text-3xl font-bold text-foreground">{value}</p>
          {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
        </div>
        <span className="rounded-lg bg-primary/10 p-2 text-primary">
          <Icon className="size-4" />
        </span>
      </CardContent>
    </Card>
  );
}

function DashboardPage() {
  const stats = useQuery({ queryKey: ["dashboard-stats"], queryFn: () => fetchDashboardStats() });
  const analyses = useQuery({ queryKey: ["analyses"], queryFn: () => fetchAnalyses() });

  const s = stats.data;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your match performance across every role you've targeted.
          </p>
        </div>
        <Button asChild>
          <Link to="/analyze">
            <Sparkles className="size-4" />
            New analysis
          </Link>
        </Button>
      </div>

      {stats.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Analyses"
            value={String(s?.totalAnalyses ?? 0)}
            hint={`${s?.resumeCount ?? 0} resumes · ${s?.jobCount ?? 0} roles`}
            icon={Sparkles}
          />
          <Stat
            label="Average score"
            value={`${s?.averageScore ?? 0}`}
            hint={s?.averageScore ? scoreLabel(s.averageScore) : "No completed runs yet"}
            icon={FileText}
          />
          <Stat label="Best score" value={`${s?.bestScore ?? 0}`} icon={Briefcase} />
          <Stat
            label="Total spent"
            value={formatInr(s?.totalSpentUsd ?? 0)}
            hint="USDC via x402"
            icon={Wallet}
          />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="surface-panel lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Category averages</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {s ? (
              <>
                <ScoreBar label="Skills" value={s.categoryAverages.skills} />
                <ScoreBar label="Experience" value={s.categoryAverages.experience} />
                <ScoreBar label="Education" value={s.categoryAverages.education} />
                <ScoreBar label="Certifications" value={s.categoryAverages.certifications} />
                <ScoreBar label="Keywords" value={s.categoryAverages.keywords} />
              </>
            ) : (
              <Skeleton className="h-40" />
            )}
          </CardContent>
        </Card>

        <Card className="surface-panel lg:col-span-3">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Recent reports</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link to="/reports">
                View all <ArrowUpRight className="size-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {analyses.isLoading ? (
              <Skeleton className="h-40" />
            ) : (analyses.data ?? []).length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-8 text-center">
                <p className="text-sm text-muted-foreground">
                  No analyses yet. Upload a resume and score it against a role.
                </p>
                <Button asChild className="mt-4" size="sm">
                  <Link to="/analyze">Run your first analysis</Link>
                </Button>
              </div>
            ) : (
              (analyses.data ?? []).slice(0, 6).map((row) => (
                <Link
                  key={row.id}
                  to="/reports/$id"
                  params={{ id: row.id }}
                  className="flex items-center justify-between gap-4 rounded-lg border border-border px-4 py-3 transition-colors hover:bg-accent/10"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {row.role_title ?? "Untitled role"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(row.created_at).toLocaleDateString()} ·{" "}
                      {row.product.replace("_", " ")}
                    </p>
                  </div>
                  {row.status === "completed" ? (
                    <span className="font-display text-xl font-bold text-primary">
                      {row.overall_score ?? 0}
                    </span>
                  ) : (
                    <Badge variant="outline">{row.status}</Badge>
                  )}
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
