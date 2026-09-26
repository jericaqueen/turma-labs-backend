import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { IncentiveInfoModal } from "./IncentiveInfoModal";
import { PartyPopper, Wallet, Loader2 } from "lucide-react";

export type IncentiveWeek = {
  week_start: string;
  week_ending: string;
  score: number | null;
  completion: number | null;
  finalized: boolean;
  eligible: boolean;
  amount: number;
  reasons: string[];
};

export type IncentiveRecord = {
  id: string;
  week_start: string;
  week_ending: string;
  amount: number;
  final_score: number | null;
  weekly_completion: number | null;
  decision: "claimed" | "banked";
  status: "Banked" | "Pending Payment" | "Paid";
  gcash_name: string | null;
  gcash_number: string | null;
  requested_at: string | null;
  paid_at: string | null;
};

export const PHP = (n: number) =>
  `PHP ${Number(n).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const maskNumber = (n: string | null) =>
  !n ? "" : n.length <= 4 ? n : `${"•".repeat(Math.max(0, n.length - 4))}${n.slice(-4)}`;

const pct = (v: number | null) => (v === null ? "—" : `${v.toFixed(1)}%`);

export function EmployeeIncentivePanel({ week }: { week: IncentiveWeek | null }) {
  const { toast } = useToast();
  const [userId, setUserId] = useState<string | null>(null);
  const [records, setRecords] = useState<IncentiveRecord[]>([]);
  const [acked, setAcked] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [resultOpen, setResultOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"week" | "wallet">("week");
  const [gcashName, setGcashName] = useState("");
  const [gcashNumber, setGcashNumber] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [editDetails, setEditDetails] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);

  const load = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth?.user?.id ?? null;
    setUserId(uid);
    if (!uid) {
      setLoading(false);
      return;
    }
    const [rec, ack] = await Promise.all([
      supabase
        .from("weekly_incentives")
        .select("*")
        .eq("user_id", uid)
        .order("week_ending", { ascending: false }),
      supabase.from("weekly_incentive_acks").select("week_ending").eq("user_id", uid),
    ]);
    const rows = (rec.data ?? []) as unknown as IncentiveRecord[];
    setRecords(rows);
    setAcked((ack.data ?? []).map((r: { week_ending: string }) => r.week_ending));
    const last = rows.find((r) => r.gcash_number);
    if (last) {
      setGcashName(last.gcash_name ?? "");
      setGcashNumber(last.gcash_number ?? "");
      setEditDetails(false);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`weekly-incentives-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "weekly_incentives",
          filter: `user_id=eq.${userId}`,
        },
        () => load(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "weekly_incentive_acks",
          filter: `user_id=eq.${userId}`,
        },
        () => load(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, load]);

  const thisWeekRecord = week ? records.find((r) => r.week_ending === week.week_ending) : undefined;
  const alreadyDecided = Boolean(thisWeekRecord) || Boolean(week && acked.includes(week.week_ending));

  // One automatic result popup once the week is final — never again after a decision.
  useEffect(() => {
    if (loading || !week || !week.finalized || alreadyDecided) return;
    setResultOpen(true);
  }, [loading, week, alreadyDecided]);

  const wallet = useMemo(() => {
    const month = new Date().toISOString().slice(0, 7);
    const banked = records.filter((r) => r.status === "Banked");
    return {
      available: banked.reduce((s, r) => s + Number(r.amount), 0),
      bankedRows: banked,
      earnedThisMonth: records
        .filter((r) => r.week_ending.slice(0, 7) === month)
        .reduce((s, r) => s + Number(r.amount), 0),
      pending: records
        .filter((r) => r.status === "Pending Payment")
        .reduce((s, r) => s + Number(r.amount), 0),
      paid: records.filter((r) => r.status === "Paid").reduce((s, r) => s + Number(r.amount), 0),
    };
  }, [records]);

  const ack = async (weekEnding: string) => {
    if (!userId) return;
    await supabase
      .from("weekly_incentive_acks")
      .upsert({ user_id: userId, week_ending: weekEnding }, { onConflict: "user_id,week_ending" });
    setAcked((a) => [...a, weekEnding]);
  };

  const bank = async () => {
    if (!userId || !week) return;
    setSubmitting(true);
    const { error } = await supabase.rpc("bank_weekly_incentive", {
      p_week_start: week.week_start,
      p_week_ending: week.week_ending,
      p_amount: week.amount,
      p_final_score: week.score,
      p_weekly_completion: week.completion,
    });
    setSubmitting(false);
    if (error) {
      toast({
        title: "Could not save incentive",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({ title: "Saved to your Incentive Wallet", description: PHP(week.amount) });
      await ack(week.week_ending);
      setResultOpen(false);
      load();
    }
  };

  const openClaim = (mode: "week" | "wallet") => {
    setFormMode(mode);
    setConfirmed(false);

    if (mode === "week") {
      // Radix dialogs can swallow focus/clicks when one closes and another opens
      // in the same render tick. Close the result popup first, then open payout.
      setResultOpen(false);
      window.setTimeout(() => setFormOpen(true), 120);
      return;
    }

    setFormOpen(true);
  };

  const backToWeeklyResult = () => {
    setFormOpen(false);
    if (formMode === "week") {
      window.setTimeout(() => setResultOpen(true), 120);
    }
  };

  const submitClaim = async () => {
    if (!userId || !confirmed || !gcashName.trim() || !gcashNumber.trim()) return;
    setSubmitting(true);
    const requested_at = new Date().toISOString();
    let ids: string[] = [];

    if (formMode === "week") {
      if (!week) return;
      const { data, error } = await supabase.rpc("claim_weekly_incentive", {
        p_week_start: week.week_start,
        p_week_ending: week.week_ending,
        p_amount: week.amount,
        p_final_score: week.score,
        p_weekly_completion: week.completion,
        p_gcash_name: gcashName.trim(),
        p_gcash_number: gcashNumber.trim(),
      });
      if (error) {
        setSubmitting(false);
        toast({
          title: "Could not submit payout",
          description: error.message,
          variant: "destructive",
        });
        return;
      }
      ids = data ? [String(data)] : [];
      await ack(week.week_ending);
    } else {
      const bankedIds = wallet.bankedRows.map((r) => r.id);
      if (bankedIds.length === 0) {
        setSubmitting(false);
        return;
      }
      const { data, error } = await supabase
        .from("weekly_incentives")
        .update({
          status: "Pending Payment",
          gcash_name: gcashName.trim(),
          gcash_number: gcashNumber.trim(),
          requested_at,
        })
        .in("id", bankedIds)
        .eq("status", "Banked")
        .select("id");
      if (error) {
        setSubmitting(false);
        toast({ title: "Could not submit", description: error.message, variant: "destructive" });
        return;
      }
      ids = (data ?? []).map((r: { id: string }) => r.id);
    }

    let emailed = false;
    try {
      const { data: res } = await supabase.functions.invoke("notify-incentive-claim", {
        body: { incentive_ids: ids },
      });
      emailed = Boolean((res as { email_sent?: boolean })?.email_sent);
    } catch {
      /* the payout record is already saved; notification is best-effort */
    }

    setSubmitting(false);
    setFormOpen(false);
    setEditDetails(false);
    toast({
      title: "Payout request submitted",
      description: emailed
        ? "Jerica has been emailed and your request is Pending Payment."
        : "Your request is Pending Payment and is visible to Jerica in the admin dashboard.",
    });
    load();
  };

  const showWallet = records.length > 0;

  return (
    <>
      <IncentiveInfoModal open={infoOpen} onOpenChange={setInfoOpen} trigger={<span className="hidden" />} />

      {/* Automatic end-of-week result */}
      <Dialog
        open={resultOpen}
        onOpenChange={(v) => {
          setResultOpen(v);
          if (!v && week && !week.eligible) ack(week.week_ending);
        }}
      >
        <DialogContent className="max-w-md">
          {week?.eligible ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <PartyPopper className="h-5 w-5 text-primary" />
                  Congratulations — you earned your PHP 500 weekly incentive.
                </DialogTitle>
                <DialogDescription>Week ending {week.week_ending}</DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-3 gap-3 text-center text-sm">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Performance score (info only)</p>
                  <p className="font-semibold">{pct(week.score)}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Accountable tasks on time</p>
                  <p className="font-semibold">{pct(week.completion)}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Amount</p>
                  <p className="font-semibold">{PHP(week.amount)}</p>
                </div>
              </div>
              <DialogFooter className="flex-col gap-2 sm:flex-col">
                <Button className="w-full" onClick={() => openClaim("week")} disabled={submitting}>
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Claim {PHP(week.amount)} Now
                </Button>
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={bank}
                  disabled={submitting}
                >
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save {PHP(week.amount)} to My Incentive Wallet
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Your week is complete</DialogTitle>
                <DialogDescription>Week ending {week?.week_ending}</DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-3 text-center text-sm">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Performance score (info only)</p>
                  <p className="font-semibold">{pct(week?.score ?? null)}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Accountable tasks on time</p>
                  <p className="font-semibold">{pct(week?.completion ?? null)}</p>
                </div>
              </div>
              <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                <p className="font-medium">This week did not reach the incentive</p>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
                  {(week?.reasons?.length ? week.reasons : ["Not every accountable task due this week was completed on time."]).map(
                    (r) => (
                      <li key={r}>{r}</li>
                    ),
                  )}
                </ul>
              </div>
              <DialogFooter className="flex-col gap-2 sm:flex-col">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setResultOpen(false);
                    if (week) ack(week.week_ending);
                    setInfoOpen(true);
                  }}
                >
                  See how my score is calculated
                </Button>
                <Button
                  className="w-full"
                  onClick={() => {
                    setResultOpen(false);
                    if (week) ack(week.week_ending);
                  }}
                >
                  Got it
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Payout form */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {formMode === "week" ? "Claim your PHP 500 weekly incentive" : "Claim your wallet balance"}
            </DialogTitle>
            <DialogDescription>
              Payout is sent to GCash. These details are checked before payment.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border bg-muted/40 p-3 text-sm">
            {formMode === "week" && week ? (
              <div className="space-y-1">
                <p>Week: {week.week_start} → {week.week_ending}</p>
                <p>Final score: {pct(week.score)} · Weekly Completion: {pct(week.completion)}</p>
                <p className="font-semibold">Amount: {PHP(week.amount)}</p>
              </div>
            ) : (
              <div className="space-y-1">
                <p>{wallet.bankedRows.length} banked week(s)</p>
                <p className="font-semibold">Amount: {PHP(wallet.available)}</p>
              </div>
            )}
          </div>

          {!editDetails ? (
            <div className="flex items-center justify-between rounded-lg border p-3 text-sm">
              <div>
                <p className="font-medium">{gcashName}</p>
                <p className="text-muted-foreground">{maskNumber(gcashNumber)}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setEditDetails(true)}>
                Change
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="gcash-name">GCash account name</Label>
                <Input id="gcash-name" value={gcashName} onChange={(e) => setGcashName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="gcash-number">GCash mobile number</Label>
                <Input
                  id="gcash-number"
                  inputMode="tel"
                  value={gcashNumber}
                  onChange={(e) => setGcashNumber(e.target.value)}
                />
              </div>
            </div>
          )}

          <label className="flex items-start gap-2 text-sm">
            <Checkbox checked={confirmed} onCheckedChange={(v) => setConfirmed(v === true)} />
            <span>I confirm these payout details are correct.</span>
          </label>

          <DialogFooter className="gap-2 sm:gap-2">
            {formMode === "week" && (
              <Button
                type="button"
                variant="outline"
                onClick={backToWeeklyResult}
                disabled={submitting}
              >
                Back
              </Button>
            )}
            <Button
              className="w-full"
              onClick={submitClaim}
              disabled={submitting || !confirmed || !gcashName.trim() || !gcashNumber.trim()}
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit payout request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {showWallet && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Wallet className="h-4 w-4" /> My Incentive Wallet
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                { label: "Available to claim", value: wallet.available },
                { label: "Earned this month", value: wallet.earnedThisMonth },
                { label: "Pending payment", value: wallet.pending },
                { label: "Already paid", value: wallet.paid },
              ].map((c) => (
                <div key={c.label} className="rounded-lg border bg-card/60 p-3">
                  <p className="text-xs text-muted-foreground">{c.label}</p>
                  <p className="text-sm font-semibold tabular-nums">{PHP(c.value)}</p>
                </div>
              ))}
            </div>

            {wallet.available > 0 && (
              <Button size="sm" onClick={() => openClaim("wallet")}>
                Claim full balance ({PHP(wallet.available)})
              </Button>
            )}

            <div className="space-y-2">
              {records.slice(0, 8).map((r) => (
                <div
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm"
                >
                  <div>
                    <p className="font-medium">Week ending {r.week_ending}</p>
                    <p className="text-xs text-muted-foreground">
                      Score {pct(r.final_score)} · Completion {pct(r.weekly_completion)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold tabular-nums">{PHP(Number(r.amount))}</span>
                    <Badge variant={r.status === "Paid" ? "default" : "secondary"}>{r.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Banked incentives stay available for one full-balance claim. They are never added to
              your salary, payroll or timesheet.
            </p>
          </CardContent>
        </Card>
      )}
    </>
  );
}

export default EmployeeIncentivePanel;