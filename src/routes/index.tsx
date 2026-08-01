import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, Coins, FileSearch, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { fetchPricing } from "@/lib/payments.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatInr } from "@/lib/currency";
import { Logo } from "@/components/logo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MatchScore — AI Resume-to-Role Match Scorer" },
      {
        name: "description",
        content:
          "Score any resume against any job description with explainable AI. Skill gaps, ATS checks and rewrite suggestions, paid per report with x402 USDC micropayments.",
      },
      { property: "og:title", content: "MatchScore — AI Resume-to-Role Match Scorer" },
      {
        property: "og:description",
        content:
          "Explainable resume-to-role matching with skill gaps, ATS scoring and rewrites — priced per report in USDC.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  {
    icon: FileSearch,
    title: "Deep match analysis",
    body: "Every resume is parsed into skills, experience and education, then compared against the role's real requirements.",
  },
  {
    icon: BarChart3,
    title: "Explainable scoring",
    body: "Category-level scores blended with semantic similarity — you always see why a score landed where it did.",
  },
  {
    icon: Sparkles,
    title: "Actionable rewrites",
    body: "Improved bullet points, suggested keywords and a rewritten summary tuned to the target role.",
  },
  {
    icon: ShieldCheck,
    title: "ATS readiness",
    body: "An ATS score plus a concrete checklist of what to fix before you submit the application.",
  },
  {
    icon: Coins,
    title: "x402 micropayments",
    body: "Pay per report in USDC straight from your wallet. No subscription, no card on file.",
  },
  {
    icon: Zap,
    title: "Agent-ready API",
    body: "A public REST endpoint that answers with an HTTP 402 challenge so autonomous agents can pay and analyze.",
  },
];

function Landing() {
  const pricing = useQuery({ queryKey: ["pricing"], queryFn: () => fetchPricing() });

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Logo />
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/auth">Sign in</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/auth">Get started</Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section className="hero-canvas">
          <div className="mx-auto max-w-3xl px-4 py-24 text-center sm:py-32">
            <Badge variant="secondary" className="mb-6">
              Explainable AI matching · USDC per report
            </Badge>
            <h1 className="font-display text-4xl font-bold tracking-tight text-foreground sm:text-6xl">
              Know exactly how well a resume{" "}
              <span className="text-signal-gradient">fits the role</span>
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-base text-muted-foreground sm:text-lg">
              MatchScore reads a resume and a job description, scores the fit across skills,
              experience, education and keywords, and tells you precisely what to change.
            </p>
            <div className="mt-9 flex flex-wrap justify-center gap-3">
              <Button asChild size="lg">
                <Link to="/auth">Score a resume</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a href="#pricing">See pricing</a>
              </Button>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-20">
          <h2 className="font-display text-3xl font-bold tracking-tight text-foreground">
            Built for candidates and recruiters
          </h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <Card key={f.title} className="surface-panel lift-on-hover">
                <CardHeader>
                  <span className="signal-gradient mb-2 flex size-9 items-center justify-center rounded-lg text-primary-foreground">
                    <f.icon className="size-4" />
                  </span>
                  <CardTitle className="text-base">{f.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{f.body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section id="pricing" className="border-y border-border/60 bg-muted/30">
          <div className="mx-auto max-w-5xl px-4 py-20">
            <h2 className="font-display text-3xl font-bold tracking-tight text-foreground">
              Pay per report
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Settled in USDC over the x402 protocol — connect a wallet, sign once, get the report.
            </p>
            <div className="mt-10 grid gap-5 sm:grid-cols-3">
              {(pricing.data ?? []).map((tier) => (
                <Card key={tier.product} className="surface-panel">
                  <CardHeader>
                    <CardTitle className="text-base">{tier.label}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="font-display text-3xl font-bold text-foreground">
                      {formatInr(Number(tier.price_usd))}
                    </p>
                    <p className="text-sm text-muted-foreground">{tier.description}</p>
                  </CardContent>
                </Card>
              ))}
              {pricing.isLoading
                ? [0, 1, 2].map((i) => (
                    <Card key={i} className="surface-panel h-44 animate-pulse" />
                  ))
                : null}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-4 py-24 text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight text-foreground">
            Stop guessing why you were rejected
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">
            Upload a resume, paste the role, and get an explainable report in under a minute.
          </p>
          <Button asChild size="lg" className="mt-8">
            <Link to="/auth">Get started</Link>
          </Button>
        </section>
      </main>

      <footer className="border-t border-border/60">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-8 sm:flex-row">
          <Logo />
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} MatchScore. Explainable resume-to-role matching.
          </p>
        </div>
      </footer>
    </div>
  );
}
