import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Download } from "lucide-react";
import { fetchAnalysis } from "@/lib/analysis.functions";
import type { MatchReport } from "@/lib/analysis.server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { ScoreBar, ScoreRing, scoreLabel } from "@/components/score-ring";

export const Route = createFileRoute("/_authenticated/reports/$id")({
  head: () => ({
    meta: [
      { title: "Match report — MatchScore" },
      { name: "description", content: "Explainable resume-to-role match report." },
      { property: "og:title", content: "Match report — MatchScore" },
      { property: "og:description", content: "Explainable resume-to-role match report." },
    ],
  }),
  component: ReportPage,
});

function List({ title, items }: { title: string; items?: string[] }) {
  if (!items?.length) return null;
  return (
    <div>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <ul className="mt-2 space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2 text-sm text-muted-foreground">
            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Chips({ title, items }: { title: string; items?: string[] }) {
  if (!items?.length) return null;
  return (
    <div>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {items.map((item) => (
          <Badge key={item} variant="secondary" className="font-normal">
            {item}
          </Badge>
        ))}
      </div>
    </div>
  );
}

function ReportPage() {
  const { id } = Route.useParams();
  const query = useQuery({ queryKey: ["analysis", id], queryFn: () => fetchAnalysis({ data: { id } }) });

  if (query.isLoading) return <Skeleton className="h-96 rounded-xl" />;
  if (query.error || !query.data) {
    return (
      <p className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        We couldn't load that report.
      </p>
    );
  }

  const row = query.data;
  const report = (row.report ?? {}) as unknown as MatchReport;

  function download() {
    const blob = new Blob([JSON.stringify({ ...row, report }, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `matchscore-report-${id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (row.status !== "completed") {
    return (
      <div className="space-y-4">
        <Button asChild variant="ghost" size="sm">
          <Link to="/reports">
            <ArrowLeft className="size-4" /> Back to reports
          </Link>
        </Button>
        <Card className="surface-panel">
          <CardContent className="p-8 text-center">
            <Badge variant={row.status === "failed" ? "destructive" : "outline"}>
              {row.status}
            </Badge>
            <p className="mt-3 text-sm text-muted-foreground">
              {row.error_message ?? "This analysis has not finished."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/reports">
            <ArrowLeft className="size-4" /> Back to reports
          </Link>
        </Button>
        <Button variant="outline" size="sm" onClick={download}>
          <Download className="size-4" /> Export JSON
        </Button>
      </div>

      <Card className="surface-panel overflow-hidden">
        <CardContent className="flex flex-col items-center gap-8 p-8 md:flex-row md:items-start">
          <ScoreRing score={report.overall_score ?? 0} />
          <div className="flex-1 space-y-4 text-center md:text-left">
            <div>
              <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                {row.role_title ?? "Role"}
              </p>
              <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-foreground">
                {scoreLabel(report.overall_score ?? 0)}
              </h1>
            </div>
            <p className="text-sm text-muted-foreground">{report.score_explanation}</p>
            <div className="flex flex-wrap justify-center gap-2 md:justify-start">
              <Badge variant="outline">ATS {report.ats_score ?? 0}/100</Badge>
              <Badge variant="outline">{report.hiring_likelihood} hiring likelihood</Badge>
              {row.semantic_similarity != null ? (
                <Badge variant="outline">
                  Semantic {Math.round(Number(row.semantic_similarity) * 100)}%
                </Badge>
              ) : null}
              <Badge variant="secondary">{String(row.product).replace("_", " ")}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="surface-panel">
          <CardHeader>
            <CardTitle className="text-base">Category breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ScoreBar label="Skills" value={report.category_scores?.skills ?? 0} />
            <ScoreBar label="Experience" value={report.category_scores?.experience ?? 0} />
            <ScoreBar label="Education" value={report.category_scores?.education ?? 0} />
            <ScoreBar
              label="Certifications"
              value={report.category_scores?.certifications ?? 0}
            />
            <ScoreBar label="Keywords" value={report.category_scores?.keywords ?? 0} />
          </CardContent>
        </Card>

        <Card className="surface-panel lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <p className="text-sm text-muted-foreground">{report.summary}</p>
            <Separator />
            <div className="grid gap-5 sm:grid-cols-2">
              <List title="Strengths" items={report.strengths} />
              <List title="Weaknesses" items={report.weaknesses} />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="surface-panel">
          <CardHeader>
            <CardTitle className="text-base">Gaps</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <Chips title="Missing technical skills" items={report.missing_technical_skills} />
            <Chips title="Missing soft skills" items={report.missing_soft_skills} />
            <Chips title="Missing technologies" items={report.missing_technologies} />
            <Chips title="Keyword gaps" items={report.keyword_gaps} />
          </CardContent>
        </Card>

        <Card className="surface-panel">
          <CardHeader>
            <CardTitle className="text-base">What to do next</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <List title="Recommendations" items={report.improvement_recommendations} />
            <Chips title="Suggested keywords" items={report.suggested_keywords} />
            <List title="Recommended certifications" items={report.recommended_certifications} />
            <List title="Suggested projects" items={report.suggested_projects} />
          </CardContent>
        </Card>
      </div>

      {report.better_bullet_points?.length ? (
        <Card className="surface-panel">
          <CardHeader>
            <CardTitle className="text-base">Rewritten bullet points</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {report.better_bullet_points.map((pair, i) => (
              <div key={i} className="rounded-lg border border-border p-4">
                <p className="text-sm text-muted-foreground line-through">{pair.original}</p>
                <p className="mt-2 text-sm font-medium text-foreground">{pair.improved}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {report.summary_rewrite || report.ats_optimization_tips?.length ? (
        <Card className="surface-panel">
          <CardHeader>
            <CardTitle className="text-base">ATS optimization</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {report.summary_rewrite ? (
              <div>
                <h3 className="text-sm font-semibold text-foreground">Suggested summary</h3>
                <p className="mt-2 rounded-lg bg-muted/60 p-4 text-sm text-muted-foreground">
                  {report.summary_rewrite}
                </p>
              </div>
            ) : null}
            <List title="Tips" items={report.ats_optimization_tips} />
            {report.optimization_checklist?.length ? (
              <div>
                <h3 className="text-sm font-semibold text-foreground">Checklist</h3>
                <ul className="mt-2 space-y-1.5">
                  {report.optimization_checklist.map((entry, i) => (
                    <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                      <span
                        className={
                          entry.done
                            ? "mt-1 size-3.5 shrink-0 rounded-sm bg-success"
                            : "mt-1 size-3.5 shrink-0 rounded-sm border border-border"
                        }
                      />
                      {entry.item}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
