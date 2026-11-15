"use client";

import { useState, type FormEvent } from "react";
import { LockKeyhole } from "lucide-react";
import { useStore } from "@/lib/store";

export default function AdminPasswordChange({ compact = false }: { compact?: boolean }) {
  const { changeAdminPassword, notify } = useStore();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (newPassword.length < 12 || new TextEncoder().encode(newPassword).length > 72) {
      notify("Choose a new password of at least 12 characters and no more than 72 UTF-8 bytes.", "error");
      return;
    }
    if (newPassword !== confirmPassword) {
      notify("The new password and confirmation do not match.", "error");
      return;
    }
    setBusy(true);
    const current = currentPassword;
    const next = newPassword;
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    await changeAdminPassword(current, next);
    setBusy(false);
  };

  return <form className={`admin-password-form ${compact ? "admin-password-form-compact" : ""}`} onSubmit={submit}>
    <label htmlFor="admin-current-password">Current password<input id="admin-current-password" type="password" autoComplete="current-password" required maxLength={128} value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></label>
    <label htmlFor="admin-new-password">New password<input id="admin-new-password" type="password" autoComplete="new-password" required minLength={12} maxLength={72} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /><small>Use at least 12 characters. Passwords are bcrypt-hashed before storage.</small></label>
    <label htmlFor="admin-confirm-password">Confirm new password<input id="admin-confirm-password" type="password" autoComplete="new-password" required minLength={12} maxLength={72} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label>
    <button className="admin-button admin-button-primary" disabled={busy}>{busy ? "Updating securely…" : "Change password"}<LockKeyhole size={14} /></button>
  </form>;
}
