"use client";

import { useLanguage } from "@/contexts/LanguageContext";

import { useCallback, useEffect, useState } from "react";
import { api, fetchAll } from "@/lib/api";
import { ErrorState, PageHeader, Spinner, fmtDate } from "@/components/ui";
import toast from "react-hot-toast";

type ShopDataBackup = {
  id: string;
  shop: number;
  shop_name: string;
  created_by_name: string;
  created_at: string;
  expires_at: string;
  status: string;
  records_count: number;
};

type ShopDataOperation = {
  id: number;
  shop: number;
  shop_name: string;
  operation_type: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  error_message: string;
  initiated_by_name: string | null;
};

type Shop = {
  id: number;
  name: string;
  shop_code?: string;
};

export default function ShopDataPage() {
  const { lang, t } = useLanguage();
  const [backups, setBackups] = useState<ShopDataBackup[] | null>(null);
  const [operations, setOperations] = useState<ShopDataOperation[] | null>(null);
  const [shops, setShops] = useState<Shop[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState<string | null>(null);

  // Form states
  const [selectedShopId, setSelectedShopId] = useState("");
  const [confirmationText, setConfirmationText] = useState("");
  const [password, setPassword] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await api<{ backups: ShopDataBackup[], operations: ShopDataOperation[] }>("/platform/shop-data/");
      setBackups(data.backups || []);
      setOperations(data.operations || []);
      
      const shopsData = await fetchAll<Shop>("/platform/shops/");
      setShops(shopsData);
    } catch (e: any) {
      setError(e?.message || "Failed to load data.");
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  
  // Auto-refresh operations every 10 seconds if any are running
  useEffect(() => {
    if (!operations) return;
    const hasRunning = operations.some(op => op.status === "started");
    if (hasRunning) {
      const timer = setInterval(() => {
        api<{ backups: ShopDataBackup[], operations: ShopDataOperation[] }>("/platform/shop-data/")
          .then(data => {
            setBackups(data.backups);
            setOperations(data.operations);
          })
          .catch(() => {});
      }, 5000);
      return () => clearInterval(timer);
    }
  }, [operations]);

  const handleClear = async (e: React.FormEvent) => {
    e.preventDefault();
    if (confirmationText !== "CLEAR SHOP DATA") {
      toast.error("Confirmation text must exactly match 'CLEAR SHOP DATA'");
      return;
    }
    
    setBusy(true);
    try {
      await api("/platform/shop-data/clear/", {
        method: "POST",
        body: {
          shop_id: parseInt(selectedShopId),
          password,
          confirmation_text: confirmationText
        }
      });
      toast.success("Clear operation queued successfully.");
      setShowClearModal(false);
      setPassword("");
      setConfirmationText("");
      load();
    } catch (e: any) {
      toast.error(e?.message || "Failed to initiate clear.");
    } finally {
      setBusy(false);
    }
  };

  const handleRestore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showRestoreModal) return;
    
    setBusy(true);
    try {
      await api("/platform/shop-data/restore/", {
        method: "POST",
        body: {
          backup_id: showRestoreModal,
          password
        }
      });
      toast.success("Restore operation queued successfully.");
      setShowRestoreModal(null);
      setPassword("");
      load();
    } catch (e: any) {
      toast.error(e?.message || "Failed to initiate restore.");
    } finally {
      setBusy(false);
    }
  };

  if (error) return <ErrorState error={error} />;
  if (!backups || !operations) return <Spinner />;

  return (
    <>
      <PageHeader
        title="Shop Data Management"
      />

      <div className="alert alert-danger shadow-sm border-danger border-opacity-50">
        <h5 className="alert-heading text-danger fw-bold"><i className="bi bi-exclamation-triangle-fill me-2"></i>{lang === "bn" ? "সতর্কতা অঞ্চল: শপের অপারেশনাল ডাটা মুছে ফেলুন" : "Danger Zone: Clear Shop Operational Data"}</h5>
        <p className="mb-3">
          This utility permanently deletes a shop's <strong>operational data</strong> (sales, inventory, customers, expenses, products) 
          while preserving the shop's configuration, users, and subscription data.
          A 15-day recovery backup is created before deletion.
        </p>
        <div className="d-flex align-items-center gap-3">
          <select 
            className="form-select w-auto" 
            value={selectedShopId} 
            onChange={(e) => setSelectedShopId(e.target.value)}
          >
            <option value="">{lang === "bn" ? "-- ডাটা মুছে ফেলার জন্য শপ নির্বাচন করুন --" : "-- Select a shop to clear --"}</option>
            {shops.map(s => (
              <option key={s.id} value={s.id}>{s.name} ({s.shop_code || `SW-${1000 + s.id}`})</option>
            ))}
          </select>
          <button 
            className="btn btn-danger fw-semibold" 
            disabled={!selectedShopId}
            onClick={() => { setPassword(""); setConfirmationText(""); setShowClearModal(true); }}
          >
            Clear Selected Shop
          </button>
        </div>
      </div>

      <div className="row mt-4">
        <div className="col-lg-8">
          <div className="card shadow-sm mb-4">
            <div className="card-header bg-white">
              <h5 className="mb-0 fw-semibold">{lang === "bn" ? "১৫ দিনের রিকভারি ব্যাকআপসমূহ" : "15-Day Recovery Backups"}</h5>
            </div>
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="thead-1">
                  <tr>
                    <th>Shop</th>
                    <th>Records</th>
                    <th>Expires</th>
                    <th>Status</th>
                    <th className="text-end">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {backups.length === 0 && (
                    <tr><td colSpan={5} className="text-center text-muted py-4">{lang === "bn" ? "কোনো ব্যাকআপ পাওয়া যায়নি।" : "No active backups available."}</td></tr>
                  )}
                  {backups.map(b => (
                    <tr key={b.id}>
                      <td className="fw-semibold">{b.shop_name}</td>
                      <td>{b.records_count.toLocaleString()}</td>
                      <td>{fmtDate(b.expires_at)}</td>
                      <td>
                        <span className={`badge ${
                          b.status === 'verified' ? 'bg-success' : 
                          b.status === 'restored' ? 'bg-primary' : 
                          'bg-secondary'
                        }`}>{b.status.toUpperCase()}</span>
                      </td>
                      <td className="text-end">
                        <button 
                          className="btn btn-sm btn-outline-primary fw-semibold"
                          disabled={b.status === 'deleted' || b.status === 'restored'}
                          onClick={() => { setPassword(""); setShowRestoreModal(b.id); }}
                        >
                          Restore
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="col-lg-4">
          <div className="card shadow-sm">
            <div className="card-header bg-white">
              <h5 className="mb-0 fw-semibold">Recent Operations</h5>
            </div>
            <div className="list-group list-group-flush" style={{ maxHeight: "500px", overflowY: "auto" }}>
              {operations.length === 0 && (
                <div className="text-center text-muted py-4 px-3">No recent operations.</div>
              )}
              {operations.map(op => (
                <div key={op.id} className="list-group-item py-3">
                  <div className="d-flex w-100 justify-content-between align-items-center mb-1">
                    <h6 className="mb-0 fw-bold">{op.operation_type.toUpperCase()} - {op.shop_name}</h6>
                    <small className="text-muted">{fmtDate(op.started_at)}</small>
                  </div>
                  <div className="d-flex align-items-center gap-2">
                    <span className={`badge ${
                      op.status === 'completed' ? 'bg-success' : 
                      op.status === 'started' ? 'bg-warning text-dark' : 'bg-danger'
                    }`}>
                      {op.status === 'started' && <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>}
                      {op.status.toUpperCase()}
                    </span>
                    <small className="text-muted">by {op.initiated_by_name || 'System'}</small>
                  </div>
                  {op.error_message && (
                    <div className="mt-2 small text-danger bg-danger bg-opacity-10 p-2 rounded border border-danger border-opacity-25">
                      {op.error_message}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Clear Confirmation Modal */}
      {showClearModal && (
        <div className="modal show d-block" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-danger">
              <form onSubmit={handleClear}>
                <div className="modal-header bg-danger text-white">
                  <h5 className="modal-title">Confirm Destructive Action</h5>
                  <button type="button" className="btn-close btn-close-white" onClick={() => setShowClearModal(false)}></button>
                </div>
                <div className="modal-body">
                  <p className="text-danger fw-semibold">
                    You are about to clear all operational data for the selected shop.
                  </p>
                  <p className="small text-muted mb-4">
                    This includes all sales, inventory, products, and customers. A 15-day backup will be created.
                    Please type <strong>CLEAR SHOP DATA</strong> below to confirm.
                  </p>
                  <div className="mb-3">
                    <input 
                      type="text" 
                      className="form-control fw-bold text-danger" 
                      placeholder="CLEAR SHOP DATA" 
                      value={confirmationText}
                      onChange={e => setConfirmationText(e.target.value)}
                      autoComplete="off"
                      required
                    />
                  </div>
                  <div className="mb-2">
                    <label className="form-label small fw-semibold">Your Superadmin Password</label>
                    <input 
                      type="password" 
                      className="form-control" 
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="modal-footer bg-light">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowClearModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-danger fw-semibold" disabled={busy || !password}>
                    {busy ? <Spinner /> : "Execute Clear Operation"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Restore Confirmation Modal */}
      {showRestoreModal && (
        <div className="modal show d-block" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-primary">
              <form onSubmit={handleRestore}>
                <div className="modal-header bg-primary text-white">
                  <h5 className="modal-title">Confirm Restore</h5>
                  <button type="button" className="btn-close btn-close-white" onClick={() => setShowRestoreModal(null)}></button>
                </div>
                <div className="modal-body">
                  <p className="fw-semibold">
                    You are about to restore a 15-day backup for this shop.
                  </p>
                  <p className="small text-muted mb-4">
                    Any operational data created since the backup was taken will be permanently overwritten.
                  </p>
                  <div className="mb-2">
                    <label className="form-label small fw-semibold">Your Superadmin Password</label>
                    <input 
                      type="password" 
                      className="form-control" 
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="modal-footer bg-light">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowRestoreModal(null)}>Cancel</button>
                  <button type="submit" className="btn btn-primary fw-semibold" disabled={busy || !password}>
                    {busy ? <Spinner /> : "Execute Restore Operation"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
