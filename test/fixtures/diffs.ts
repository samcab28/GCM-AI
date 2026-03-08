/**
 * Realistic git diff fixtures used across diff-parser and generator tests.
 * Each fixture represents a common real-world scenario.
 */

// ── Fixture 1: single file in a nested directory ─────────────────────────────
// One file changed inside src/auth/. Expected scope: "auth"
export const SINGLE_FILE_DIFF = `\
diff --git a/src/auth/login.ts b/src/auth/login.ts
index 4b825dc..9a3f2e1 100644
--- a/src/auth/login.ts
+++ b/src/auth/login.ts
@@ -1,10 +1,18 @@
 import { db } from '../db/client.js';
+import { hashPassword } from './crypto.js';
 
 export async function login(email: string, password: string) {
   const user = await db.users.findByEmail(email);
-  if (!user || user.password !== password) {
+  if (!user) {
+    throw new Error('User not found');
+  }
+  const valid = await hashPassword.compare(password, user.passwordHash);
+  if (!valid) {
     throw new Error('Invalid credentials');
   }
   return user;
 }
`;

// ── Fixture 2: multiple files in the same directory ──────────────────────────
// Two files changed inside src/auth/. Expected scope: "auth"
export const MULTI_FILE_SAME_DIR_DIFF = `\
diff --git a/src/auth/login.ts b/src/auth/login.ts
index 4b825dc..9a3f2e1 100644
--- a/src/auth/login.ts
+++ b/src/auth/login.ts
@@ -1,5 +1,6 @@
 import { db } from '../db/client.js';
+import { hashPassword } from './crypto.js';
 
 export async function login(email: string, password: string) {
   const user = await db.users.findByEmail(email);
diff --git a/src/auth/token.ts b/src/auth/token.ts
index 0000000..c3d8a12 100644
--- /dev/null
+++ b/src/auth/token.ts
@@ -0,0 +1,12 @@
+import { sign, verify } from 'jsonwebtoken';
+
+const SECRET = process.env['JWT_SECRET'] ?? '';
+
+export function createToken(userId: string): string {
+  return sign({ sub: userId }, SECRET, { expiresIn: '1h' });
+}
+
+export function verifyToken(token: string): { sub: string } {
+  return verify(token, SECRET) as { sub: string };
+}
`;

// ── Fixture 3: files in different top-level directories ───────────────────────
// Changes span src/auth/ and src/api/. Expected scope: undefined
export const MULTI_DIR_DIFF = `\
diff --git a/src/auth/login.ts b/src/auth/login.ts
index 4b825dc..9a3f2e1 100644
--- a/src/auth/login.ts
+++ b/src/auth/login.ts
@@ -3,4 +3,5 @@
 export async function login(email: string, password: string) {
   const user = await db.users.findByEmail(email);
+  console.log('login attempt', email);
   return user;
 }
diff --git a/src/api/routes.ts b/src/api/routes.ts
index 1234567..abcdef0 100644
--- a/src/api/routes.ts
+++ b/src/api/routes.ts
@@ -10,6 +10,7 @@
 import { login } from '../auth/login.js';
 
 router.post('/login', async (req, res) => {
+  // delegate to auth module
   const result = await login(req.body.email, req.body.password);
   res.json(result);
 });
`;

// ── Fixture 4: root-level files only ─────────────────────────────────────────
// Changes to README.md and package.json. Expected scope: undefined
export const ROOT_FILES_DIFF = `\
diff --git a/README.md b/README.md
index 1234abc..5678def 100644
--- a/README.md
+++ b/README.md
@@ -1,3 +1,5 @@
 # gcm-ai
+
+AI-powered Git commit message generator.
 
 ## Installation
diff --git a/package.json b/package.json
index aaaaaaa..bbbbbbb 100644
--- a/package.json
+++ b/package.json
@@ -3,5 +3,5 @@
   "name": "gcm-ai",
-  "version": "0.1.0",
+  "version": "0.2.0",
   "description": "..."
 }
`;

// ── Fixture 5: renamed file ───────────────────────────────────────────────────
// Git uses the new (b/) path for renames. Expected scope: "config"
export const RENAME_DIFF = `\
diff --git a/src/config/settings.ts b/src/config/store.ts
similarity index 85%
rename from src/config/settings.ts
rename to src/config/store.ts
index 9a1b2c3..d4e5f6a 100644
--- a/src/config/settings.ts
+++ b/src/config/store.ts
@@ -1,4 +1,4 @@
-// settings.ts
+// store.ts
 export function loadConfig() {
   return {};
 }
`;

// ── Fixture 6: files without src/ prefix ─────────────────────────────────────
// Some repos don't use src/. Expected scope: "lib"
export const NO_SRC_PREFIX_DIFF = `\
diff --git a/lib/parser.ts b/lib/parser.ts
index 1111111..2222222 100644
--- a/lib/parser.ts
+++ b/lib/parser.ts
@@ -5,3 +5,4 @@
 export function parse(input: string) {
+  if (!input) throw new Error('empty input');
   return input.trim();
 }
diff --git a/lib/lexer.ts b/lib/lexer.ts
index 3333333..4444444 100644
--- a/lib/lexer.ts
+++ b/lib/lexer.ts
@@ -1,3 +1,4 @@
+import { parse } from './parser.js';
 export function tokenize(src: string) {
   return src.split(' ');
 }
`;

// ── Fixture 7: large diff for truncation tests ────────────────────────────────
// 600 lines — exceeds the default maxDiffLines of 500
export const LARGE_DIFF = (() => {
  const header = `diff --git a/src/core/big.ts b/src/core/big.ts
index 0000000..1111111 100644
--- /dev/null
+++ b/src/core/big.ts
@@ -0,0 +1,590 @@
`;
  const lines = Array.from({ length: 590 }, (_, i) => `+export const line${i} = ${i};`);
  return header + lines.join('\n') + '\n';
})();
