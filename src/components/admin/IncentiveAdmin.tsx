import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Award } from "lucide-react";

type Row = {
  id: string;
  user_id: string;
  week_start: string;
  week_ending: string;
  amount: number;
  final_score: number | null;
  weekly_completion: number | null;
  decision: string;
  status: "Banked" | "Pending Payment" | "Paid";
  gcash_name: string | null;
  gcash_number: string | null;
  requested_at: string | null;
  paid_at: string | null;
};

const PHP = (n: number) =>
  `PHP ${Number(n).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (v: number | null) => (v === null ? "—" : `${Number(v).toFixed(1)}%`);

export function IncentiveAdmin() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("weekly_incentives")
      .select("*")
      .order("week_ending", { ascending: false });
    const list = (data ?? []) as unknown as Row[];
    setRows(list);
    const ids = [...new Set(list.map((r) => r.user_id))];
    if (ids.length) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, name")
        .in("user_id", ids);
      setNames(
        Object.fromEntries((profiles ?? []).map((p: { user_id: string; name: string }) => [p.user_id, p.name])),
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel("admin-weekly-incentives")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "weekly_incentives",
        },
        () => load(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  const markPaid = async (row: Row) => {
    setBusy(row.id);
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("weekly_incentives")
      .update({ status: "Paid", paid_at: new Date().toISOString(), paid_by: auth?.user?.id ?? null })
      .eq("id", row.id);
    if (error) {
      setBusy(null);
      toast({ title: "Could not update", description: error.message, variant: "destructive" });
      return;
    }
    // Notify the employee in their own Discord channel that payment was sent.
    let notified = false;
    try {
      const { data: res } = await supabase.functions.invoke("notify-incentive-paid", {
        body: { incentive_id: row.id },
      });
      notified = Boolean((res as { sent?: boolean } | null)?.sent);
    } catch {
      notified = false;
    }
    setBusy(null);
    toast({
      title: "Marked as Paid",
      description: `${names[row.user_id] ?? "Employee"} · ${PHP(row.amount)}${
        notified ? " · Discord notified" : " · No Discord channel linked"
      }`,
    });
    load();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Award className="h-4 w-4" /> Weekly incentives
        </CardTitle>
        <CardDescription>
          PHP 500 per qualifying week. Earned when every accountable task due on the employee's
          scheduled workdays that week was completed on time. The Performance Pulse score is
          coaching information only.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : rows.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground">No incentive records yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Week ending</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Completion</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>GCash</TableHead>
                  <TableHead>Requested</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{names[r.user_id] ?? "—"}</TableCell>
                    <TableCell>{r.week_ending}</TableCell>
                    <TableCell>{pct(r.final_score)}</TableCell>
                    <TableCell>{pct(r.weekly_completion)}</TableCell>
                    <TableCell className="tabular-nums">{PHP(Number(r.amount))}</TableCell>
                    <TableCell className="text-xs">
                      {r.gcash_name ? (
                        <>
                          {r.gcash_name}
                          <br />
                          {r.gcash_number}
                        </>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {r.requested_at ? new Date(r.requested_at).toLocaleString() : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={r.status === "Paid" ? "default" : "secondary"}>{r.status}</Badge>
                    </TableCell>
                    <TableCell>
                      {r.status === "Pending Payment" && (
                        <Button size="sm" onClick={() => markPaid(r)} disabled={busy === r.id}>
                          {busy === r.id && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                          Mark Paid
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default IncentiveAdmin;