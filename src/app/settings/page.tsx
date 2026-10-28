"use client";
import { useEffect, useState } from "react";

export default function SettingsPage() {
  const [gmail, setGmail] = useState<any>(null);
  const [msg, setMsg] = useState("");

  async function load() {
    const r = await fetch("/api/gmail/status");
    setGmail(await r.json());
  }

  useEffect(() => {
    load();
    const params = new URLSearchParams(window.location.search);
    if (params.get("gmail") === "connected") setMsg("Gmail connected successfully.");
    else if (params.get("gmail") === "error") setMsg("Gmail connection failed: " + (params.get("reason") || "unknown"));
  }, []);

  async function connect() {
    const r = await fetch("/api/gmail/auth-url");
    const data = await r.json();
    if (!r.ok) { setMsg(data.error || "Not configured"); return; }
    window.location.href = data.url;
  }

  async function disconnect() {
    await fetch("/api/gmail/disconnect", { method: "POST" });
    load();
    setMsg("Disconnected.");
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <div className="card p-5 space-y-4">
        <h2 className="font-semibold">Gmail (OAuth 2.0)</h2>
        {gmail && (
          <div className="text-sm space-y-2">
            <div>Configured: <b>{gmail.configured ? "Yes" : "No"}</b></div>
            <div>Connected: <b>{gmail.connected ? "Yes" : "No"}</b></div>
            {gmail.email && <div>Account: <b>{gmail.email}</b></div>}
            <div className="text-xs text-slate-500">Redirect URI: {gmail.redirectUri}</div>
          </div>
        )}
        {msg && <div className="text-sm text-slate-700 bg-slate-100 rounded-lg p-3">{msg}</div>}
        <div className="flex gap-2">
          {!gmail?.connected ? (
            <button className="btn-primary" onClick={connect} disabled={!gmail?.configured}>Connect Gmail</button>
          ) : (
            <button className="btn-secondary" onClick={disconnect}>Disconnect</button>
          )}
        </div>
        {!gmail?.configured && (
          <div className="text-sm bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-3 space-y-2">
            <p className="font-medium">Gmail OAuth not configured.</p>
            <ol className="list-decimal ml-5 space-y-1 text-xs">
              <li>Create a Google Cloud project and enable the Gmail API.</li>
              <li>Create OAuth 2.0 credentials (Web application).</li>
              <li>Add authorized redirect URI: <code>{gmail?.redirectUri}</code></li>
              <li>Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI in .env.local.</li>
              <li>Restart the dev server.</li>
            </ol>
          </div>
        )}
      </div>

      <div className="card p-5 space-y-2 text-sm text-slate-600">
        <h2 className="font-semibold text-slate-900">AI Personalization</h2>
        <p>Set OPENAI_API_KEY (and optionally OPENAI_BASE_URL, OPENAI_MODEL) in .env.local to enable AI personalization. Without it, a template fallback is used.</p>
      </div>
    </div>
  );
}
