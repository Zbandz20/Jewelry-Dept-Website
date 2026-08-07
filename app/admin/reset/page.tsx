"use client";

import { useEffect, useState } from "react";
import "../photos/admin.css";

export default function ResetPasswordPage() {
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => setToken(new URLSearchParams(window.location.search).get("token") || ""), []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");
    if (password !== confirm) return setMessage("Passwords do not match.");
    setBusy(true);
    const response = await fetch("/api/admin/recovery", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reset", token, newPassword: password }),
    });
    const result = await response.json();
    setBusy(false);
    if (!response.ok) return setMessage(result.error || "Password could not be reset.");
    window.location.href = "/admin/photos";
  }

  return (
    <main className="adminLogin">
      <form onSubmit={submit}>
        <p>JEWELRY DEPT.</p>
        <h1>Set new<br /><em>password.</em></h1>
        <label htmlFor="new-password">New password</label>
        <input id="new-password" type="password" minLength={12} value={password} onChange={event => setPassword(event.target.value)} autoComplete="new-password" required autoFocus />
        <label htmlFor="confirm-password">Confirm password</label>
        <input id="confirm-password" type="password" minLength={12} value={confirm} onChange={event => setConfirm(event.target.value)} autoComplete="new-password" required />
        {message && <small>{message}</small>}
        <button disabled={busy || !token}>{busy ? "RESETTING…" : "RESET PASSWORD"}</button>
        <a className="textButton" href="/admin/photos">BACK TO SIGN IN</a>
      </form>
    </main>
  );
}
