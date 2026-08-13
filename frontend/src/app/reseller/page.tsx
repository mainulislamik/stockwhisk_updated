"use client";

import Link from "next/link";

export default function ResellerPublicPage() {
  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg,#0f172a,#1e1b4b)" }} className="text-white">
      <div className="container py-5">
        <div className="d-flex justify-content-between align-items-center mb-5">
          <div className="fw-bold fs-4">StockWhisk <span className="text-secondary fs-6">Partners</span></div>
          <div className="d-flex gap-2">
            <Link href="/reseller/login" className="btn btn-outline-light btn-sm">Login</Link>
            <Link href="/reseller/register" className="btn btn-primary btn-sm">Become a reseller</Link>
          </div>
        </div>

        <div className="text-center py-5">
          <h1 className="fw-bold display-5">Grow with StockWhisk — earn a share of the profit</h1>
          <p className="fs-5 text-secondary mx-auto" style={{ maxWidth: 640 }}>
            Refer retail shops with your unique code and earn a fixed percentage of the profit they generate — every month, transparently.
          </p>
          <Link href="/reseller/register" className="btn btn-primary btn-lg mt-3">Become a Reseller →</Link>
        </div>

        <div className="row g-4 mt-4">
          {[
            ["📝", "Register", "Sign up as a partner. Your account is reviewed and approved by our team."],
            ["🔗", "Share your code", "Get a unique referral code & link. Shops that sign up with it are attributed to you."],
            ["💰", "Earn monthly", "Receive a fixed % of each connected shop’s monthly gross profit — tracked in your dashboard."],
          ].map(([icon, title, body]) => (
            <div className="col-md-4" key={title}>
              <div className="card bg-white bg-opacity-10 border-0 text-white h-100">
                <div className="card-body">
                  <div style={{ fontSize: "2rem" }}>{icon}</div>
                  <h5 className="fw-bold mt-2">{title}</h5>
                  <p className="text-secondary mb-0">{body}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
