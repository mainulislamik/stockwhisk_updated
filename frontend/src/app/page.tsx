"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { api, getAccess } from "@/lib/api";

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    if (!getAccess()) {
      router.replace("/login");
      return;
    }
    // Send platform staff to the admin dashboard, everyone else to the shop app.
    api<{ is_staff: boolean }>("/auth/me/")
      .then((me) => router.replace(me?.is_staff ? "/platform" : "/app"))
      .catch(() => router.replace("/login"));
  }, [router]);
  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center">
      <span className="spinner-border" role="status" aria-hidden="true"></span>
    </div>
  );
}
