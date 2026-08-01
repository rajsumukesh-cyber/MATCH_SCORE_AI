import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, GraduationCap, Loader2, Trash2, TrendingUp } from "lucide-react";
import { fetchResumes } from "@/lib/resumes.functions";
import { fetchJobs } from "@/lib/jobs.functions";
import { createCoachPlan, fetchCoachPlans, removeCoachPlan } from "@/lib/coach.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/coach/")({
  head: () => ({
    meta: [
      { title: "AI skill gap coach — MatchScore" },
      {
        name: "description",
        content:
          "Find the skills you are missing for a target role, get free courses and practice projects, and see how much your match score would rise.",
      },
      { property: "og:title", content: "AI skill gap coach — MatchScore" },
      {
        property: "og:description",
        content: "Missing skills, free courses, projects and your projected score.",
      },
    ],
  }),
  component: CoachPage,
});

function CoachPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [resumeId, setResumeId] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [targetRole, setTargetRole] = useState("");

  const resumes = useQuery({ queryKey: ["resumes"], queryFn: () => fetchResumes() });
  const jobs = useQuery({ queryKey: ["jobs"], queryFn: () => fetchJobs() });
  const plans = useQuery({ queryKey: ["coach-plans"], queryFn: () => fetchCoachPlans() });

  const build = useMutation({
    mutationFn: async () => {
      if (!resumeId) throw new Error("Pick the resume to coach.");
      if (!jobId && !targetRole.trim()) throw new Error("Pick a saved role or type a target role.");
      return createCoachPlan({
        data: { resumeId, jobDescriptionId: jobId, targetRole: targetRole.trim() || null },
      });
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["coach-plans"] });
      toast.success("Coaching plan ready");
      navigate({ to: "/coach/$id", params: { id: result.id } });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const del = useMutation({
    mutationFn: (id: string) => removeCoachPlan({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coach-plans"] });
      toast.success("Plan deleted");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">
          AI skill gap coach
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          See exactly which skills are missing for your target role, which free courses close them,
          which projects to build, and how much your score rises once you do.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="surface-panel">
          <CardHeader>
            <CardTitle className="text-base">1 · Your resume</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {resumes.isLoading ? (
              <Skeleton className="h-24" />
            ) : (resumes.data ?? []).length === 0 ? (
              <Empty to="/resumes" label="Upload a resume first" />
            ) : (
              (resumes.data ?? []).map((resume) => (
                <PickRow
                  key={resume.id}
                  active={resumeId === resume.id}
                  title={resume.title}
                  subtitle={resume.candidate_name ?? `Version ${resume.version}`}
                  onClick={() => setResumeId(resume.id)}
                />
              ))
            )}
          </CardContent>
        </Card>

        <Card className="surface-panel">
          <CardHeader>
            <CardTitle className="text-base">2 · Target role</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(jobs.data ?? []).map((job) => (
              <PickRow
                key={job.id}
                active={jobId === job.id}
                title={job.title}
                subtitle={job.company ?? job.seniority ?? "Saved role"}
                onClick={() => setJobId(jobId === job.id ? null : job.id)}
              />
            ))}
            <div>
              <Label htmlFor="target-role" className="text-xs text-muted-foreground">
                Or type a role you are aiming for
              </Label>
              <Input
                id="target-role"
                className="mt-1.5"
                placeholder="e.g. Backend Engineer (Python, AWS)"
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <Button
        size="lg"
        disabled={build.isPending || !resumeId || (!jobId && !targetRole.trim())}
        onClick={() => build.mutate()}
      >
        {build.isPending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <GraduationCap className="size-4" />
        )}
        {build.isPending ? "Building your plan…" : "Build my coaching plan"}
      </Button>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold text-foreground">Your plans</h2>
        {plans.isLoading ? (
          <Skeleton className="h-28" />
        ) : (plans.data ?? []).length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No coaching plans yet.
          </p>
        ) : (
          <div className="space-y-2">
            {(plans.data ?? []).map((plan) => (
              <div
                key={plan.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border px-4 py-3"
              >
                <Link
                  to="/coach/$id"
                  params={{ id: plan.id }}
                  className="min-w-0 flex-1 hover:underline"
                >
                  <span className="block truncate text-sm font-medium text-foreground">
                    {plan.target_role}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {new Date(plan.created_at).toLocaleDateString()}
                  </span>
                </Link>
                <Badge variant="secondary" className="gap-1 font-mono">
                  <TrendingUp className="size-3" />
                  {plan.current_score} → {plan.projected_score}
                </Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => del.mutate(plan.id)}
                  aria-label="Delete plan"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function PickRow({
  active,
  title,
  subtitle,
  onClick,
}: {
  active: boolean;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left transition-colors",
        active ? "border-primary bg-primary/5" : "border-border hover:bg-accent/10",
      )}
    >
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-foreground">{title}</span>
        <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>
      </span>
      {active ? <Check className="size-4 shrink-0 text-primary" /> : null}
    </button>
  );
}

function Empty({ to, label }: { to: "/resumes" | "/jobs"; label: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border p-6 text-center">
      <p className="text-sm text-muted-foreground">{label}</p>
      <Button asChild size="sm" variant="outline" className="mt-3">
        <Link to={to}>Go there</Link>
      </Button>
    </div>
  );
}
