import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BookOpen, ExternalLink, Hammer, Sparkles, TrendingUp } from "lucide-react";
import { fetchCoachPlan } from "@/lib/coach.functions";
import type { CoachPlan } from "@/lib/coach.server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/coach/$id")({
  head: () => ({
    meta: [
      { title: "Coaching plan — MatchScore" },
      {
        name: "description",
        content:
          "Your missing skills, free courses, practice projects and the score you reach once every gap is closed.",
      },
      { property: "og:title", content: "Coaching plan — MatchScore" },
      {
        property: "og:description",
        content: "Free courses, projects and your projected match score.",
      },
    ],
  }),
  component: CoachPlanDetail,
});

const PRIORITY_TONE: Record<string, string> = {
  critical: "border-destructive/40 bg-destructive/5",
  high: "border-primary/40 bg-primary/5",
  medium: "border-border",
  low: "border-border",
};

function CoachPlanDetail() {
  const { id } = Route.useParams();
  const query = useQuery({
    queryKey: ["coach-plan", id],
    queryFn: () => fetchCoachPlan({ data: { id } }),
  });

  if (query.isLoading) return <Skeleton className="h-96" />;
  if (query.isError || !query.data) {
    return <p className="text-sm text-muted-foreground">This plan could not be loaded.</p>;
  }

  const row = query.data;
  const plan = row.plan as unknown as CoachPlan;
  const gain = plan.projected_score - plan.current_score;

  return (
    <div className="space-y-8">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
          <Link to="/coach">
            <ArrowLeft className="size-4" />
            All plans
          </Link>
        </Button>
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">
          {plan.target_role}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Generated {new Date(row.created_at).toLocaleString()}
        </p>
      </div>

      <Card className="surface-panel">
        <CardContent className="grid gap-6 pt-6 md:grid-cols-[1fr_auto]">
          <div className="space-y-4">
            <div>
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-muted-foreground">Score today</span>
                <span className="font-display text-2xl font-bold text-foreground">
                  {plan.current_score}
                </span>
              </div>
              <Progress value={plan.current_score} className="mt-2" />
            </div>
            <div>
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-muted-foreground">
                  After finishing this plan
                </span>
                <span className="font-display text-2xl font-bold text-primary">
                  {plan.projected_score}
                </span>
              </div>
              <Progress value={plan.projected_score} className="mt-2" />
            </div>
            <p className="text-sm text-muted-foreground">{plan.readiness_summary}</p>
          </div>
          <div className="flex flex-col items-center justify-center rounded-xl bg-primary/5 px-8 py-6">
            <TrendingUp className="size-6 text-primary" />
            <p className="mt-2 font-display text-4xl font-bold text-primary">+{gain}</p>
            <p className="text-xs text-muted-foreground">points to gain</p>
          </div>
        </CardContent>
      </Card>

      {plan.strengths.length > 0 || plan.quick_wins.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2">
          <ListCard title="What already works" items={plan.strengths} />
          <ListCard title="Quick wins this week" items={plan.quick_wins} />
        </div>
      ) : null}

      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold text-foreground">Missing skills</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {plan.skill_gaps.map((gap) => (
            <div
              key={gap.skill}
              className={cn("rounded-xl border p-4", PRIORITY_TONE[gap.priority] ?? "border-border")}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium text-foreground">{gap.skill}</p>
                <Badge variant="outline" className="font-mono">
                  +{gap.score_gain}
                </Badge>
              </div>
              <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
                {gap.priority} priority · {gap.learn_in}
              </p>
              {gap.current_level ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  {gap.current_level} → {gap.target_level}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      {plan.free_courses.length > 0 ? (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 font-display text-xl font-semibold text-foreground">
            <BookOpen className="size-5 text-primary" />
            Free courses you can watch any time
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            {plan.free_courses.map((course) => (
              <Card key={course.title + course.provider} className="surface-panel">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{course.title}</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {course.provider} · {course.hours}h · {course.cost}
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-1.5">
                    {(course.covers ?? []).map((c) => (
                      <Badge key={c} variant="secondary">
                        {c}
                      </Badge>
                    ))}
                  </div>
                  {course.url ? (
                    <Button asChild variant="outline" size="sm">
                      <a href={course.url} target="_blank" rel="noopener noreferrer">
                        Open course
                        <ExternalLink className="size-3.5" />
                      </a>
                    </Button>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      {plan.practice_projects.length > 0 ? (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 font-display text-xl font-semibold text-foreground">
            <Hammer className="size-5 text-primary" />
            Projects to build
          </h2>
          <div className="space-y-3">
            {plan.practice_projects.map((project) => (
              <Card key={project.title} className="surface-panel">
                <CardHeader className="pb-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="text-base">{project.title}</CardTitle>
                    <Badge variant="secondary">
                      {project.difficulty} · {project.weeks} weeks
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <p className="text-muted-foreground">{project.description}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(project.skills ?? []).map((s) => (
                      <Badge key={s} variant="outline">
                        {s}
                      </Badge>
                    ))}
                  </div>
                  {project.resume_bullet ? (
                    <p className="rounded-lg bg-accent/10 p-3 text-sm text-foreground">
                      <span className="font-medium">Resume bullet: </span>
                      {project.resume_bullet}
                    </p>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      {plan.weekly_plan.length > 0 ? (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 font-display text-xl font-semibold text-foreground">
            <Sparkles className="size-5 text-primary" />
            Week by week
          </h2>
          <ol className="space-y-3">
            {plan.weekly_plan.map((week) => (
              <li key={week.week} className="flex gap-4 rounded-lg border border-border p-4">
                <span className="font-display text-lg font-bold text-primary">W{week.week}</span>
                <div>
                  <p className="text-sm font-medium text-foreground">{week.focus}</p>
                  <p className="text-xs text-muted-foreground">{week.outcome}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {plan.certifications.length > 0 ? (
        <ListCard title="Certifications worth adding" items={plan.certifications} />
      ) : null}
    </div>
  );
}

function ListCard({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <Card className="surface-panel">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-1.5 text-sm text-muted-foreground">
          {items.map((item) => (
            <li key={item} className="flex gap-2">
              <span className="text-primary">·</span>
              {item}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
