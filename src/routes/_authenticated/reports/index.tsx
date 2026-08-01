import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchAnalyses } from "@/lib/analysis.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { scoreLabel } from "@/components/score-ring";

export const Route = createFileRoute("/_authenticated/reports/")({
  head: () => ({
    meta: [
      { title: "Reports — MatchScore" },
      { name: "description", content: "Every match report you've generated, with scores." },
      { property: "og:title", content: "Reports — MatchScore" },
      { property: "og:description", content: "Every match report you've generated." },
    ],
  }),
  component: ReportsPage,
});

function ReportsPage() {
  const analyses = useQuery({ queryKey: ["analyses"], queryFn: () => fetchAnalyses() });

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">
            Reports
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every analysis you've paid for, kept permanently.
          </p>
        </div>
        <Button asChild>
          <Link to="/analyze">New analysis</Link>
        </Button>
      </div>

      {analyses.isLoading ? (
        <Skeleton className="h-48 rounded-xl" />
      ) : (analyses.data ?? []).length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No reports yet.
        </p>
      ) : (
        <div className="space-y-3">
          {(analyses.data ?? []).map((row) => (
            <Card key={row.id} className="surface-panel lift-on-hover">
              <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">
                    {row.role_title ?? "Untitled role"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(row.created_at).toLocaleString()} · {row.product.replace("_", " ")}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  {row.status === "completed" ? (
                    <div className="text-right">
                      <p className="font-display text-2xl font-bold text-primary">
                        {row.overall_score ?? 0}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {scoreLabel(row.overall_score ?? 0)}
                      </p>
                    </div>
                  ) : (
                    <Badge variant={row.status === "failed" ? "destructive" : "outline"}>
                      {row.status}
                    </Badge>
                  )}
                  <Button asChild variant="outline" size="sm">
                    <Link to="/reports/$id" params={{ id: row.id }}>
                      Open
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
