import { useEffect, useState } from "react";
import { api } from "../lib/api";

type WorkflowStatus = "Pending" | "Processing" | "Completed";

interface DeletionRequest {
  id: string;
  userId: string | null;
  name: string;
  emailMasked: string;
  phoneMasked: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  createdAt: string;
  status: "new" | "read" | "replied" | "closed";
  workflowStatus: WorkflowStatus;
  source: string;
}

const WORKFLOW_STYLE: Record<WorkflowStatus, string> = {
  Pending: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  Processing: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  Completed: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
};

export default function DeletionRequests() {
  const [requests, setRequests] = useState<DeletionRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selected, setSelected] = useState<DeletionRequest | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function load() {
    setError("");
    try {
      const d = await api.getDeletionRequests({
        status: statusFilter,
        page: 1,
        limit: 50,
      });
      setRequests((d.requests ?? []) as DeletionRequest[]);
      setTotal(d.total ?? 0);
      setPendingCount(d.pendingCount ?? 0);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load deletion requests");
    }
    setLoading(false);
  }

  useEffect(() => {
    setLoading(true);
    void load();
  }, [statusFilter]);

  async function setStatus(id: string, status: "read" | "replied" | "closed" | "new") {
    setBusyId(id);
    try {
      await api.updateContactMessage(id, { status });
      await load();
      setSelected((prev) => (prev?.id === id ? { ...prev, status, workflowStatus: status === "new" ? "Pending" : status === "closed" ? "Completed" : "Processing" } : prev));
    } catch (e: any) {
      setError(e?.message ?? "Failed to update status");
    }
    setBusyId(null);
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-white">Account Deletion Requests</h2>
          <p className="text-slate-400 text-sm mt-1">
            From <span className="text-slate-300">skillad.in/delete-account</span> via Contact Messages.
            In-app Profile → Delete Account deletes immediately and does not appear here.
          </p>
        </div>
        <button
          onClick={() => { setLoading(true); void load(); }}
          className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-white"
        >
          ↻ Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="rounded-xl p-4 bg-slate-900 border border-slate-800">
          <p className="text-2xl font-bold text-white">{total}</p>
          <p className="text-xs text-slate-400 mt-1">Total requests</p>
        </div>
        <div className="rounded-xl p-4 bg-amber-500/10 border border-amber-500/20">
          <p className="text-2xl font-bold text-amber-400">{pendingCount}</p>
          <p className="text-xs text-slate-400 mt-1">Pending (new)</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          { key: "all", label: "All" },
          { key: "new", label: "Pending" },
          { key: "read", label: "Processing (read)" },
          { key: "replied", label: "Processing (replied)" },
          { key: "closed", label: "Completed" },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setStatusFilter(f.key)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              statusFilter === f.key
                ? "bg-orange-500/20 border-orange-500/40 text-orange-400"
                : "bg-slate-800 border-slate-700 text-slate-400 hover:text-white"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center h-32">
            <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <p className="font-medium text-slate-400">No account deletion requests</p>
            <p className="text-sm mt-1">Web form submissions with subject “Account deletion request” appear here</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left px-4 py-3 text-xs text-slate-500 font-medium">Requested</th>
                <th className="text-left px-4 py-3 text-xs text-slate-500 font-medium">Name</th>
                <th className="text-left px-4 py-3 text-xs text-slate-500 font-medium">Phone</th>
                <th className="text-left px-4 py-3 text-xs text-slate-500 font-medium">User ID</th>
                <th className="text-left px-4 py-3 text-xs text-slate-500 font-medium">Status</th>
                <th className="text-left px-4 py-3 text-xs text-slate-500 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => {
                const d = new Date(r.createdAt);
                return (
                  <tr key={r.id} className="border-b border-slate-800/60 hover:bg-slate-800/30">
                    <td className="px-4 py-3 text-slate-400 whitespace-nowrap text-xs">
                      {d.toLocaleString("en-IN")}
                    </td>
                    <td className="px-4 py-3 text-slate-200">{r.name || "—"}</td>
                    <td className="px-4 py-3 font-mono text-slate-300 text-xs">{r.phoneMasked}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">
                      {r.userId ? `${r.userId.slice(0, 8)}…` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full border ${WORKFLOW_STYLE[r.workflowStatus]}`}>
                        {r.workflowStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          onClick={() => setSelected(r)}
                          className="text-xs px-2 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:text-white"
                        >
                          View
                        </button>
                        {r.status === "new" && (
                          <button
                            disabled={busyId === r.id}
                            onClick={() => void setStatus(r.id, "read")}
                            className="text-xs px-2 py-1 rounded-lg bg-blue-500/15 border border-blue-500/30 text-blue-300"
                          >
                            Start
                          </button>
                        )}
                        {r.status !== "closed" && (
                          <button
                            disabled={busyId === r.id}
                            onClick={() => void setStatus(r.id, "closed")}
                            className="text-xs px-2 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300"
                          >
                            Complete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setSelected(null)} />
          <div className="relative z-10 w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-700 p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-white">Deletion request</h3>
                <p className="text-xs text-slate-500 font-mono mt-1">{selected.id}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-4"><dt className="text-slate-500">Name</dt><dd className="text-slate-200">{selected.name}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-slate-500">Phone</dt><dd className="text-slate-200 font-mono">{selected.phone}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-slate-500">Email</dt><dd className="text-slate-200">{selected.email}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-slate-500">User ID</dt><dd className="text-slate-200 font-mono text-xs break-all">{selected.userId ?? "Not matched"}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-slate-500">Status</dt><dd className="text-slate-200">{selected.workflowStatus} ({selected.status})</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-slate-500">Requested</dt><dd className="text-slate-200">{new Date(selected.createdAt).toLocaleString("en-IN")}</dd></div>
            </dl>
            <div>
              <p className="text-xs text-slate-500 mb-1">Message</p>
              <pre className="text-xs text-slate-300 whitespace-pre-wrap bg-slate-950 rounded-xl p-3 border border-slate-800">{selected.message}</pre>
            </div>
            <p className="text-xs text-slate-500">
              After verifying the requester, delete the account from Users (admin delete) or ask the user to use in-app Delete Account, then mark this request Completed.
            </p>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => void setStatus(selected.id, "read")} className="text-xs px-3 py-2 rounded-lg bg-blue-500/20 text-blue-300 border border-blue-500/30">Mark Processing</button>
              <button onClick={() => void setStatus(selected.id, "closed")} className="text-xs px-3 py-2 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">Mark Completed</button>
              <button onClick={() => void setStatus(selected.id, "new")} className="text-xs px-3 py-2 rounded-lg bg-slate-800 text-slate-300 border border-slate-700">Reset Pending</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
