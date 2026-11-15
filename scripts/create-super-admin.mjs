#!/usr/bin/env node
import { StringDecoder } from "node:string_decoder";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;
const TABLE = "nexvoro_admin_users";
const BCRYPT_COST = 12;
const RESET_EXISTING = process.argv.includes("--reset-existing");

function prompt(label, { hidden = false } = {}) {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== "function") {
    const command = RESET_EXISTING ? "npm run admin:reset" : "npm run admin:create";
    throw new Error(`This command needs an interactive terminal so the password can be entered without echo. Run \`${command}\` in a local terminal.`);
  }

  return new Promise((resolve, reject) => {
    const decoder = new StringDecoder("utf8");
    let value = "";
    let finished = false;
    const previousRawMode = process.stdin.isRaw;
    process.stdout.write(label);
    process.stdin.setRawMode(true);
    process.stdin.resume();

    const finish = (error) => {
      if (finished) return;
      finished = true;
      process.stdin.off("data", onData);
      process.stdin.setRawMode(Boolean(previousRawMode));
      process.stdin.pause();
      process.stdout.write("\n");
      if (error) reject(error);
      else resolve(value);
    };

    const onData = (chunk) => {
      for (const character of decoder.write(chunk)) {
        if (character === "\u0003") return finish(new Error("Cancelled."));
        if (character === "\r" || character === "\n") return finish();
        if (character === "\u0004") return finish(new Error("Input ended."));
        if (character === "\u007f" || character === "\b") {
          const characters = Array.from(value);
          if (characters.length) {
            characters.pop();
            value = characters.join("");
            if (hidden) process.stdout.write("\b \b");
            else process.stdout.write("\b \b");
          }
          continue;
        }
        if (character >= " " && character !== "\u007f") {
          value += character;
          process.stdout.write(hidden ? "*" : character);
        }
      }
    };

    process.stdin.on("data", onData);
    process.stdin.once("error", finish);
  });
}

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and/or SUPABASE_SERVICE_ROLE_KEY. Add the explicitly approved NEXVORO-1 Supabase project's server credentials to .env.local first.");
  }
  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error("SUPABASE_URL is not a valid URL.");
  }
  if (parsedUrl.protocol !== "https:") {
    throw new Error("The admin provisioner requires an HTTPS Supabase URL.");
  }
  return { url: parsedUrl.origin, serviceRoleKey, projectRef: parsedUrl.hostname.split(".")[0] };
}

