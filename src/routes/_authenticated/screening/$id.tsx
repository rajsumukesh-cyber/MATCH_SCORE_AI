import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, GraduationCap, ShieldAlert, ShieldCheck, XCircle } from "lucide-react";
import { fetchScreening } from "@/lib/screening.functions";
import type { StudyTopic } from "@/lib/screening.server";
import type { BiasFlag, BiasSummary } from "@/lib/bias.server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/screening/$id")({
  head: () => ({
    meta: [
      { title: "Screening result — MatchScore" },
      {
        name: "description",
        content:
          "Selected and not-selected candidates for one role, with explained scores, fairness checks and study topics.",
      },
      { property: "og:title", content: "Screening result — MatchScore" },
      {
        property: "og:description",
        content: "Explainable shortlist with fairness checks and study topics.",
      },
    ],
  }),
  component: ScreeningDetail,
});

interface CandidateRow {
  id: string;
  candidate_label: string;
  score: number;
  selected: boolean;
  matched_skills: string[];
  missing_skills: string[];
  study_topics: unknown;
  alternative_roles: string[];
  rationale: string | null;
  bias_flags: unknown;
}

function ScreeningDetail() {
  const { id } = Route.useParams();
  const query = useQuery({
    queryKey: ["screening", id],
    queryFn: () => fetchScreening({ data: { id } }),
  });

  if (query.isLoading) return <Skeleton className="h-96" />;
  if (query.isError || !query.data) {
    return <p className="text-sm text-muted-foreground">This screening run could not be loaded.</p>;
  }

  const { screening, candidates } = query.data;
  const rows = candidates as unknown as CandidateRow[];
  const selected = rows.filter((c) => c.selected);
  const rejected = rows.filter((c) => !c.selected);
  const bias = screening.bias_summary as unknown as BiasSummary;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
            <Link to="/screening">
              <ArrowLeft className="size-4" />
              All screenings
            </Link>
          </Button>
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">
            {screening.title}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {selected.length} of {rows.length} candidates cleared the {screening.cutoff}% cutoff ·{" "}
            {new Date(screening.created_at).toLocaleString()}
          </p>
        </div>
        <Badge variant={screening.anonymize ? "default" : "secondary"} className="gap-1.5">
          <ShieldCheck className="size-3.5" />
          {screening.anonymize ? "Bias-safe anonymous run" : "Identities visible"}
        </Badge>
      </div>

      <Card className="surface-panel">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="size-4 text-primary" />
            Bias detection
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            {(bias?.fairnessNotes ?? []).map((note) => (
              <li key={note} className="flex gap-2">
                <span className="text-primary">·</span>
                {note}
              </li>
            ))}
          </ul>
          {(bias?.jobFlags ?? []).length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">
                Wording to fix in the job description
              </p>
              {(bias.jobFlags as BiasFlag[]).map((flag) => (
                <div
                  key={flag.label + flag.detail}
                  className="flex gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3"
                >
                  <ShieldAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
                  <div>
                    <p className="text-sm font-medium text-foreground">{flag.label}</p>
                    <p className="text-xs text-muted-foreground">{flag.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Section
        title="Selected"
        description={`At or above the ${screening.cutoff}% cutoff.`}
        icon={<CheckCircle2 className="size-4 text-primary" />}
        rows={selected}
        cutoff={screening.cutoff}
      />

      <Section
        title="Not selected"
        description="Below the cutoff — each candidate gets the remaining topics to study and the roles they already fit."
        icon={<XCircle className="size-4 text-muted-foreground" />}
        rows={rejected}
        cutoff={screening.cutoff}
      />
    </div>
  );
}

function Section({
  title,
  description,
  icon,
  rows,
  cutoff,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  rows: CandidateRow[];
  cutoff: number;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="font-display text-xl font-semibold text-foreground">{title}</h2>
        <Badge variant="secondary">{rows.length}</Badge>
      </div>
      <p className="text-sm text-muted-foreground">{description}</p>
      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Nobody in this group.
        </p>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <CandidateCard key={row.id} row={row} cutoff={cutoff} />
          ))}
        </div>
      )}
    </section>
  );
}

function CandidateCard({ row, cutoff }: { row: CandidateRow; cutoff: number }) {
  const topics = (Array.isArray(row.study_topics) ? row.study_topics : []) as StudyTopic[];
  const flags = (Array.isArray(row.bias_flags) ? row.bias_flags : []) as BiasFlag[];

  return (
    <Card className="surface-panel">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base">{row.candidate_label}</CardTitle>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "font-display text-2xl font-bold",
                row.selected ? "text-primary" : "text-muted-foreground",
              )}
            >
              {row.score}%
            </span>
            <Badge variant={row.selected ? "default" : "secondary"}>
              {row.selected ? "Selected" : `${Math.max(0, cutoff - row.score)}% short`}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {row.rationale ? <p className="text-muted-foreground">{row.rationale}</p> : null}

        <div className="grid gap-4 md:grid-cols-2">
          <SkillList label="Matched" items={row.matched_skills} tone="match" />
          <SkillList label="Missing" items={row.missing_skills} tone="miss" />
        </div>

        {topics.length > 0 ? (
          <div className="rounded-lg border border-border p-4">
            <p className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
              <GraduationCap className="size-4 text-primary" />
              Remaining topics to study
            </p>
            <ol className="space-y-3">
              {topics.map((topic, i) => (
                <li key={topic.topic + i} className="border-l-2 border-primary/40 pl-3">
                  <p className="text-sm font-medium text-foreground">{topic.topic}</p>
                  <p className="text-xs text-muted-foreground">{topic.what_to_learn}</p>
                  <p className="mt-1 text-xs text-muted-foreground/80">
                    Why it matters: {topic.why_it_matters} · {topic.effort}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        ) : null}

        {row.alternative_roles.length > 0 ? (
          <div className="rounded-lg bg-accent/10 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Suggested to the hiring manager for
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {row.alternative_roles.map((role) => (
                <Badge key={role} variant="outline">
                  {role}
                </Badge>
              ))}
            </div>
          </div>
        ) : null}

        {flags.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            Privacy: {flags.length} personal detail type(s) were masked before scoring —{" "}
            {flags.map((f) => f.label.toLowerCase()).join(", ")}.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function SkillList({
  label,
  items,
  tone,
}: {
  label: string;
  items: string[];
  tone: "match" | "miss";
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <Badge key={item} variant={tone === "match" ? "secondary" : "outline"}>
            {item}
          </Badge>
        ))}
      </div>
    </div>
  );
}
