"use client";
import { useState, useEffect } from "react";

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

  useEffect(() => { fetchKeys(); }, []);

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

  const activeKeys = keys.filter((k) => !k.revokedAt);
  const revokedKeys = keys.filter((k) => k.revokedAt);

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">API Keys</h1>

      {/* Create new key */}
      <div className="bg-surface border border-border rounded-xl p-4 mb-6">
        <h2 className="text-sm font-medium mb-3">Create New Key</h2>
        <div className="flex gap-2">
          <input type="text" value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)}
            placeholder="Key name (e.g., Production, Development)"
            className="flex-1 bg-[#0a0a0a] border border-border rounded-lg px-3 py-2 text-sm placeholder:text-secondary outline-none focus:border-accent" />
          <button onClick={createKey} disabled={creating || !newKeyName.trim()}
            className="bg-accent hover:bg-[#8b5cf6] disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            {creating ? "Creating..." : "Create"}
          </button>
        </div>
        {newKey && (
          <div className="mt-3 p-3 bg-green-900/20 border border-green-800 rounded-lg">
            <p className="text-green-400 text-xs font-medium mb-1">Key created! Copy it now — you won&apos;t see it again.</p>
            <div className="flex items-center gap-2">
              <code className="text-sm text-green-300 bg-green-900/30 px-2 py-1 rounded flex-1 break-all">{newKey}</code>
              <button onClick={() => navigator.clipboard.writeText(newKey)} className="text-xs text-green-400 hover:text-green-300 px-2 py-1">Copy</button>
            </div>
          </div>
        )}
      </div>

      {/* Active keys */}
      {loading ? (
        <p className="text-secondary text-sm">Loading keys...</p>
      ) : (
        <>
          <h2 className="text-sm font-medium text-secondary mb-3">Active Keys ({activeKeys.length})</h2>
          {activeKeys.length === 0 ? (
            <p className="text-secondary text-sm">No active keys. Create one above.</p>
          ) : (
            <div className="space-y-2 mb-6">
              {activeKeys.map((k) => (
                <div key={k.key} className="bg-surface border border-border rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{k.name}</p>
                    <p className="text-xs text-secondary mt-0.5">
                      {k.key.slice(0, 12)}... · {k.requestCount.toLocaleString()} requests · Created {new Date(k.createdAt).toLocaleDateString()}
                      {k.lastUsedAt && <> · Last used {new Date(k.lastUsedAt).toLocaleDateString()}</>}
                    </p>
                  </div>
                  <button onClick={() => revokeKey(k.key)}
                    className="text-xs text-red-400 hover:text-red-300 px-3 py-1.5 border border-red-800 rounded-lg hover:bg-red-900/20 transition-colors">
                    Revoke
                  </button>
                </div>
              ))}
            </div>
          )}

          {revokedKeys.length > 0 && (
            <>
              <h2 className="text-sm font-medium text-secondary mb-3">Revoked Keys ({revokedKeys.length})</h2>
              <div className="space-y-2 opacity-50">
                {revokedKeys.map((k) => (
                  <div key={k.key} className="bg-surface border border-border rounded-xl p-4">
                    <p className="text-sm font-medium line-through">{k.name}</p>
                    <p className="text-xs text-secondary mt-0.5">Revoked {new Date(k.revokedAt!).toLocaleDateString()}</p>
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
