import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchPayments, fetchPricing } from "@/lib/payments.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatInr } from "@/lib/currency";

export const Route = createFileRoute("/_authenticated/billing")({
  head: () => ({
    meta: [
      { title: "Billing — MatchScore" },
      { name: "description", content: "Your x402 USDC micropayment receipts and pricing." },
      { property: "og:title", content: "Billing — MatchScore" },
      { property: "og:description", content: "Your x402 USDC micropayment receipts." },
    ],
  }),
  component: BillingPage,
});

function BillingPage() {
  const payments = useQuery({ queryKey: ["payments"], queryFn: () => fetchPayments() });
  const pricing = useQuery({ queryKey: ["pricing"], queryFn: () => fetchPricing() });

  const spent = (payments.data ?? [])
    .filter((p) => p.status === "settled" || p.status === "consumed")
    .reduce((sum, p) => sum + p.amount_usd, 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">Billing</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pay-per-report, priced in rupees and settled in USDC on Base. No subscription.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {(pricing.data ?? []).map((tier) => (
          <Card key={tier.product} className="surface-panel">
            <CardContent className="p-5">
              <p className="text-sm font-medium text-foreground">{tier.label}</p>
              <p className="mt-1 font-display text-3xl font-bold text-foreground">
                {formatInr(tier.price_usd)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{tier.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="surface-panel">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Payment history</CardTitle>
          <Badge variant="secondary" className="font-mono">
            {formatInr(spent)} total
          </Badge>
        </CardHeader>
        <CardContent>
          {payments.isLoading ? (
            <Skeleton className="h-40" />
          ) : (payments.data ?? []).length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No payments yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Receipt</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(payments.data ?? []).map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {new Date(payment.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-sm">{payment.product.replace("_", " ")}</TableCell>
                    <TableCell className="font-mono text-sm">
                      {formatInr(payment.amount_usd)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          payment.status === "failed"
                            ? "destructive"
                            : payment.status === "pending"
                              ? "outline"
                              : "secondary"
                        }
                      >
                        {payment.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {payment.tx_hash ? `${payment.tx_hash.slice(0, 10)}…` : payment.receipt_code}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
