"use client";

import React from "react";
import Link from "next/link";
import { useAuth } from "./AuthProvider";
import { useLanguage } from "@/contexts/LanguageContext";

interface ModuleRouteGuardProps {
  module: string;
  name?: string;
  children: React.ReactNode;
}

export function ModuleRouteGuard({ module, name, children }: ModuleRouteGuardProps) {
  const { hasModule, loading, user } = useAuth();
  const { lang } = useLanguage();

  if (loading) {
    return (
      <div className="d-flex align-items-center justify-content-center p-5 min-vh-50">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  // Check if current tenant has this module active
  const isAllowed = hasModule(module);

  if (!isAllowed) {
    return (
      <div className="container py-5">
        <div className="row justify-content-center">
          <div className="col-lg-8 col-xl-7">
            <div className="card border shadow-sm rounded-4 text-center p-4 p-md-5 bg-body">
              <div
                className="d-inline-flex align-items-center justify-content-center rounded-circle bg-warning bg-opacity-10 text-warning mb-4 mx-auto"
                style={{ width: 80, height: 80, fontSize: "2.5rem" }}
              >
                <i className="bi bi-lock-fill"></i>
              </div>

              <h3 className="fw-bold text-body mb-2">
                {lang === "bn" ? "মডিউলটি আপনার শপে সক্রিয় নয়" : "Module Not Active for Your Shop"}
              </h3>

              <div className="badge bg-secondary-subtle text-secondary px-3 py-2 rounded-pill mx-auto mb-3 fs-7">
                <code>{module}</code>
              </div>

              <p className="text-secondary fs-6 mb-4">
                {lang === "bn"
                  ? `"${name || module}" মডিউলটি আপনার বর্তমান প্যাকেজ বা শপ সেটিংসে অন্তর্ভুক্ত নয়। এই সুবিধাটি ব্যবহার করতে অনুগ্রহ করে প্ল্যাটফর্ম অ্যাডমিনের সাথে যোগাযোগ করুন অথবা সাবস্ক্রিপশন প্ল্যান আপগ্রেড করুন।`
                  : `The "${name || module}" module is not included in your shop's active plan. Contact the platform administrator or upgrade your subscription to unlock this feature.`}
              </p>

              <div className="d-flex flex-wrap justify-content-center gap-3">
                <Link href="/app" className="btn btn-outline-secondary px-4 py-2 rounded-3">
                  <i className="bi bi-arrow-left me-2"></i>
                  {lang === "bn" ? "ড্যাশবোর্ডে ফিরে যান" : "Return to Dashboard"}
                </Link>
                <Link href="/app/settings" className="btn btn-primary px-4 py-2 rounded-3">
                  <i className="bi bi-shield-check me-2"></i>
                  {lang === "bn" ? "শপ সেটিংস ও প্যাকেজ" : "Shop Settings & Plans"}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
