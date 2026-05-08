"use client";
import { useState, useEffect } from "react";
import { SectionLabel } from "../../components/section-label";

interface ApiKey {
  key: string;
  name: string;
  createdAt: string;
  lastUsedAt: string | null;
  requestCount: number;
  revokedAt: string | null;
}

export default function KeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKey, setNewKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchKeys();
  }, []);

  async function fetchKeys() {
    const res = await fetch("/api/keys");
    const data = await res.json();
    setKeys(data.keys);
    setLoading(false);
  }

  async function createKey() {
    if (!newKeyName.trim()) return;
    setCreating(true);
    const res = await fetch("/api/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newKeyName }),
    });
    const data = await res.json();
    setNewKey(data.key);
    setNewKeyName("");
    setCreating(false);
    fetchKeys();
  }

  async function revokeKey(key: string) {
    await fetch("/api/keys", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key }),
    });
    fetchKeys();
  }

  async function copyKey(key: string) {
    await navigator.clipboard.writeText(key);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  const activeKeys = keys.filter((k) => !k.revokedAt);
  const revokedKeys = keys.filter((k) => k.revokedAt);

  return (
    <div className="max-w-4xl">
      <div className="mb-3">
        <SectionLabel>Authentication</SectionLabel>
      </div>
      <h1 className="text-4xl font-extrabold tracking-tight mb-10">API Keys</h1>

      <div className="bg-surface border border-border rounded-xl p-5 mb-8">
        <h2 className="text-xs font-mono uppercase tracking-widest text-secondary mb-3">Create New Key</h2>
        <div className="flex gap-2">
          <input
            type="text"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            placeholder="Key name (e.g. Production, Development)"
            aria-label="Key name"
            className="flex-1 bg-bg border border-border rounded-lg px-3 py-2 text-sm placeholder:text-secondary outline-none focus:border-accent transition-colors"
          />
          <button
            onClick={createKey}
            disabled={creating || !newKeyName.trim()}
            className="bg-accent hover:brightness-110 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all"
          >
            {creating ? "Creating..." : "Create"}
          </button>
        </div>
        {newKey && (
          <div className="mt-4 p-3 bg-green-900/20 border border-green-800 rounded-lg" role="status" aria-live="polite">
            <p className="text-green-400 text-xs font-medium mb-2">
              Key created — copy it now. You won&apos;t see it again.
            </p>
            <div className="flex items-center gap-2">
              <code className="text-sm text-green-300 bg-green-900/30 px-2 py-1 rounded flex-1 break-all font-mono">
                {newKey}
              </code>
              <button
                onClick={() => copyKey(newKey)}
                className="text-xs text-green-400 hover:text-green-300 px-3 py-1 transition-colors"
              >
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <KeySkeleton />
      ) : (
        <>
          <h2 className="text-xs font-mono uppercase tracking-widest text-secondary mb-3">
            Active Keys ({activeKeys.length})
          </h2>
          {activeKeys.length === 0 ? (
            <div className="bg-surface border border-dashed border-border rounded-xl p-6 text-center">
              <p className="text-secondary text-sm">No active keys yet.</p>
              <p className="text-secondary text-xs mt-1">Create one above to start making API calls.</p>
            </div>
          ) : (
            <div className="space-y-2 mb-8">
              {activeKeys.map((k) => (
                <div
                  key={k.key}
                  className="bg-surface border border-border rounded-xl p-4 flex items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{k.name}</p>
                    <p className="text-xs text-secondary mt-0.5 font-mono">
                      {k.key.slice(0, 12)}…{" "}
                      <span className="font-sans">·</span> {k.requestCount.toLocaleString()} requests{" "}
                      <span className="font-sans">·</span> Created {new Date(k.createdAt).toLocaleDateString()}
                      {k.lastUsedAt && (
                        <>
                          {" "}
                          <span className="font-sans">·</span> Last used {new Date(k.lastUsedAt).toLocaleDateString()}
                        </>
                      )}
                    </p>
                  </div>
                  <button
                    onClick={() => revokeKey(k.key)}
                    className="shrink-0 text-xs text-red-400 hover:text-red-300 px-3 py-1.5 border border-red-800 rounded-lg hover:bg-red-900/20 transition-colors"
                  >
                    Revoke
                  </button>
                </div>
              ))}
            </div>
          )}

          {revokedKeys.length > 0 && (
            <>
              <h2 className="text-xs font-mono uppercase tracking-widest text-secondary mb-3">
                Revoked Keys ({revokedKeys.length})
              </h2>
              <div className="space-y-2 opacity-50">
                {revokedKeys.map((k) => (
                  <div key={k.key} className="bg-surface border border-border rounded-xl p-4">
                    <p className="text-sm font-medium line-through">{k.name}</p>
                    <p className="text-xs text-secondary mt-0.5">
                      Revoked {new Date(k.revokedAt!).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function KeySkeleton() {
  return (
    <div className="space-y-2" aria-hidden>
      {[0, 1].map((i) => (
        <div
          key={i}
          className="bg-surface border border-border rounded-xl p-4 h-16 animate-pulse"
        />
      ))}
    </div>
  );
}
