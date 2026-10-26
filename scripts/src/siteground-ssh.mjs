/**
 * Operator-only SSH transport. Credentials stay in process memory/0600 temporary
 * files, never in output or source. First-use host keys are retained and pinned;
 * changed host keys are rejected. This is TOFU, not independent fingerprint proof.
 */
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, writeFile, chmod, rm } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

export async function sitegroundSsh(command, { timeoutMs = 60_000, diagnostics = false, input } = {}) {
  if (process.env.REPLIT_DEPLOYMENT === "1") throw new Error("Workspace operator only");
  for (const key of ["HOST", "USER", "PRIVATE_KEY", "PORT"]) {
    if (!process.env[`SITEGROUND_SSH_${key}`]) throw new Error(`Saved SSH ${key} is missing`);
  }
  const port = process.env.SITEGROUND_SSH_PORT.trim();
  const user = process.env.SITEGROUND_SSH_USER.trim();
  const host = process.env.SITEGROUND_SSH_HOST.trim();
  if (!/^\d+$/.test(port) || +port < 1 || +port > 65535 ||
      !/^[a-zA-Z0-9_.-]+$/.test(user) || !/^[a-zA-Z0-9.:-]+$/.test(host)) {
    throw new Error("Saved SSH endpoint format is unsupported");
  }
  let key = process.env.SITEGROUND_SSH_PRIVATE_KEY;
  if (key.trim().startsWith('"') && key.trim().endsWith('"')) {
    try { key = JSON.parse(key.trim()); } catch { /* Inspect the actual PEM block below. */ }
  }
  key = key.replaceAll("\\r\\n", "\n").replaceAll("\\n", "\n").replaceAll("\r", "");
  const blocks = [...key.matchAll(/-----BEGIN ([A-Z ]*PRIVATE KEY)-----([\s\S]*?)-----END \1-----/g)];
  if (blocks.length !== 1) throw new Error("Saved SSH key must contain one complete private-key block");
  const [, format, content] = blocks[0];
  if (format === "OPENSSH PRIVATE KEY") {
    const body = content.replace(/\s/g, "");
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(body)) throw new Error("Saved SSH key encoding is invalid");
    key = `-----BEGIN ${format}-----\n${body.match(/.{1,70}/g).join("\n")}\n-----END ${format}-----`;
  } else {
    key = blocks[0][0];
  }
  const temporary = await mkdtemp(join(tmpdir(), "sless-ssh-"));
  try {
    await chmod(temporary, 0o700);
    const keyPath = join(temporary, "identity");
    const askpass = join(temporary, "askpass");
    await writeFile(keyPath, `${key.trim()}\n`, { mode: 0o600 });
    await writeFile(askpass, "#!/usr/bin/env node\nprocess.stdout.write(process.env.SITEGROUND_SSH_PASSPHRASE || '');\n", { mode: 0o700 });
    const sshDirectory = join(homedir(), ".ssh");
    await mkdir(sshDirectory, { recursive: true, mode: 0o700 });
    return await new Promise((resolve, reject) => {
      const child = spawn("ssh", [
        ...(diagnostics ? ["-vv"] : []),
        "-p", port, "-i", keyPath,
        "-o", "IdentitiesOnly=yes", "-o", "PasswordAuthentication=no",
        "-o", "KbdInteractiveAuthentication=no", "-o", "NumberOfPasswordPrompts=1",
        "-o", "ConnectTimeout=20", "-o", "ConnectionAttempts=1",
        "-o", "StrictHostKeyChecking=accept-new", "-o", "HashKnownHosts=yes",
        "-o", `UserKnownHostsFile=${join(sshDirectory, "known_hosts")}`,
        `${user}@${host}`, command,
      ], {
        env: { ...process.env, SSH_ASKPASS: askpass, SSH_ASKPASS_REQUIRE: "force", DISPLAY: "sless-operator" },
        stdio: [input === undefined ? "ignore" : "pipe", "pipe", "pipe"],
      });
      if (input !== undefined) {
        child.stdin.on("error", () => { /* SSH exit is reported below without exposing input. */ });
        child.stdin.end(input);
      }
      let stdout = "", stderr = "", timedOut = false;
      child.stdout.on("data", data => { stdout += data; });
      child.stderr.on("data", data => { stderr += data; });
      const timer = setTimeout(() => { timedOut = true; child.kill("SIGKILL"); }, timeoutMs);
      child.on("error", () => { clearTimeout(timer); reject(new Error("SSH client could not start")); });
      child.on("close", code => {
        clearTimeout(timer);
        const reason = timedOut ? "TIMEOUT" :
          /REMOTE HOST IDENTIFICATION HAS CHANGED|Host key verification failed/.test(stderr) ? "HOST_KEY_MISMATCH" :
          /incorrect passphrase|bad passphrase|bad decrypt/i.test(stderr) ? "KEY_PASSPHRASE_REJECTED" :
          /invalid format|error in libcrypto/.test(stderr) ? "PRIVATE_KEY_FORMAT" :
          /no mutual signature|no mutual signature algorithm/.test(stderr) ? "KEY_ALGORITHM_MISMATCH" :
          /Permission denied/.test(stderr) ? "KEY_AUTHENTICATION_REJECTED" :
          /Connection refused|No route to host|Could not resolve hostname|Connection timed out/.test(stderr) ? "NETWORK" :
          "REMOTE_COMMAND_FAILED";
        if (code !== 0) {
          const error = new Error(`SSH operation failed (${reason}); sensitive diagnostics withheld`);
          error.reason = reason;
          if (diagnostics) error.safeDiagnostics = {
            connectedToServer: /Connection established/.test(stderr),
            keyOffered: /Offering public key/.test(stderr),
            serverAcceptedPublicKey: /Server accepts key/.test(stderr),
            signingFailed: /sign_and_send_pubkey: signing failed/.test(stderr),
            askpassAttempted: /askpass/.test(stderr),
            privateKeyLoadFailed: /Load key /.test(stderr),
          };
          return reject(error);
        }
        resolve(stdout);
      });
    });
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}
