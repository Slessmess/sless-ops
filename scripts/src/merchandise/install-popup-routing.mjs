/** Stages the guarded routing plugin; DOES NOT activate customer cutover. */
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { sitegroundWordpress } from "../siteground-wordpress.mjs";
import { saveJson } from "./printify-api.mjs";
if (!process.argv.includes("--stage") || process.argv.includes("--enable")) throw Error("Staging only; native readiness proof required before cutover");
const source = await readFile("wordpress/sless-refresh/woocommerce-plugins/sless-popup-routing/sless-popup-routing.php");
const sha = createHash("sha256").update(source).digest("hex");
const content = source.toString("base64");
const out = await sitegroundWordpress(`
$folder=WP_PLUGIN_DIR.'/sless-popup-routing';$file=$folder.'/sless-popup-routing.php';
$bytes=base64_decode('${content}',true);
if(hash('sha256',$bytes)!=='${sha}')throw new Exception('Invalid plugin checksum');
token_get_all($bytes,TOKEN_PARSE);
$prior=get_option('sless_popup_staged_hash','');
if(file_exists($file)&&hash_file('sha256',$file)!==$prior&&hash_file('sha256',$file)!=='${sha}')throw new Exception('Independent remote edit; stop');
if(!wp_mkdir_p($folder))throw new Exception('Cannot stage folder');
if(file_put_contents($file.'.new',$bytes)===false||!rename($file.'.new',$file))throw new Exception('Stage write failed');
$config=get_option('sless_popup_routing',null);
if($config===null){$config=array('enabled'=>false,'brand_verified'=>false,'return_links_verified'=>false,'catalog_verified'=>false,'origin'=>'https://shop.slessismore.org','products'=>array());add_option('sless_popup_routing',$config,'','no');}
if(!empty($config['enabled']))throw new Exception('Existing live configuration must be inspected separately');
update_option('sless_popup_staged_hash','${sha}',false);
require_once ABSPATH.'wp-admin/includes/plugin.php';
$result=activate_plugin('sless-popup-routing/sless-popup-routing.php','',false,true);
if(is_wp_error($result))throw new Exception('Cannot activate guarded plugin');
echo 'SLESS_SAFE_JSON:'.wp_json_encode(array('staged'=>true,'sha256'=>hash_file('sha256',$file),'customerCutoverEnabled'=>false,'wordpressShopLinksChanged'=>false,'ordersChanged'=>false));
`);
await saveJson("wordpress/sless-refresh/printify-popup-routing-stage.json", out);
console.log(JSON.stringify(out));
