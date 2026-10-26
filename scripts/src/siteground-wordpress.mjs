import { sitegroundSsh } from "./siteground-ssh.mjs";

/** Run an explicitly supplied operator query against this site's WordPress.
 * Only the marked JSON result is returned; PHP diagnostics and paths stay private.
 */
export async function sitegroundWordpress(php, options = {}) {
  const guard = `$host=parse_url(home_url(),PHP_URL_HOST);if(!in_array($host,array('slessismore.org','www.slessismore.org'),true)){exit(51);}`;
  const encoded = Buffer.from(guard + php).toString("base64");
  const command = `for root in "$HOME/www/slessismore.org/public_html" /home/customer/www/slessismore.org/public_html "$HOME/public_html"; do if test -f "$root/wp-config.php"; then wp --path="$root" eval 'eval(base64_decode("${encoded}"));' --quiet 2>/dev/null | sed -n 's/^SLESS_SAFE_JSON://p'; exit; fi; done; exit 44`;
  const output = await sitegroundSsh(command, { timeoutMs: 90_000, ...options });
  const json = output.trim().split("\n").find(line => line.startsWith("{"));
  if (!json) throw new Error("WordPress operator returned no safe JSON result");
  return JSON.parse(json);
}
