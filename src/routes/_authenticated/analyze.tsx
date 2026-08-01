import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Sparkles, Wallet, ShieldCheck, Check, Plus } from "lucide-react";
import { fetchResumes } from "@/lib/resumes.functions";
import { fetchJobs } from "@/lib/jobs.functions";
import { fetchPaymentMode, fetchPricing } from "@/lib/payments.functions";
import { runMatchAnalysis } from "@/lib/analysis.functions";
import { useX402Payment, STAGE_COPY } from "@/hooks/use-x402-payment";
import { hasWallet } from "@/lib/wallet";
import type { ProductCode } from "@/lib/x402";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { formatInr } from "@/lib/currency";

export const Route = createFileRoute("/_authenticated/analyze")({
  head: () => ({
    meta: [
      { title: "New analysis — MatchScore" },
      { name: "description", content: "Score a resume against a role with explainable AI." },
      { property: "og:title", content: "New analysis — MatchScore" },
      { property: "og:description", content: "Score a resume against a role with explainable AI." },
    ],
  }),
  component: AnalyzePage,
});

function AnalyzePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [resumeId, setResumeId] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [product, setProduct] = useState<ProductCode>("match_analysis");

  const resumes = useQuery({ queryKey: ["resumes"], queryFn: () => fetchResumes() });
  const jobs = useQuery({ queryKey: ["jobs"], queryFn: () => fetchJobs() });
  const pricing = useQuery({ queryKey: ["pricing"], queryFn: () => fetchPricing() });
  const payMode = useQuery({ queryKey: ["payment-mode"], queryFn: () => fetchPaymentMode() });
  const sandbox = payMode.data?.mode === "sandbox";

  const { pay, stage } = useX402Payment();
  const [running, setRunning] = useState(false);

  const analyze = useMutation({
    mutationFn: async () => {
      if (!resumeId || !jobId) throw new Error("Pick a resume and a role first.");
      const receipt = await pay(product);
      if (!receipt) return null;

      setRunning(true);
      const result = await runMatchAnalysis({
        data: {
          resumeId,
          jobDescriptionId: jobId,
          product,
          paymentId: receipt.paymentId,
        },
      });
      return result;
    },
    onSuccess: (result) => {
      setRunning(false);
      if (!result) return;
      queryClient.invalidateQueries({ queryKey: ["analyses"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      toast.success(`Analysis complete — ${result.overallScore}/100`);
      navigate({ to: "/reports/$id", params: { id: result.id } });
    },
    onError: (error: Error) => {
      setRunning(false);
      toast.error(error.message);
    },
  });

  const walletMissing = !sandbox && typeof window !== "undefined" && !hasWallet();
  const busy = analyze.isPending || running;
  const selectedPrice = pricing.data?.find((p) => p.product === product)?.price_usd;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">
            New analysis
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pick a resume and a role, choose a report tier, then pay per report.
          </p>
        </div>
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => {
            setResumeId(null);
            setJobId(null);
            setProduct("match_analysis");
            toast.info("Started a new analysis");
          }}
        >
          <Plus className="size-4" />
          New analysis
        </Button>
      </div>

      {sandbox ? (
        <Alert>
          <ShieldCheck className="size-4" />
          <AlertTitle>Test mode billing</AlertTitle>
          <AlertDescription>
            No receiving wallet is configured yet, so reports are billed in test mode — no wallet
            and no real money. Receipts still appear in Billing.
          </AlertDescription>
        </Alert>
      ) : null}

      {walletMissing ? (
        <Alert>
          <Wallet className="size-4" />
          <AlertTitle>No crypto wallet detected</AlertTitle>
          <AlertDescription>
            MatchScore charges per report using the x402 protocol on Base. Install a browser wallet
            such as MetaMask or Coinbase Wallet with USDC to continue.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="surface-panel">
          <CardHeader>
            <CardTitle className="text-base">1 · Choose a resume</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {resumes.isLoading ? (
              <Skeleton className="h-24" />
            ) : (resumes.data ?? []).length === 0 ? (
              <EmptyPicker to="/resumes" label="Upload a resume first" />
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
            <CardTitle className="text-base">2 · Choose a role</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {jobs.isLoading ? (
              <Skeleton className="h-24" />
            ) : (jobs.data ?? []).length === 0 ? (
              <EmptyPicker to="/jobs" label="Add a job description first" />
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
      </div>

      <Card className="surface-panel">
        <CardHeader>
          <CardTitle className="text-base">3 · Pick a report tier</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          {pricing.isLoading
            ? [0, 1, 2].map((i) => <Skeleton key={i} className="h-32" />)
            : (pricing.data ?? []).map((tier) => (
                <button
                  key={tier.product}
                  type="button"
                  onClick={() => setProduct(tier.product)}
                  className={cn(
                    "rounded-xl border p-4 text-left transition-all",
                    product === tier.product
                      ? "border-primary bg-primary/5 shadow-[var(--shadow-glow)]"
                      : "border-border hover:border-primary/40",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-foreground">{tier.label}</span>
                    {product === tier.product ? (
                      <Check className="size-4 text-primary" />
                    ) : null}
                  </div>
                  <p className="mt-1 font-display text-2xl font-bold text-foreground">
                    {formatInr(tier.price_usd)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{tier.description}</p>
                </button>
              ))}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-4">
        <Button
          size="lg"
          disabled={busy || !resumeId || !jobId || walletMissing}
          onClick={() => analyze.mutate()}
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          {running ? "Analyzing…" : STAGE_COPY[stage]}
          {selectedPrice != null && !busy ? (
            <Badge variant="secondary" className="ml-1 font-mono">
              {formatInr(selectedPrice)}
            </Badge>
          ) : null}
        </Button>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5" />
          Priced in rupees, settled in USDC on Base via x402 — one signature, no subscription.
        </p>
      </div>
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

function EmptyPicker({ to, label }: { to: "/resumes" | "/jobs"; label: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border p-6 text-center">
      <p className="text-sm text-muted-foreground">{label}</p>
      <Button asChild size="sm" variant="outline" className="mt-3">
        <Link to={to}>Go there</Link>
      </Button>
    </div>
  );
}
