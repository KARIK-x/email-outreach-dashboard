"use client";
import { useEffect, useState } from "react";

type Stats = {
  totalContacts: number;
  draftsReady: number;
  approved: number;
  sent: number;
  failed: number;
  bounced: number;
  campaigns: number;
};

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [gmail, setGmail] = useState<any>(null);

  async function load() {
    const [s, c, g] = await Promise.all([
      fetch("/api/stats").then((r) => r.json()),
      fetch("/api/campaigns").then((r) => r.json()),
      fetch("/api/gmail/status").then((r) => r.json()),
    ]);
    setStats(s);
    setCampaigns(c);
    setGmail(g);
  }

  useEffect(() => {
    load();
  }, []);

  const cards = stats
    ? [
        { label: "Total contacts", value: stats.totalContacts },
        { label: "Drafts ready", value: stats.draftsReady },
        { label: "Approved", value: stats.approved },
        { label: "Sent (accepted)", value: stats.sent },
        { label: "Failed", value: stats.failed },
        { label: "Bounced", value: stats.bounced },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <div className="text-sm text-slate-500">
          Gmail:{" "}
          <span className={gmail?.connected ? "text-green-600 font-medium" : "text-slate-500"}>
            {gmail?.connected ? gmail.email : gmail?.configured ? "Not connected" : "Not configured"}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="card p-4">
            <div className="text-xs text-slate-500">{c.label}</div>
            <div className="text-2xl font-semibold mt-1">{c.value}</div>
          </div>
        ))}
      </div>

      <div className="card p-5">
        <h2 className="font-semibold mb-3">Campaigns</h2>
        {campaigns.length === 0 ? (
          <p className="text-sm text-slate-500">No campaigns yet. Go to Contacts to create one.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b">
                <th className="py-2">Name</th>
                <th className="py-2">Purpose</th>
                <th className="py-2">Created</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c: any) => (
                <tr key={c.id} className="border-b last:border-0">
                  <td className="py-2 font-medium">{c.name}</td>
                  <td className="py-2 text-slate-600 truncate max-w-xs">{c.purpose}</td>
                  <td className="py-2 text-slate-500">{new Date(c.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
