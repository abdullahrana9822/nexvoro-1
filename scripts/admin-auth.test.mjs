import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";

test("bcrypt hashes used for admin records verify passwords without storing plaintext", async () => {
  let password = randomBytes(24).toString("base64url");
  const hash = await bcrypt.hash(password, 12);
  assert.match(hash, /^\$2[aby]\$12\$/);
  assert.equal(await bcrypt.compare(password, hash), true);
  assert.equal(await bcrypt.compare(`${password}x`, hash), false);
  password = "";
});
