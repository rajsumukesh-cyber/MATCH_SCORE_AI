import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Briefcase, Loader2, Trash2 } from "lucide-react";
import { fetchJobs, removeJob, upsertJob } from "@/lib/jobs.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/jobs")({
  head: () => ({
    meta: [
      { title: "Job roles — MatchScore" },
      { name: "description", content: "Save job descriptions and extract their requirements." },
      { property: "og:title", content: "Job roles — MatchScore" },
      {
        property: "og:description",
        content: "Save job descriptions and extract their requirements.",
      },
    ],
  }),
  component: JobsPage,
});

interface ParsedJobPreview {
  required_skills?: string[];
  min_years_experience?: number;
}

function JobsPage() {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [content, setContent] = useState("");

  const jobs = useQuery({ queryKey: ["jobs"], queryFn: () => fetchJobs() });

  const save = useMutation({
    mutationFn: () => upsertJob({ data: { title, company: company || null, content } }),
    onSuccess: () => {
      toast.success("Job description saved and analyzed.");
      setTitle("");
      setCompany("");
      setContent("");
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const destroy = useMutation({
    mutationFn: (id: string) => removeJob({ data: { id } }),
    onSuccess: () => {
      toast.success("Job description deleted.");
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">
          Job roles
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Paste a job description — we extract requirements, seniority and ATS keywords.
        </p>
      </div>

      <Card className="surface-panel">
        <CardHeader>
          <CardTitle className="text-base">Add a job description</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="job-title">Role title (optional)</Label>
              <Input
                id="job-title"
                placeholder="Senior Platform Engineer"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={160}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="job-company">Company (optional)</Label>
              <Input
                id="job-company"
                placeholder="Acme Inc."
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                maxLength={120}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="job-content">Job description</Label>
            <Textarea
              id="job-content"
              rows={10}
              placeholder="Paste the full job posting here…"
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>
          <Button
            disabled={save.isPending || content.trim().length < 80}
            onClick={() => save.mutate()}
          >
            {save.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            Save and extract requirements
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Saved roles
        </h2>
        {jobs.isLoading ? (
          <Skeleton className="h-32 rounded-xl" />
        ) : (jobs.data ?? []).length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No job descriptions yet.
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {(jobs.data ?? []).map((job) => {
              const parsed = (job.parsed ?? {}) as ParsedJobPreview;
              return (
                <Card key={job.id} className="surface-panel lift-on-hover">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 truncate font-medium text-foreground">
                          <Briefcase className="size-4 shrink-0 text-primary" />
                          {job.title}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {[job.company, job.location, job.seniority].filter(Boolean).join(" · ") ||
                            new Date(job.updated_at).toLocaleDateString()}
                        </p>
                      </div>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label="Delete job description">
                            <Trash2 className="size-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete this job description?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Existing reports for this role stay in your history.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => destroy.mutate(job.id)}>
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>

                    {parsed.required_skills?.length ? (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {parsed.required_skills.slice(0, 8).map((skill) => (
                          <Badge key={skill} variant="secondary" className="font-normal">
                            {skill}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
