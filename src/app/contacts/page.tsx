"use client";
import { useEffect, useState, useRef } from "react";

export default function ContactsPage() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [campaignId, setCampaignId] = useState<string>("");
  const [newName, setNewName] = useState("");
  const [contacts, setContacts] = useState<any[]>([]);
  const [pasteText, setPasteText] = useState("");
  const [importMsg, setImportMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function loadCampaigns() {
    const r = await fetch("/api/campaigns");
    const data = await r.json();
    setCampaigns(data);
    if (!campaignId && data.length) setCampaignId(data[0].id);
  }

  async function loadContacts(cid: string) {
    if (!cid) { setContacts([]); return; }
    const r = await fetch(`/api/contacts?campaign_id=${cid}`);
    setContacts(await r.json());
  }

  useEffect(() => { loadCampaigns(); }, []);
  useEffect(() => { loadContacts(campaignId); }, [campaignId]);

  async function createCampaign() {
    if (!newName.trim()) return;
    const r = await fetch("/api/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() }),
    });
    const c = await r.json();
    setCampaigns((prev) => [c, ...prev]);
    setCampaignId(c.id);
    setNewName("");
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !campaignId) return;
    setLoading(true);
    setImportMsg("");
    try {
      const form = new FormData();
      form.append("file", file);
      const r = await fetch(`/api/contacts/import?campaign_id=${campaignId}`, { method: "POST", body: form });
      const text = await r.text();
      let data: any = {};
      try { data = text ? JSON.parse(text) : {}; } catch { data = { error: text || "Import failed" }; }
      if (!r.ok) setImportMsg(data.error || "Import failed");
      else {
        setImportMsg(`Imported ${data.imported} contacts. ${data.errors?.length ? "Malformed: " + data.errors.join("; ") : ""} ${data.duplicates?.length ? "Duplicates: " + [...new Set(data.duplicates)].join(", ") : ""}`);
        loadContacts(campaignId);
      }
    } catch (err: any) {
      setImportMsg(err?.message || "Import failed");
    }
    setLoading(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handlePaste() {
    if (!pasteText.trim() || !campaignId) return;
    setLoading(true);
    setImportMsg("");
    const r = await fetch("/api/contacts/paste", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaign_id: campaignId, text: pasteText }),
    });
    const data = await r.json();
    if (!r.ok) setImportMsg(data.error || "Paste failed");
    else {
      setImportMsg(`Added ${data.imported} contacts. ${data.errors?.length ? "Malformed: " + data.errors.join("; ") : ""} ${data.duplicates?.length ? "Duplicates: " + [...new Set(data.duplicates)].join(", ") : ""}`);
      setPasteText("");
      loadContacts(campaignId);
    }
    setLoading(false);
  }

  async function updateContact(id: string, patch: any) {
    await fetch("/api/contacts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...patch }),
    });
    loadContacts(campaignId);
  }

  async function deleteContact(id: string) {
    await fetch(`/api/contacts?id=${id}`, { method: "DELETE" });
    loadContacts(campaignId);
  }

  async function findEmail(id: string) {
    setImportMsg("");
    const r = await fetch("/api/contacts/find-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const data = await r.json();
    if (!r.ok) setImportMsg(data.error || "Find email failed");
    else if (data.result?.email) {
      setImportMsg(`Found ${data.result.email} (${data.result.verified ? "verified" : "unverified"}, ${data.result.confidence}% via ${data.result.source}).`);
      loadContacts(campaignId);
    } else {
      setImportMsg(data.result?.error || "No email found.");
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Contacts</h1>

      <div className="card p-5 space-y-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="label">Campaign</label>
            <select className="input" value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
              <option value="">Select campaign</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="label">New campaign name</label>
            <input className="input" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Q2 Outreach" />
          </div>
          <button className="btn-secondary" onClick={createCampaign}>Create</button>
        </div>

        {!campaignId && <p className="text-sm text-slate-500">Create or select a campaign to import contacts.</p>}

        {campaignId && (
          <>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="label">Upload CSV / Excel</label>
                <div
                  onDragOver={(e) => { e.preventDefault(); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const f = e.dataTransfer.files?.[0];
                    if (f) {
                      const dt = new DataTransfer();
                      dt.items.add(f);
                      if (fileRef.current) fileRef.current.files = dt.files;
                      handleFile({ target: { files: dt.files } } as any);
                    }
                  }}
                  className="border-2 border-dashed border-slate-300 rounded-lg p-4 text-center text-sm text-slate-500 hover:border-slate-500"
                >
                  <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleFile} className="hidden" id="csv-input" />
                  <button type="button" className="btn-secondary" onClick={() => fileRef.current?.click()}>
                    Choose file
                  </button>
                  <span className="text-xs text-slate-400">or drag & drop here</span>
                </div>
                <p className="text-xs text-slate-500">Columns: name, email, role, organization, notes (flexible headers).</p>
              </div>
              <div className="space-y-2">
                <label className="label">Paste emails</label>
                <textarea
                  className="input"
                  rows={4}
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder={"alice@example.com\nBob <bob@example.com>"}
                />
                <button className="btn-secondary" onClick={handlePaste} disabled={loading}>Add pasted</button>
              </div>
            </div>
            {importMsg && <div className="text-sm text-slate-700 bg-slate-100 rounded-lg p-3">{importMsg}</div>}
          </>
        )}
      </div>

      {campaignId && (
        <div className="card p-5">
          <h2 className="font-semibold mb-3">Contacts ({contacts.length})</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b">
                  <th className="py-2">Name</th>
                  <th className="py-2">Email</th>
                  <th className="py-2">Role</th>
                  <th className="py-2">Org</th>
                  <th className="py-2">LinkedIn</th>
                  <th className="py-2">Status</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((c: any) => (
                  <tr key={c.id} className="border-b last:border-0">
                    <td className="py-2">
                      <input className="input py-1" value={c.name} onChange={(e) => updateContact(c.id, { name: e.target.value })} />
                    </td>
                    <td className="py-2">
                      <input className="input py-1" value={c.email} onChange={(e) => updateContact(c.id, { email: e.target.value })} />
                    </td>
                    <td className="py-2">
                      <input className="input py-1" value={c.role} onChange={(e) => updateContact(c.id, { role: e.target.value })} />
                    </td>
                    <td className="py-2">
                      <input className="input py-1" value={c.org} onChange={(e) => updateContact(c.id, { org: e.target.value })} />
                    </td>
                    <td className="py-2">
                      <input className="input py-1" value={c.linkedin || ""} onChange={(e) => updateContact(c.id, { linkedin: e.target.value })} placeholder="https://linkedin.com/in/..." />
                    </td>
                    <td className="py-2">
                      <span className="text-xs px-2 py-1 rounded-full bg-slate-100">{c.status}</span>
                      {c.email_verified ? <span className="ml-1 text-xs text-green-600">verified</span> : null}
                      {c.excluded ? <span className="ml-1 text-xs text-red-600">excluded</span> : null}
                    </td>
                    <td className="py-2">
                      <div className="flex flex-col gap-1">
                        <button className="text-xs text-blue-600 hover:underline text-left" onClick={() => findEmail(c.id)}>Find email</button>
                        <button className="text-xs text-red-600 hover:underline text-left" onClick={() => deleteContact(c.id)}>Remove</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
