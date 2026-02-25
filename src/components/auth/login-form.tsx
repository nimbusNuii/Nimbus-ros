"use client";

import { FormEvent, useState } from "react";

type LoginFormProps = {
  nextPath?: string;
};

export function LoginForm({ nextPath }: LoginFormProps) {
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = new FormData(event.currentTarget);
    const username = String(form.get("username") || "").trim().toLowerCase();
    const pin = String(form.get("pin") || "").trim();

    setSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ username, pin })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Login failed");
      }

      window.location.href = nextPath || data.redirectTo || "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="card" style={{ maxWidth: 420, margin: "30px auto" }}>
      <h1 className="page-title" style={{ marginTop: 0 }}>
        เข้าสู่ระบบ POS
      </h1>
      <p className="page-subtitle">เลือกผู้ใช้และ PIN เพื่อเข้าใช้งานหน้าที่ที่ได้รับสิทธิ์</p>

      <form onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor="username">Username</label>
          <input id="username" name="username" required placeholder="cashier / kitchen / manager / admin" />
        </div>

        <div className="field">
          <label htmlFor="pin">PIN</label>
          <input id="pin" name="pin" type="password" required minLength={4} maxLength={12} />
        </div>

        <button disabled={submitting} style={{ width: "100%" }}>
          {submitting ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
        </button>
      </form>

      {error ? <p style={{ color: "crimson" }}>{error}</p> : null}

      <hr style={{ border: 0, borderTop: "1px solid var(--line)", margin: "18px 0" }} />
      <p style={{ margin: 0, color: "var(--muted)", fontSize: 13 }}>Demo PIN: cashier(1111), kitchen(2222), manager(3333), admin(9999)</p>
    </section>
  );
}
