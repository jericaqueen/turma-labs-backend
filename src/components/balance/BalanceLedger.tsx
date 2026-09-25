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
  easternToday,
  monthLabel,
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

const emptyForm = {
  direction: "plus" as "plus" | "minus",
  category: "Adjustment" as Category,
  amount: "",
  dateMode: "exact" as "exact" | "month" | "unknown",
  occurred_on: easternToday(),
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

  const today = easternToday();
  const currentPeriod = today.slice(0, 7);

  const load = useCallback(async () => {
    if (!account) return;
    const [t, c, s, p] = await Promise.all([
      supabase.from("balance_transactions").select("*").eq("account_id", account.id),
      supabase.from("balance_monthly_charges").select("*").eq("account_id", account.id),
      supabase.from("balance_source_files").select("*").eq("account_id", account.id).order("slot"),
      supabase.from("profiles").select("user_id,name"),
    ]);
    setTxns(
      ((t.data ?? []) as unknown as Txn[])
        .map((r) => ({ ...r, amount: Number(r.amount) }))
        .sort(
          (a, b) =>
            a.ordinal - b.ordinal ||
            (a.occurred_on ?? "9999-12-31").localeCompare(b.occurred_on ?? "9999-12-31") ||
            a.created_at.localeCompare(b.created_at)
        )
    );
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
    const { data: existing } = await supabase
      .from("balance_transactions")
      .select("schedule_key")
      .eq("account_id", account.id)
      .not("schedule_key", "is", null);
    const have = new Set((existing ?? []).map((r) => r.schedule_key as string));
    const missing = due.filter((d) => !have.has(d.schedule_key));
    if (missing.length) {
      await supabase.from("balance_transactions").insert(
        missing.map((d) => ({
          account_id: account.id,
          occurred_on: d.occurred_on,
          direction: "plus",
          category: "Salary",
          amount: d.amount,
          description: d.description,
          schedule_key: d.schedule_key,
        }))
      );
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
  }, [account, currentPeriod, today]);

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
          <div className="rounded-lg border bg-primary/10 p-4">
            <p className="text-sm text-muted-foreground">Running Balance Owed to Gibbs</p>
            <p className="mt-1 text-3xl font-bold tabular-nums text-primary sm:text-4xl">
              {PHP(balance)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Cumulative total of every balance-affecting entry below.
            </p>
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
              Eastern Time (America/New_York). Salary accrues automatically on the 1st of each month;
              payments never do. Next automatic salary cycle begins October 1, 2026.
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
          <CardTitle className="text-base">Transaction history</CardTitle>
          <CardDescription>Running balance is recalculated from every balance-affecting row.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr className="border-b">
                <th className="p-2 text-left">Date</th>
                <th className="p-2 text-left">Description</th>
                <th className="p-2 text-left">Category</th>
                <th className="p-2 text-right">Amount</th>
                <th className="p-2 text-right">Balance</th>
                <th className="p-2 text-left">Verification</th>
                <th className="p-2 text-left">Audit</th>
                <th className="p-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ t, affects, running }) => (
                <tr key={t.id} className={`border-b align-top ${t.status === "void" ? "opacity-50" : ""}`}>
                  <td className="p-2 whitespace-nowrap">{formatLedgerDate(t.occurred_on, t.date_precision)}</td>
                  <td className="p-2">
                    <div>{t.description ?? "—"}</div>
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
                  </td>
                  <td className="p-2 whitespace-nowrap">{t.category}</td>
                  <td
                    className={`p-2 text-right tabular-nums whitespace-nowrap ${t.direction === "plus" ? "text-success" : "text-destructive"}`}
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
                  <td className="p-2 text-xs text-muted-foreground whitespace-nowrap">
                    <div>Added by {t.created_by ? displayName(t.created_by) : "system"}</div>
                    <div>Edited {new Date(t.updated_at).toLocaleDateString()}</div>
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