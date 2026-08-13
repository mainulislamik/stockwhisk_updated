"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, setTokens } from "@/lib/api";

export default function ResellerLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      const r = await api<{ access: string; refresh: string }>("/reseller/login/", { method: "POST", body: { email, password } });
      setTokens(r.access, r.refresh);
      router.push("/reseller/dashboard");
    } catch (err: any) {
      setError(err?.data?.detail || "Login failed.");
      setBusy(false);
    }
  }

  return (
    <div className="d-flex align-items-center justify-content-center vh-100" style={{ background: "#0f172a" }}>
      <div className="card shadow-lg border-0" style={{ width: 380, maxWidth: "92vw" }}>
        <div className="card-body p-4">
          <div className="fw-bold fs-4">StockWhisk Partner</div>
          <div className="text-secondary small mb-4">Reseller portal login</div>
          <form onSubmit={submit} className="vstack gap-3">
            <input className="form-control" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <input className="form-control" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            {error && <div className="alert alert-danger py-2 mb-0 small">{error}</div>}
            <button className="btn btn-primary" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
          </form>
          <div className="small mt-3">Not a partner yet? <Link href="/reseller/register">Become a reseller</Link></div>
        </div>
      </div>
    </div>
  );
}
