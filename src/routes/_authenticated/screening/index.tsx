import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Check,
  CircleAlert,
  Loader2,
  RotateCcw,
  ShieldCheck,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { fetchResumes } from "@/lib/resumes.functions";
import { fetchJobs } from "@/lib/jobs.functions";
import { fetchScreenings, removeScreening } from "@/lib/screening.functions";
import { useScreeningQueue } from "@/hooks/use-screening-queue";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/screening/")({
  head: () => ({
    meta: [
      { title: "Explainable recruiter — MatchScore" },
      {
        name: "description",
        content:
          "Shortlist a batch of candidates against one role with a cutoff percentage, bias-safe scoring and study topics for everyone below the line.",
      },
      { property: "og:title", content: "Explainable recruiter — MatchScore" },
      {
        property: "og:description",
        content: "Batch shortlist candidates with an explainable cutoff and fairness checks.",
      },
    ],
  }),
  component: ScreeningPage,
});

function ScreeningPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [jobId, setJobId] = useState<string | null>(null);
  const [resumeIds, setResumeIds] = useState<string[]>([]);
  const [cutoff, setCutoff] = useState(70);
  const [anonymize, setAnonymize] = useState(true);

  const resumes = useQuery({ queryKey: ["resumes"], queryFn: () => fetchResumes() });
  const jobs = useQuery({ queryKey: ["jobs"], queryFn: () => fetchJobs() });
  const runs = useQuery({ queryKey: ["screenings"], queryFn: () => fetchScreenings() });

  const queue = useScreeningQueue();

  async function startRun() {
    if (!jobId) return toast.error("Pick the role you are screening for.");
    if (resumeIds.length === 0) return toast.error("Select at least one candidate resume.");
    const selected = (resumes.data ?? [])
      .filter((r) => resumeIds.includes(r.id))
      .map((r) => ({ id: r.id, title: r.candidate_name ?? r.title }));
    const runId = await queue.start({
      jobDescriptionId: jobId,
      cutoff,
      anonymize,
      resumes: selected,
    });
    queryClient.invalidateQueries({ queryKey: ["screenings"] });
    if (runId) toast.success("Batch finished");
  }

  const del = useMutation({
    mutationFn: (id: string) => removeScreening({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["screenings"] });
      toast.success("Screening run deleted");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function toggleResume(id: string) {
    setResumeIds((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]));
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">
          AI explainable recruiter
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Screen a batch of candidates against one role. Everyone at or above your cutoff is
          shortlisted; everyone below gets the exact topics they still need to study.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="surface-panel">
          <CardHeader>
            <CardTitle className="text-base">1 · Role to screen for</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {jobs.isLoading ? (
              <Skeleton className="h-24" />
            ) : (jobs.data ?? []).length === 0 ? (
              <Empty to="/jobs" label="Add a job description first" />
            ) : (
              (jobs.data ?? []).map((job) => (
                <PickRow
                  key={job.id}
                  active={jobId === job.id}
                  title={job.title}
                  subtitle={job.company ?? job.seniority ?? "Saved role"}
                  onClick={() => setJobId(job.id)}
                />
              ))
            )}
          </CardContent>
        </Card>

        <Card className="surface-panel">
          <CardHeader>
            <CardTitle className="text-base">
              2 · Candidates{" "}
              {resumeIds.length > 0 ? (
                <Badge variant="secondary" className="ml-1">
                  {resumeIds.length} selected
                </Badge>
              ) : null}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {resumes.isLoading ? (
              <Skeleton className="h-24" />
            ) : (resumes.data ?? []).length === 0 ? (
              <Empty to="/resumes" label="Upload candidate resumes first" />
            ) : (
              (resumes.data ?? []).map((resume) => (
                <PickRow
                  key={resume.id}
                  active={resumeIds.includes(resume.id)}
                  title={resume.title}
                  subtitle={resume.candidate_name ?? `Version ${resume.version}`}
                  onClick={() => toggleResume(resume.id)}
                />
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="surface-panel">
        <CardHeader>
          <CardTitle className="text-base">3 · Cutoff and fairness</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <div className="flex items-baseline justify-between">
              <Label>Required cutoff percentage</Label>
              <span className="font-display text-2xl font-bold text-foreground">{cutoff}%</span>
            </div>
            <Slider
              className="mt-3"
              value={[cutoff]}
              min={30}
              max={95}
              step={1}
              onValueChange={(v) => setCutoff(v[0] ?? 70)}
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Candidates scoring {cutoff}% or higher are shortlisted on the selected side.
            </p>
          </div>

          <div className="flex items-start justify-between gap-4 rounded-lg border border-border p-4">
            <div>
              <Label htmlFor="anonymize" className="text-sm font-medium">
                Bias-safe anonymous screening
              </Label>
              <p className="mt-1 text-xs text-muted-foreground">
                Names, contact details, age, gender, nationality, marital status and photos are
                stripped before anything reaches the model. Scoring uses experience and topics only.
              </p>
            </div>
            <Switch id="anonymize" checked={anonymize} onCheckedChange={setAnonymize} />
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-4">
        <Button
          size="lg"
          disabled={queue.running || !jobId || resumeIds.length === 0}
          onClick={() => void startRun()}
        >
          {queue.running ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Users className="size-4" />
          )}
          {queue.running ? "Screening candidates…" : "Queue screening batch"}
        </Button>
        {queue.running ? (
          <Button size="lg" variant="outline" onClick={queue.cancel}>
            <X className="size-4" />
            Stop after current
          </Button>
        ) : null}
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5" />
          Every decision is explained with quoted evidence from the resume.
        </p>
      </div>

      {queue.total > 0 ? (
        <Card className="surface-panel">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">
              Batch queue{" "}
              <Badge variant="secondary" className="ml-1">
                {queue.done + queue.failed}/{queue.total}
              </Badge>
            </CardTitle>
            <div className="flex items-center gap-2">
              {queue.failed > 0 && !queue.running ? (
                <Button size="sm" variant="outline" onClick={() => void queue.retryFailed()}>
                  <RotateCcw className="size-4" />
                  Retry {queue.failed} failed
                </Button>
              ) : null}
              {queue.finished && queue.screeningId ? (
                <Button
                  size="sm"
                  onClick={() =>
                    navigate({ to: "/screening/$id", params: { id: queue.screeningId! } })
                  }
                >
                  View results
                </Button>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Progress value={queue.progress} />
              <p className="mt-2 text-xs text-muted-foreground">
                {queue.done} scored · {queue.failed} failed ·{" "}
                {queue.total - queue.done - queue.failed} remaining · up to 2 candidates processed
                in parallel with automatic retries.
              </p>
            </div>
            <div className="space-y-2">
              {queue.items.map((item) => (
                <div
                  key={item.resumeId}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border px-4 py-2.5"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {item.title}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {item.status === "failed"
                        ? (item.error ?? "Scoring failed.")
                        : item.status === "running"
                          ? `Scoring… attempt ${item.attempts}`
                          : item.status === "done"
                            ? item.selected
                              ? "Shortlisted"
                              : "Below cutoff"
                            : item.status === "cancelled"
                              ? "Cancelled"
                              : "Waiting in queue"}
                    </span>
                  </span>
                  <div className="flex shrink-0 items-center gap-2">
                    {item.status === "done" ? (
                      <Badge variant={item.selected ? "default" : "secondary"}>
                        {item.score}%
                      </Badge>
                    ) : item.status === "running" ? (
                      <Loader2 className="size-4 animate-spin text-muted-foreground" />
                    ) : item.status === "failed" ? (
                      <>
                        <CircleAlert className="size-4 text-destructive" />
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => void queue.retryOne(item.resumeId)}
                        >
                          <RotateCcw className="size-4" />
                          Retry
                        </Button>
                      </>
                    ) : (
                      <Badge variant="outline">{item.status}</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold text-foreground">Past screening runs</h2>
        {runs.isLoading ? (
          <Skeleton className="h-28" />
        ) : (runs.data ?? []).length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No screening runs yet.
          </p>
        ) : (
          <div className="space-y-2">
            {(runs.data ?? []).map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border px-4 py-3"
              >
                <Link
                  to="/screening/$id"
                  params={{ id: item.id }}
                  className="min-w-0 flex-1 hover:underline"
                >
                  <span className="block truncate text-sm font-medium text-foreground">
                    {item.title}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {item.selected_count}/{item.candidate_count} shortlisted · cutoff {item.cutoff}%
                    · {new Date(item.created_at).toLocaleDateString()}
                  </span>
                </Link>
                {item.anonymize ? <Badge variant="secondary">Anonymous</Badge> : null}
                <Badge variant={item.status === "completed" ? "default" : "destructive"}>
                  {item.status}
                </Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => del.mutate(item.id)}
                  aria-label="Delete screening run"
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
