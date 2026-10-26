/**
 * Wire the owner-approved installer to draft native WooCommerce downloads only.
 * Does not launch paid tiers, alter Lite delivery, email customers, or create orders.
 */
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { sitegroundSsh } from "./siteground-ssh.mjs";
import { sitegroundWordpress } from "./siteground-wordpress.mjs";
import { saveJson } from "./merchandise/printify-api.mjs";

if (!process.argv.includes("--stage")) throw new Error("Use --stage; paid-tier launch is not implemented");
const bytes = await readFile("attached_assets/Local-AI-Setup_0.1.4_x64-setup_1791200773622.exe");
const sha = createHash("sha256").update(bytes).digest("hex");
if (sha !== "d45c5e8133422e591a628eedd27d1710ae3f81b26eedc4b0c6b254abae2338cd")
  throw new Error("Approved installer changed; owner review required");
// WordPress intentionally disallows EXE download types. Use its native ZIP
// support instead of weakening the site's executable-upload MIME policy.
const archive = execFileSync("python3", ["-c", `
import io, sys, zipfile
data = sys.stdin.buffer.read()
out = io.BytesIO()
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
    entry = zipfile.ZipInfo('Local-AI-Setup_0.1.4_x64-setup.exe', (2026, 10, 5, 0, 0, 0))
    entry.compress_type = zipfile.ZIP_DEFLATED
    z.writestr(entry, data)
sys.stdout.buffer.write(out.getvalue())
`], { input: bytes, maxBuffer: 10_000_000 });
const archiveSha = createHash("sha256").update(archive).digest("hex");
// A private sibling of public_html cannot be fetched by a public upload URL.
// Credentials are handled only by the existing SSH transport.
await sitegroundSsh(`set -eu
for root in "$HOME/www/slessismore.org/public_html" /home/customer/www/slessismore.org/public_html "$HOME/public_html"; do
  if test -f "$root/wp-config.php"; then
    dir="$(dirname "$root")/sless-private-downloads"
    umask 077; mkdir -p "$dir"
    target="$dir/SlessBox-0.1.4-${archiveSha.slice(0, 12)}.zip"
    if test -f "$target"; then
      test "$(sha256sum "$target" | cut -d' ' -f1)" = "${archiveSha}" || exit 42
      cat >/dev/null
    else
      cat >"$target.new"
      test "$(sha256sum "$target.new" | cut -d' ' -f1)" = "${archiveSha}" || exit 43
      mv "$target.new" "$target"
    fi
    printf 'Installer staged privately\\n'; exit 0
  fi
done
exit 44`, { input: archive, timeoutMs: 120_000 });

const result = await sitegroundWordpress(`
$dir=dirname(realpath(ABSPATH)).'/sless-private-downloads';
$file=$dir.'/SlessBox-0.1.4-${archiveSha.slice(0, 12)}.zip';
if(!is_file($file)||hash_file('sha256',$file)!=='${archiveSha}'||strpos(realpath($file),realpath(ABSPATH).DIRECTORY_SEPARATOR)===0)throw new Exception('Private installer verification failed');
$zip=new ZipArchive();if($zip->open($file)!==true)throw new Exception('Installer archive invalid');
$installer=$zip->getFromName('Local-AI-Setup_0.1.4_x64-setup.exe');$zip->close();
if(hash('sha256',$installer)!=='${sha}')throw new Exception('Archived installer differs from approved release');
if(get_option('woocommerce_file_download_method')!=='force'||get_option('woocommerce_downloads_redirect_fallback_allowed')==='yes')throw new Exception('Unsafe native download settings');
$before=array();foreach(array(214=>'39.00',215=>'79.00') as $id=>$price){
  $p=wc_get_product($id);
  if(!$p||$p->get_status()!=='draft'||!$p->is_virtual()||number_format((float)$p->get_regular_price(),2,'.','')!==$price)throw new Exception('Draft tier changed; stop');
  $before[$id]=array('price'=>$p->get_regular_price(),'content'=>$p->get_description(),'status'=>$p->get_status(),'downloads'=>count($p->get_downloads()));
  foreach($p->get_downloads() as $d)if($d->get_file()!==$file)throw new Exception('Independent existing download; review before replacing');
}
$registerClass='Automattic\\\\WooCommerce\\\\Internal\\\\ProductDownloads\\\\ApprovedDirectories\\\\Register';
if(!class_exists($registerClass))throw new Exception('Native approved-directory registry unavailable');
$register=wc_get_container()->get($registerClass);
if(!method_exists($register,'add_approved_directory'))throw new Exception('Native approved-directory API changed');
$register->add_approved_directory($dir, true);
if(!$register->is_valid_path($file))throw new Exception('Private directory approval failed');
$products=array();
foreach($before as $id=>$prior){
  $p=wc_get_product($id);$d=new WC_Product_Download();$d->set_id('${archiveSha}');$d->set_name('SlessBox 0.1.4 — extract ZIP, then run Windows installer');$d->set_file($file);
  $p->set_downloadable(true);$p->set_downloads(array($d));$p->set_download_limit(5);$p->set_download_expiry(30);
  $p->update_meta_data('_slessbox_delivery_staged',true);$p->update_meta_data('_slessbox_installer_sha256','${sha}');$p->save();
  $p=wc_get_product($id);
  if($p->get_status()!==$prior['status']||$p->get_regular_price()!==$prior['price']||$p->get_description()!==$prior['content']||!$p->is_downloadable()||count($p->get_downloads())!==1)throw new Exception('Draft download verification failed');
  $products[]=array('id'=>$id,'status'=>$p->get_status(),'downloadable'=>$p->is_downloadable(),'virtual'=>$p->is_virtual(),'files'=>count($p->get_downloads()),'limit'=>$p->get_download_limit(),'expiryDays'=>$p->get_download_expiry(),'price'=>$p->get_regular_price());
}
echo 'SLESS_SAFE_JSON:'.wp_json_encode(array('installerSha256'=>hash('sha256',$installer),'installerBytes'=>strlen($installer),'archiveSha256'=>hash_file('sha256',$file),'outsidePublicWebroot'=>true,'nativeDownloadMethod'=>get_option('woocommerce_file_download_method'),'nativeApprovedDirectoryRegistered'=>true,'products'=>$products,'paidFeatureActivationVerified'=>false,'paidTiersPublished'=>false,'orderCreated'=>false,'paymentSubmitted'=>false,'existingLiteDeliveryChanged'=>false));
`);
await saveJson("wordpress/sless-refresh/slessbox-order-downloads.json", { checkedAt: new Date().toISOString(), ...result });
console.log(JSON.stringify(result));
