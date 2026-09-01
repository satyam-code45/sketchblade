"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type StoredKey = {
  id: string;
  provider: string;
  label: string;
  last4: string;
  lastUsedAt: string | null;
};

const MODELS = [
  { id: "gpt-5-nano", price: "$0.05 / $0.40" },
  { id: "gpt-4.1-nano", price: "$0.10 / $0.40" },
  { id: "gpt-6-luna", price: "$0.10 / $0.50" },
  { id: "gpt-4o-mini", price: "$0.15 / $0.60" },
  { id: "gpt-5.6-luna", price: "$0.20 / $1.20" },
  { id: "gpt-5.6-terra", price: "$2.00 / $12.00" },
];

const TASKS = [
  { field: "modelDiagram", label: "Diagram generation" },
  { field: "modelEvaluate", label: "Evaluate a board" },
  { field: "modelEdit", label: "Suggest edits" },
  { field: "modelChat", label: "Room chat" },
] as const;

type Preference = Partial<Record<(typeof TASKS)[number]["field"], string | null>> & {
  credentialId?: string | null;
};

export default function KeyManager() {
  const [keys, setKeys] = useState<StoredKey[]>([]);
  const [pref, setPref] = useState<Preference>({});
  const [label, setLabel] = useState("");
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const auth = () => ({ authorization: localStorage.getItem("token") ?? "" });

  const load = useCallback(async () => {
    const [k, p] = await Promise.all([
      fetch("/api/ai/keys", { headers: auth() }).then((r) => r.json()),
      fetch("/api/ai/preferences", { headers: auth() }).then((r) => r.json()),
    ]);
    setKeys(k.keys ?? []);
    setPref(p.preference ?? {});
  }, []);

  useEffect(() => { void load(); }, [load]);

  const addKey = async () => {
    setBusy(true);
    setError("");
    const res = await fetch("/api/ai/keys", {
      method: "POST",
      headers: { ...auth(), "content-type": "application/json" },
      body: JSON.stringify({ provider: "openai", label, key }),
    });
    setBusy(false);
    if (!res.ok) return setError((await res.json()).message ?? "Could not add that key.");
    setLabel("");
    setKey("");
    void load();
  };

  const removeKey = async (id: string) => {
    await fetch(`/api/ai/keys/${id}`, { method: "DELETE", headers: auth() });
    void load();
  };

  const savePref = async (patch: Preference) => {
    setPref((p) => ({ ...p, ...patch }));
    await fetch("/api/ai/preferences", {
      method: "PUT",
      headers: { ...auth(), "content-type": "application/json" },
      body: JSON.stringify(patch),
    });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-8 p-6">
      <div>
        <h1 className="text-xl font-semibold">AI settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Add your own provider key to lift the free-tier limit. Keys are encrypted and never shown again.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Your keys</h2>

        {keys.length === 0 ? (
          <p className="rounded-lg border border-border/60 p-4 text-sm text-muted-foreground">
            No keys yet — AI features run on the shared free tier.
          </p>
        ) : (
          <ul className="space-y-2">
            {keys.map((k) => (
              <li key={k.id} className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2">
                <span className="text-sm">
                  <span className="font-medium">{k.label}</span>
                  <span className="ml-2 text-muted-foreground">{k.provider} · sk-…{k.last4}</span>
                </span>
                <span className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <input
                      type="radio"
                      name="active-key"
                      checked={pref.credentialId === k.id}
                      onChange={() => savePref({ credentialId: k.id })}
                    />
                    use this
                  </label>
                  <Button variant="ghost" size="sm" onClick={() => removeKey(k.id)}>Remove</Button>
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="flex gap-2">
          <Input placeholder="Label" value={label} onChange={(e) => setLabel(e.target.value)} className="w-36" />
          <Input
            type="password"
            placeholder="sk-..."
            value={key}
            onChange={(e) => setKey(e.target.value)}
            className="flex-1"
          />
          <Button onClick={addKey} disabled={busy || key.length < 20}>
            {busy ? "Checking…" : "Add"}
          </Button>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Model per task</h2>
        <p className="text-xs text-muted-foreground">Price is input / output per 1M tokens.</p>
        {TASKS.map((t) => (
          <div key={t.field} className="flex items-center justify-between gap-3">
            <span className="text-sm">{t.label}</span>
            <select
              className="h-9 rounded-md border border-border/60 bg-background px-2 text-sm"
              value={pref[t.field] ?? ""}
              onChange={(e) => savePref({ [t.field]: e.target.value || null })}
            >
              <option value="">Default</option>
              {MODELS.map((m) => (
                <option key={m.id} value={m.id}>{m.id} — {m.price}</option>
              ))}
            </select>
          </div>
        ))}
      </section>
    </div>
  );
}
