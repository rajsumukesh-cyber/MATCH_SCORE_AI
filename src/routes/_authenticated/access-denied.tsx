import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/access-denied")({
  head: () => ({
    meta: [
      { title: "Access denied — MatchScore" },
      { name: "description", content: "You don't have permission to view this MatchScore area." },
      { property: "og:title", content: "Access denied — MatchScore" },
      { property: "og:description", content: "You don't have permission to view this MatchScore area." },
    ],
  }),
  component: AccessDeniedPage,
});

function AccessDeniedPage() {
  return (
    <div className="mx-auto flex max-w-xl items-center justify-center py-16">
      <Card className="surface-panel w-full text-center">
        <CardContent className="space-y-4 p-10">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <ShieldAlert className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
            Access denied
          </h1>
          <p className="text-sm text-muted-foreground">
            The admin area is limited to accounts with elevated access. If you believe this is a
            mistake, ask an existing administrator to grant you the admin role.
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <Button asChild>
              <Link to="/dashboard">Back to dashboard</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/billing">View billing</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
