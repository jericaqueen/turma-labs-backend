import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useRealtimeTables } from "@/hooks/useRealtimePayroll";
import { useBalanceAccount } from "./useBalanceAccount";
import { useEffectiveUser } from "@/contexts/EffectiveUser";
import {
  CATEGORIES,
  Category,
  OPENING_CUTOFF,
  PHP,
  formatLedgerDate,
  manilaToday,
  monthLabel,
  postMissingSalaryAccruals,
  salaryAccrualsThrough,
} from "./balance-utils";
import {
  BadgeCheck,
  Ban,
  FileImage,
  Loader2,
  Pencil,
  Plus,
  Upload,
  Wallet,
} from "lucide-react";

interface Txn {
  id: string;
  occurred_on: string | null;
  date_unknown: boolean;
  date_precision: string;
  ordinal: number;
  direction: "plus" | "minus";
  category: string;
  amount: number;
  description: string | null;
  proof_path: string | null;
  proof_name: string | null;
  status: string;
  excluded_from_balance: boolean;
  verified_by: string | null;
  verified_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

interface Charge {
  id: string;
  period: string;
  rent_amount: number;
  netflix_amount: number;
  status: string;
  transaction_id: string | null;
}

interface SourceFile {
  id: string;
  slot: number;
  label: string;
  file_path: string | null;
  file_name: string | null;
  uploaded_at: string | null;
}

const BUCKET = "balance-proofs";

/** Colour-coded chip per money type so the ledger can be scanned at a glance. */
const CATEGORY_CHIP: Record<string, string> = {
  "Opening Balance": "bg-muted text-muted-foreground border-border",
  Salary: "bg-primary/10 text-primary border-primary/20",
  "Overtime Pay": "bg-success/10 text-success border-success/20",
  "Payment to Gibbs": "bg-accent text-accent-foreground border-border",
  "Gibbs Monthly Charge": "bg-destructive/10 text-destructive border-destructive/20",
  "Gibbs Lent Jerica Money": "bg-secondary text-secondary-foreground border-border",
  "Gibbs Paid Expense for Jerica": "bg-secondary text-secondary-foreground border-border",
  Adjustment: "bg-muted text-muted-foreground border-border",
  "Historical Detail": "bg-muted text-muted-foreground border-border",
};

const emptyForm = {
  direction: "plus" as "plus" | "minus",
  category: "Adjustment" as Category,
  amount: "",
  dateMode: "exact" as "exact" | "month" | "unknown",
  occurred_on: manilaToday(),
  description: "",
  excluded: true,
};

export function BalanceLedger() {
  const preview = useEffectiveUser();
  const { account, loading: accountLoading } = useBalanceAccount(preview?.userId ?? null);
  const { toast } = useToast();
  const [txns, setTxns] = useState<Txn[]>([]);
  const [charges, setCharges] = useState<Charge[]>([]);
  const [sources, setSources] = useState<SourceFile[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Txn | null>(null);
  const [voidConfirm, setVoidConfirm] = useState<Txn | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [monthFilter, setMonthFilter] = useState<string>("all");

  const today = manilaToday();
  const currentPeriod = today.slice(0, 7);

  const load = useCallback(async () => {
    if (!account) return;
    const [t, c, s, p] = await Promise.all([
      supabase.from("balance_transactions").select("*").eq("account_id", account.id),
      supabase.from("balance_monthly_charges").select("*").eq("account_id", account.id),
      supabase.from("balance_source_files").select("*").eq("account_id", account.id).order("slot"),
      supabase.from("profiles").select("user_id,name"),
    ]);
    // Order strictly by the date the money moved, oldest first, so the running
    // balance reads like a bank statement. Rows with no recorded date inherit
    // the date of the entry that came before them in the original seed order.
    const seedOrdered = ((t.data ?? []) as unknown as Txn[])
      .map((r) => ({ ...r, amount: Number(r.amount) }))
      .sort(
        (a, b) =>
          a.ordinal - b.ordinal ||
          (a.occurred_on ?? "9999-12-31").localeCompare(b.occurred_on ?? "9999-12-31") ||
          a.created_at.localeCompare(b.created_at)
      );
    let lastKnownDate = "2026-06-30";
    const withSortDate = seedOrdered.map((r) => {
      if (r.occurred_on) lastKnownDate = r.occurred_on;
      return { row: r, sortDate: r.occurred_on ?? lastKnownDate };
    });
    withSortDate.sort(
      (a, b) =>
        a.sortDate.localeCompare(b.sortDate) ||
        a.row.ordinal - b.row.ordinal ||
        a.row.created_at.localeCompare(b.row.created_at)
    );
    setTxns(withSortDate.map((x) => x.row));
    setCharges(
      ((c.data ?? []) as unknown as Charge[])
        .map((r) => ({
          ...r,
          rent_amount: Number(r.rent_amount),
          netflix_amount: Number(r.netflix_amount),
        }))
        .sort((a, b) => a.period.localeCompare(b.period))
    );
    setSources((s.data ?? []) as unknown as SourceFile[]);
    const map: Record<string, string> = {};
    (p.data ?? []).forEach((row) => {
      map[row.user_id] = row.name;
    });
    setNames(map);
    setLoading(false);
  }, [account]);

  // Idempotent salary accrual + current-month charge row
  const ensureScheduled = useCallback(async () => {
    if (!account) return;
    const due = salaryAccrualsThrough(today, account.monthly_salary);
    const { data: existing, error: lookupError } = await supabase
      .from("balance_transactions")
      .select("schedule_key")
      .eq("account_id", account.id)
      .not("schedule_key", "is", null);
    try {
      if (lookupError) throw new Error(lookupError.message);
      const have = new Set((existing ?? []).map((r) => r.schedule_key as string));
      await postMissingSalaryAccruals(due, have, async (d) =>
        await supabase.from("balance_transactions").insert({
          account_id: account.id,
          occurred_on: d.occurred_on,
          direction: "plus",
          category: "Salary",
          amount: d.amount,
          description: d.description,
          schedule_key: d.schedule_key,
        })
      );
    } catch (error) {
      toast({
        title: "Salary schedule could not be synced",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
    if (currentPeriod >= "2026-10") {
      await supabase
        .from("balance_monthly_charges")
        .upsert(
          {
            account_id: account.id,
            period: currentPeriod,
            rent_amount: account.rent_amount,
            netflix_amount: account.netflix_amount,
          },
          { onConflict: "account_id,period", ignoreDuplicates: true }
        );
    }
  }, [account, currentPeriod, today, toast]);

  useEffect(() => {
    if (!account) {
      if (!accountLoading) setLoading(false);
      return;
    }
    (async () => {
      await ensureScheduled();
      await load();
    })();
  }, [account, accountLoading, ensureScheduled, load]);

  const rows = useMemo(() => {
    let running = 0;
    return txns.map((t) => {
      const affects = t.status === "active" && !t.excluded_from_balance;
      const signed = t.direction === "plus" ? t.amount : -t.amount;
      if (affects) running += signed;
      return { t, affects, running };
    });
  }, [txns]);

  const balance = rows.length ? rows[rows.length - 1].running : 0;

  /** Every month that has at least one entry, newest first. */
  const monthOptions = useMemo(() => {
    const set = new Set<string>();
    txns.forEach((t) => {
      if (t.occurred_on) set.add(t.occurred_on.slice(0, 7));
    });
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [txns]);

  /** Rows shown in the table: newest date first, optionally limited to one month. */
  const visibleRows = useMemo(() => {
    const filtered =
      monthFilter === "all"
        ? rows
        : rows.filter((r) => (r.t.occurred_on ?? "").slice(0, 7) === monthFilter);
    return [...filtered].reverse();
  }, [rows, monthFilter]);

  /** Plain-English totals for the month currently in focus. */
  const monthSummary = useMemo(() => {
    const period = monthFilter === "all" ? currentPeriod : monthFilter;
    const inMonth = rows.filter(
      (r) => r.affects && (r.t.occurred_on ?? "").slice(0, 7) === period
    );
    const sumOf = (match: (c: string) => boolean) =>
      inMonth
        .filter((r) => match(r.t.category))
        .reduce((n, r) => n + (r.t.direction === "plus" ? r.t.amount : -r.t.amount), 0);

    const salary = sumOf((c) => c === "Salary");
    const overtime = sumOf((c) => c === "Overtime Pay");
    const payments = sumOf((c) => c === "Payment to Gibbs");
    const charges = sumOf((c) => c === "Gibbs Monthly Charge");
    const other = sumOf(
      (c) => !["Salary", "Overtime Pay", "Payment to Gibbs", "Gibbs Monthly Charge"].includes(c)
    );
    return {
      period,
      salary,
      overtime,
      payments,
      charges,
      other,
      net: salary + overtime + payments + charges + other,
      count: inMonth.length,
    };
  }, [rows, monthFilter, currentPeriod]);

  // Approved OT posts an "Overtime Pay" row server-side; refresh the ledger live.
  useRealtimeTables(["balance_transactions", "overtime_requests"], load);


  const openAdd = () => {
    setEditing(null);
    setForm({ ...emptyForm, occurred_on: today });
    setProofFile(null);
    setDialogOpen(true);
  };

  const openEdit = (t: Txn) => {
    setEditing(t);
    setForm({
      direction: t.direction,
      category: (t.category as Category) ?? "Adjustment",
      amount: String(t.amount),
      dateMode:
        t.date_precision === "unknown" ? "unknown" : t.date_precision === "month" ? "month" : "exact",
      occurred_on: t.occurred_on ?? today,
      description: t.description ?? "",
      excluded: t.excluded_from_balance,
    });
    setProofFile(null);
    setDialogOpen(true);
  };

  const uploadProof = async (file: File) => {
    if (!account) return null;
    const path = `${account.id}/proofs/${crypto.randomUUID()}-${file.name}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false });
    if (error) throw error;
    return { path, name: file.name };
  };

  const viewFile = async (path: string) => {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 300);
    if (error || !data) {
      toast({ title: "Could not open file", variant: "destructive" });
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener");
  };

  const submit = async () => {
    if (!account) return;
    const amount = Number(form.amount);
    if (!amount || amount <= 0) {
      toast({ title: "Enter an amount greater than zero", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id ?? null;
      let proof: { path: string; name: string } | null = null;
      if (proofFile) proof = await uploadProof(proofFile);

      const isPreJuly = form.dateMode !== "unknown" && form.occurred_on < OPENING_CUTOFF;
      const payload = {
        account_id: account.id,
        occurred_on: form.dateMode === "unknown" ? null : form.occurred_on,
        date_unknown: form.dateMode === "unknown",
        date_precision: form.dateMode === "unknown" ? "unknown" : form.dateMode === "month" ? "month" : "day",
        direction: form.direction,
        category: form.category,
        amount,
        description: form.description || null,
        excluded_from_balance: isPreJuly ? form.excluded : false,
        ...(proof ? { proof_path: proof.path, proof_name: proof.name } : {}),
      };

      if (editing) {
        const { error } = await supabase
          .from("balance_transactions")
          .update({
            ...payload,
            updated_by: uid,
            verified_by: null,
            verified_at: null,
          })
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("balance_transactions")
          .insert({ ...payload, created_by: uid, updated_by: uid });
        if (error) throw error;
      }
      setDialogOpen(false);
      await load();
      toast({ title: editing ? "Transaction updated" : "Transaction added" });
    } catch (e) {
      toast({ title: "Save failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const verify = async (t: Txn) => {
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("balance_transactions")
      .update({ verified_by: auth.user?.id ?? null, verified_at: new Date().toISOString() })
      .eq("id", t.id);
    if (error) {
      toast({ title: "Could not verify", variant: "destructive" });
      return;
    }
    await load();
  };

  const voidTxn = async (t: Txn) => {
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("balance_transactions")
      .update({
        status: "void",
        updated_by: auth.user?.id ?? null,
        verified_by: null,
        verified_at: null,
      })
      .eq("id", t.id);
    if (error) {
      toast({ title: "Could not void", variant: "destructive" });
      return;
    }
    setVoidConfirm(null);
    await load();
    toast({ title: "Transaction voided (kept in history)" });
  };

  const restoreTxn = async (t: Txn) => {
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("balance_transactions")
      .update({
        status: "active",
        updated_by: auth.user?.id ?? null,
        verified_by: null,
        verified_at: null,
      })
      .eq("id", t.id);
    if (error) {
      toast({ title: "Could not restore", variant: "destructive" });
      return;
    }
    await load();
    toast({ title: "Transaction restored — now Unverified" });
  };

  const settleCharge = async (charge: Charge, mode: "deducted" | "paid_separately") => {
    if (!account) return;
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id ?? null;
    let transaction_id: string | null = null;
    if (mode === "deducted") {
      const total = charge.rent_amount + charge.netflix_amount;
      const { data, error } = await supabase
        .from("balance_transactions")
        .insert({
          account_id: account.id,
          occurred_on: `${charge.period}-01`,
          date_precision: "month",
          direction: "minus",
          category: "Gibbs Monthly Charge",
          amount: total,
          description: `${monthLabel(charge.period)} monthly charge (Rent ${charge.rent_amount.toLocaleString()} + Netflix ${charge.netflix_amount.toLocaleString()})`,
          created_by: uid,
          updated_by: uid,
        })
        .select("id")
        .single();
      if (error) {
        toast({ title: "Could not settle", description: error.message, variant: "destructive" });
        return;
      }
      transaction_id = data.id;
    }
    await supabase
      .from("balance_monthly_charges")
      .update({ status: mode, transaction_id, settled_by: uid, settled_at: new Date().toISOString() })
      .eq("id", charge.id);
    await load();
  };

  const updateChargeAmounts = async (charge: Charge, rent: number, netflix: number) => {
    await supabase
      .from("balance_monthly_charges")
      .update({ rent_amount: rent, netflix_amount: netflix })
      .eq("id", charge.id);
    await load();
  };

  const uploadSource = async (slot: SourceFile, file: File) => {
    if (!account) return;
    try {
      const path = `${account.id}/sources/slot-${slot.slot}-${crypto.randomUUID()}-${file.name}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, file);
      if (error) throw error;
      const { data: auth } = await supabase.auth.getUser();
      await supabase
        .from("balance_source_files")
        .update({
          file_path: path,
          file_name: file.name,
          uploaded_by: auth.user?.id ?? null,
          uploaded_at: new Date().toISOString(),
        })
        .eq("id", slot.id);
      await load();
      toast({ title: "Source image saved" });
    } catch (e) {
      toast({ title: "Upload failed", description: (e as Error).message, variant: "destructive" });
    }
  };

  if (accountLoading || loading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 py-10 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading balance…
        </CardContent>
      </Card>
    );
  }

  if (!account) {
    return (
      <Card>
        <CardContent className="py-10 text-sm text-muted-foreground">
          No balance ledger is linked to your account.
        </CardContent>
      </Card>
    );
  }

  const displayName = (uid: string | null) => {
    if (!uid) return "team";
    if (uid === account.user_id) return "Gibbs";
    return names[uid] ?? "Jerica";
  };

  const pendingCharge = charges.find((c) => c.status === "pending");
  const showPreJulyToggle = form.dateMode !== "unknown" && form.occurred_on < OPENING_CUTOFF;


  return (
    <div className="space-y-6">
      {/* Summary */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5" /> Gibbs Balance
              </CardTitle>
              <CardDescription>Derived from the ledger below — never edited directly.</CardDescription>
            </div>
            <Button onClick={openAdd} size="sm">
              <Plus className="mr-1 h-4 w-4" /> Add Transaction
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
            <div className="flex flex-col justify-center rounded-lg border bg-primary/10 p-4">
              <p className="text-sm text-muted-foreground">Running Balance Owed to Gibbs</p>
              <p className="mt-1 text-3xl font-bold tabular-nums text-primary sm:text-4xl">
                {PHP(balance)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Cumulative total of every balance-affecting entry below.
              </p>
            </div>

            {/* What made up the month in focus */}
            <div className="rounded-lg border p-4">
              <p className="text-sm font-medium">
                {monthLabel(monthSummary.period)} breakdown
              </p>
              <div className="mt-3 space-y-1.5 text-sm">
                {[
                  { label: "Salary", value: monthSummary.salary },
                  { label: "Overtime", value: monthSummary.overtime },
                  { label: "Rent & Netflix", value: monthSummary.charges },
                  { label: "Payments received from Jerica", value: monthSummary.payments },
                  ...(monthSummary.other !== 0
                    ? [{ label: "Other entries", value: monthSummary.other }]
                    : []),
                ].map((line) => (
                  <div key={line.label} className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">{line.label}</span>
                    <span
                      className={`tabular-nums font-medium ${
                        line.value < 0 ? "text-destructive" : "text-success"
                      }`}
                    >
                      {line.value < 0 ? "−" : "+"} {PHP(Math.abs(line.value))}
                    </span>
                  </div>
                ))}
                <Separator className="my-2" />
                <div className="flex items-center justify-between gap-3 font-semibold">
                  <span>Change this month</span>
                  <span
                    className={`tabular-nums ${
                      monthSummary.net < 0 ? "text-destructive" : "text-success"
                    }`}
                  >
                    {monthSummary.net < 0 ? "−" : "+"} {PHP(Math.abs(monthSummary.net))}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            PLUS increases what Jerica owes Gibbs. MINUS reduces it. Voiding removes an entry from the
            running balance but never deletes it — use Undo / Restore to bring it back.
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Upcoming schedule */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Upcoming salary schedule</CardTitle>
            <CardDescription>Eastern Time calendar. Salary accrues automatically; payments never do.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <span>1st of every month</span>
              <span className="font-semibold text-success">+ {PHP(account.monthly_salary)}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              One monthly salary of PHP{account.monthly_salary.toLocaleString("en-PH")} on the 1st, Eastern Time.
              {" "}Approved overtime is separate. Actual payments reduce the balance and are recorded separately.
            </p>
          </CardContent>
        </Card>

        {/* Monthly charges */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Gibbs monthly charges</CardTitle>
            <CardDescription>Rent and Netflix, settled once per month.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {charges.length === 0 && <p className="text-muted-foreground">No monthly charges yet.</p>}
            {charges.slice(-4).map((c) => (
              <div key={c.id} className="rounded-lg border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{monthLabel(c.period)}</span>
                  <Badge variant={c.status === "pending" ? "secondary" : "default"}>
                    {c.status === "pending"
                      ? "Pending"
                      : c.status === "deducted"
                        ? "Deducted from balance"
                        : "Paid separately"}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Rent {PHP(c.rent_amount)} + Netflix {PHP(c.netflix_amount)} ={" "}
                  {PHP(c.rent_amount + c.netflix_amount)}
                </p>
                {c.status === "pending" && (
                  <div className="mt-3 space-y-2">
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        defaultValue={c.rent_amount}
                        className="h-8"
                        aria-label="Rent amount"
                        onBlur={(e) => updateChargeAmounts(c, Number(e.target.value), c.netflix_amount)}
                      />
                      <Input
                        type="number"
                        defaultValue={c.netflix_amount}
                        className="h-8"
                        aria-label="Netflix amount"
                        onBlur={(e) => updateChargeAmounts(c, c.rent_amount, Number(e.target.value))}
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => settleCharge(c, "deducted")}>
                        Deduct from balance
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => settleCharge(c, "paid_separately")}>
                        Paid separately
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {!pendingCharge && charges.length > 0 && (
              <p className="text-xs text-muted-foreground">No pending month to settle.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* History */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <CardTitle className="text-base">Transaction history</CardTitle>
              <CardDescription>
                Newest entries first. The Balance column is the running total as of that date.
              </CardDescription>
            </div>
            <div className="w-48">
              <Label className="text-xs text-muted-foreground">Show</Label>
              <Select value={monthFilter} onValueChange={setMonthFilter}>
                <SelectTrigger className="mt-1 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All months</SelectItem>
                  {monthOptions.map((m) => (
                    <SelectItem key={m} value={m}>
                      {monthLabel(m)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr className="border-b">
                <th className="p-2 text-left">Date</th>
                <th className="p-2 text-left">Entry</th>
                <th className="p-2 text-right">Amount</th>
                <th className="p-2 text-right">Balance</th>
                <th className="p-2 text-left">Verification</th>
                <th className="p-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-muted-foreground">
                    No entries for this month.
                  </td>
                </tr>
              )}
              {visibleRows.map(({ t, affects, running }) => (
                <tr key={t.id} className={`border-b align-top ${t.status === "void" ? "opacity-50" : ""}`}>
                  <td className="p-2 whitespace-nowrap font-medium">
                    {formatLedgerDate(t.occurred_on, t.date_precision)}
                  </td>
                  <td className="p-2">
                    <Badge
                      variant="outline"
                      className={`mb-1 font-normal ${CATEGORY_CHIP[t.category] ?? ""}`}
                    >
                      {t.category}
                    </Badge>
                    <div className="text-muted-foreground">{t.description ?? "—"}</div>
                    {!affects && t.status === "active" && (
                      <span className="text-xs text-muted-foreground">
                        Already included in opening balance
                      </span>
                    )}
                    {t.status === "void" && <span className="text-xs">Voided</span>}
                    {t.proof_path && (
                      <button
                        className="mt-1 block text-xs text-primary underline"
                        onClick={() => viewFile(t.proof_path as string)}
                      >
                        View {t.proof_name ?? "proof"}
                      </button>
                    )}
                    <div className="mt-1 text-xs text-muted-foreground">
                      Added by {t.created_by ? displayName(t.created_by) : "system"} · last edited{" "}
                      {new Date(t.updated_at).toLocaleDateString()}
                    </div>
                  </td>
                  <td
                    className={`p-2 text-right tabular-nums whitespace-nowrap font-medium ${t.direction === "plus" ? "text-success" : "text-destructive"}`}
                  >
                    {t.direction === "plus" ? "+" : "−"} {PHP(t.amount)}
                  </td>
                  <td className="p-2 text-right tabular-nums whitespace-nowrap">
                    {affects ? PHP(running) : "—"}
                  </td>
                  <td className="p-2 whitespace-nowrap">
                    {t.status === "void" ? (
                      <span className="text-xs text-muted-foreground">Voided</span>
                    ) : t.verified_at ? (
                      <span className="inline-flex items-center gap-1 text-xs text-success">
                        <BadgeCheck className="h-3.5 w-3.5" />
                        Verified by {displayName(t.verified_by)} ·{" "}
                        {new Date(t.verified_at).toLocaleDateString()}
                      </span>
                    ) : (
                      <Button size="sm" variant="outline" className="h-7" onClick={() => verify(t)}>
                        Verify
                      </Button>
                    )}
                  </td>
                  <td className="p-2 text-right whitespace-nowrap">
                    <Button size="sm" variant="ghost" className="h-7" onClick={() => openEdit(t)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    {t.status === "active" ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-destructive"
                        aria-label="Void transaction"
                        onClick={() => setVoidConfirm(t)}
                      >
                        <Ban className="h-3.5 w-3.5" />
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7"
                        onClick={() => restoreTxn(t)}
                      >
                        Undo / Restore
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Source history gallery */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Historical source images</CardTitle>
          <CardDescription>
            Reference only — uploading these never changes the ledger math.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sources.map((s) => (
            <div key={s.id} className="rounded-lg border p-3">
              <div className="flex items-start gap-2">
                <FileImage className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{s.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {s.file_path ? s.file_name : "Not uploaded yet"}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {s.file_path && (
                  <Button size="sm" variant="outline" className="h-7" onClick={() => viewFile(s.file_path as string)}>
                    View
                  </Button>
                )}
                <label className="inline-flex cursor-pointer items-center gap-1 text-xs text-primary">
                  <Upload className="h-3.5 w-3.5" />
                  {s.file_path ? "Replace" : "Upload"}
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadSource(s, f);
                    }}
                  />
                </label>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Void confirmation */}
      <Dialog open={!!voidConfirm} onOpenChange={(o) => !o && setVoidConfirm(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Void this transaction?</DialogTitle>
            <DialogDescription>
              Void this transaction? It will stop affecting the running balance, but it will not be
              deleted. You can restore it later.
            </DialogDescription>
          </DialogHeader>
          {voidConfirm && (
            <p className="text-sm">
              {voidConfirm.direction === "plus" ? "+" : "−"} {PHP(voidConfirm.amount)} —{" "}
              {voidConfirm.description ?? voidConfirm.category}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setVoidConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => voidConfirm && voidTxn(voidConfirm)}
            >
              Void transaction
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add / edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit transaction" : "Add transaction"}</DialogTitle>
            <DialogDescription>
              PLUS increases what Jerica owes Gibbs. MINUS decreases it.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Direction</Label>
                <Select
                  value={form.direction}
                  onValueChange={(v) => setForm({ ...form, direction: v as "plus" | "minus" })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="plus">PLUS (owes more)</SelectItem>
                    <SelectItem value="minus">MINUS (owes less)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Amount (PHP)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select
                value={form.category}
                onValueChange={(v) => setForm({ ...form, category: v as Category })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Date type</Label>
                <Select
                  value={form.dateMode}
                  onValueChange={(v) => setForm({ ...form, dateMode: v as typeof form.dateMode })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="exact">Exact date</SelectItem>
                    <SelectItem value="month">Month only</SelectItem>
                    <SelectItem value="unknown">Date not recorded</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.dateMode !== "unknown" && (
                <div className="space-y-1.5">
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={form.occurred_on}
                    onChange={(e) => setForm({ ...form, occurred_on: e.target.value })}
                  />
                </div>
              )}
            </div>

            {showPreJulyToggle && (
              <div className="flex items-start justify-between gap-3 rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">Already included in opening balance</p>
                  <p className="text-xs text-muted-foreground">
                    On = history only, no effect on today's balance. Off = a real missing adjustment.
                  </p>
                </div>
                <Switch
                  checked={form.excluded}
                  onCheckedChange={(v) => setForm({ ...form, excluded: v })}
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Note</Label>
              <Textarea
                rows={2}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Proof / receipt (optional)</Label>
              <Input
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
              />
              {editing?.proof_name && !proofFile && (
                <p className="text-xs text-muted-foreground">Current: {editing.proof_name}</p>
              )}
            </div>

            <Separator />
            <p className="text-xs text-muted-foreground">
              Saving an edit resets this entry to Unverified.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={saving}>
              {saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              {editing ? "Save changes" : "Add transaction"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
