import { formatInr } from "@/lib/currency";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { checkAdminAccess, fetchAdminOverview } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async () => {
    const { isAdmin } = await checkAdminAccess();
    if (!isAdmin) throw redirect({ to: "/access-denied" });
  },
  head: () => ({
    meta: [
      { title: "Admin — MatchScore" },
      { name: "description", content: "Platform metrics for MatchScore administrators." },
      { property: "og:title", content: "Admin — MatchScore" },
      { property: "og:description", content: "Platform metrics for MatchScore administrators." },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const overview = useQuery({
    queryKey: ["admin-overview"],
    queryFn: () => fetchAdminOverview(),
    retry: false,
  });

  if (overview.error || overview.data?.forbidden) {
    return (
      <div className="rounded-xl border border-dashed border-border p-10 text-center">
        <p className="text-sm text-muted-foreground">
          You don't have access to the admin area.
        </p>
        <Button asChild className="mt-4">
          <Link to="/dashboard">Back to dashboard</Link>
        </Button>
      </div>
    );
  }

  const stats = overview.data?.overview;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">Admin</h1>
        <p className="mt-1 text-sm text-muted-foreground">Platform-wide usage and revenue.</p>
      </div>

      {overview.isLoading || !stats ? (
        <Skeleton className="h-32 rounded-xl" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Users", value: String(stats.users) },
            { label: "Analyses", value: String(stats.analyses) },
            { label: "Revenue", value: formatInr(stats.revenueUsd) },

            { label: "Avg. score", value: String(stats.averageScore) },
          ].map((card) => (
            <Card key={card.label} className="surface-panel">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                  {card.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-display text-3xl font-bold text-foreground">{card.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