async function main() {
  loadEnvConfig(process.cwd());
  const { url, serviceRoleKey, projectRef } = getSupabaseConfig();
  console.log(RESET_EXISTING ? "NEXVORO-1 Super Admin password reset" : "NEXVORO-1 Super Admin provisioner");
  console.log(`Target Supabase project ref: ${projectRef}`);
  console.log(RESET_EXISTING
    ? "Reset mode changes only an active SUPER_ADMIN password, requires a typed confirmation, and revokes existing sessions."
    : "Use only the Supabase project explicitly approved for NEXVORO-1. This command will not update or overwrite an existing admin account.");
  const confirmation = await prompt("Type the project ref shown above to continue: ");
  if (confirmation !== projectRef) throw new Error("Project ref confirmation did not match; no database changes were made.");

  const displayName = RESET_EXISTING ? null : (await prompt("Admin name: ")).trim();
  const username = (await prompt("Username: ")).trim();
  if (displayName !== null && (displayName.length < 2 || displayName.length > 100)) throw new Error("Admin name must be 2–100 characters.");
  if (!/^[A-Za-z0-9_.-]{3,64}$/.test(username)) throw new Error("Username must be 3–64 characters and use only letters, numbers, dot, underscore, or hyphen.");

  const db = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { "x-application-name": "nexvoro-admin-provisioner" } },
  });

  const { error: migrationError } = await db.from(TABLE).select("id").limit(1);
  if (migrationError) {
    throw new Error("Admin table is unavailable. Apply supabase/migrations/202611140003_admin_accounts.sql to the approved project after migrations 001 and 002, then run this command again.");
  }

  const { data: existing, error: lookupError } = await db
    .from(TABLE)
    .select("id,role,session_version,disabled_at")
    .eq("username_key", username.toLowerCase())
    .maybeSingle();
  if (lookupError) {
    throw new Error("Could not safely check for an existing admin account; no database changes were made.");
  }
  if (RESET_EXISTING) {
    if (!existing) throw new Error("No account with that username exists. Nothing was changed; use `npm run admin:create` to provision a new Super Admin.");
    if (existing.role !== "SUPER_ADMIN" || existing.disabled_at) {
      throw new Error("The account is not an active SUPER_ADMIN. Nothing was changed; disabled accounts must be reviewed separately.");
    }
    const resetConfirmation = await prompt(`Type RESET ${username} to replace its password and revoke active sessions: `);
    if (resetConfirmation !== `RESET ${username}`) throw new Error("Reset confirmation did not match; no database changes were made.");
  } else if (existing) {
    throw new Error("An account with that username already exists. Nothing was changed; use `npm run admin:reset` for an explicit password reset.");
  }

  let password = await prompt(RESET_EXISTING ? "New password (input hidden): " : "Initial password (input hidden): ", { hidden: true });
  let passwordConfirmation = await prompt("Re-enter password (input hidden): ", { hidden: true });
  if (password !== passwordConfirmation) {
    password = "";
    passwordConfirmation = "";
    throw new Error("The passwords did not match; no database changes were made.");
  }
  if (Buffer.byteLength(password, "utf8") < 8 || Buffer.byteLength(password, "utf8") > 72) {
    password = "";
    passwordConfirmation = "";
    throw new Error("Password must be 8–72 UTF-8 bytes (bcrypt's maximum is 72 bytes).");
  }
  passwordConfirmation = "";

  let passwordHash;
  try {
    passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  } finally {
    password = "";
  }

  let account;
  if (RESET_EXISTING && existing) {
    const sessionVersion = Number(existing.session_version);
    if (!Number.isInteger(sessionVersion) || sessionVersion < 1 || sessionVersion >= 2_147_483_647) {
      throw new Error("The account session state is invalid. Nothing was changed; inspect the account before resetting it.");
    }
    const resetAt = new Date().toISOString();
    const { data: updatedAccount, error: updateError } = await db
      .from(TABLE)
      .update({
        password_hash: passwordHash,
        must_change_password: true,
        session_version: sessionVersion + 1,
        failed_login_count: 0,
        locked_until: null,
        password_changed_at: resetAt,
        updated_at: resetAt,
      })
      .eq("id", existing.id)
      .eq("session_version", sessionVersion)
      .is("disabled_at", null)
      .select("id,display_name,username,role,must_change_password,created_at")
      .maybeSingle();
    if (updateError || !updatedAccount) {
      throw new Error("Admin password reset failed or the account changed concurrently. No credential values were logged.");
    }
    account = updatedAccount;
  } else {
    const { data: createdAccount, error: insertError } = await db
      .from(TABLE)
      .insert({
        display_name: displayName,
        username,
        password_hash: passwordHash,
        role: "SUPER_ADMIN",
        must_change_password: true,
      })
      .select("id,display_name,username,role,must_change_password,created_at")
      .single();
    if (insertError || !createdAccount) {
      throw new Error("Admin account creation failed. Check the approved project's schema, RLS grants, and service-role key; no credential values were logged.");
    }
    account = createdAccount;
  }

  console.log(RESET_EXISTING ? "Super Admin password reset in the confirmed Supabase project." : "Super Admin account created in the confirmed Supabase project.");
  console.log(`Account id: ${account.id}`);
  console.log(`Admin name: ${account.display_name}`);
  console.log(`Username: ${account.username}`);
  console.log(`Role: ${account.role}`);
  console.log(`First-login password change required: ${account.must_change_password ? "yes" : "no"}`);
  console.log(RESET_EXISTING
    ? "The new password was bcrypt-hashed; active sessions were revoked. The password is not printed or saved by this script."
    : "The password was bcrypt-hashed before the insert and is not printed or saved by this script.");
}

main().catch((error) => {
  if (process.stdin.isTTY && typeof process.stdin.setRawMode === "function") {
    try { process.stdin.setRawMode(false); } catch { /* Terminal may already be restored. */ }
  }
  console.error(error instanceof Error ? error.message : "Admin account provisioning failed.");
  process.exitCode = 1;
});
