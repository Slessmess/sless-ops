/**
 * Install the owner-requested navigation and homepage merchandise feature.
 * Touches only this plugin's files; does not rewrite existing page/media data.
 */
import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { sitegroundWordpress } from "../siteground-wordpress.mjs";
import { saveJson } from "./printify-api.mjs";

if (!process.argv.includes("--apply") || process.env.REPLIT_DEPLOYMENT === "1") {
  throw new Error("Explicit workspace --apply required");
}
const folder = "wordpress/sless-refresh/woocommerce-plugins/sless-merch-discovery";
const receipt = "wordpress/sless-refresh/navigation-plugin-release.json";
let prior = {};
try { prior = JSON.parse(await fs.readFile(receipt, "utf8")); }
catch (error) { if (error.code !== "ENOENT") throw error; }
const files = {};
for (const name of ["sless-merch-discovery.php", "views.php", "discovery.css", "discovery.js", "cart-layout.css"]) {
  const bytes = await fs.readFile(`${folder}/${name}`);
  files[name] = { contents: bytes.toString("base64"),
    sha256: createHash("sha256").update(bytes).digest("hex") };
}
const payload = Buffer.from(JSON.stringify({ files, previous: prior.hashes || {} })).toString("base64");
const php = `
$payload=json_decode(base64_decode('${payload}'),true);
$folder=WP_PLUGIN_DIR.'/sless-merch-discovery';
if((int)get_option('page_on_front')!==147 ||
   strpos(get_post(147)->post_content,'<section class="hero">')===false) {
    throw new Exception('Homepage structure changed; inspect before release');
}
$originalContentHash=hash('sha256',get_post(147)->post_content);
foreach($payload['files'] as $name=>$file){
    if(!in_array($name,array('sless-merch-discovery.php','views.php','discovery.css','discovery.js','cart-layout.css'),true)) {
        throw new Exception('Unexpected plugin file');
    }
    $contents=base64_decode($file['contents'],true);
    if(hash('sha256',$contents)!==$file['sha256']) throw new Exception('Source checksum failed');
    if(str_ends_with($name,'.php')) token_get_all($contents,TOKEN_PARSE);
    if(file_exists($folder.'/'.$name)){
        $existing=hash_file('sha256',$folder.'/'.$name);
        if($existing!==$file['sha256'] && $existing!==($payload['previous'][$name]??'')){
            throw new Exception('Remote plugin was edited independently');
        }
    }
}
if(!wp_mkdir_p($folder)) throw new Exception('Cannot create plugin folder');
$hashes=array();
foreach($payload['files'] as $name=>$file){
    $target=$folder.'/'.$name;
    if(file_put_contents($target.'.release-tmp',base64_decode($file['contents']))===false ||
       !rename($target.'.release-tmp',$target)) throw new Exception('Plugin file write failed');
    $hashes[$name]=hash_file('sha256',$target);
    if($hashes[$name]!==$file['sha256']) throw new Exception('Installed checksum failed');
}
require_once ABSPATH.'wp-admin/includes/plugin.php';
$plugin='sless-merch-discovery/sless-merch-discovery.php';
if(!is_plugin_active($plugin)){
    $activation=activate_plugin($plugin,'',false,true);
    if(is_wp_error($activation)) throw new Exception('Plugin activation failed');
}
if(class_exists('Elementor\\\\Plugin')) {
    $manager=\\Elementor\\Plugin::$instance->files_manager;
    if($manager && method_exists($manager,'clear_cache')) $manager->clear_cache();
}
wp_cache_flush();
if(function_exists('sg_cachepress_purge_cache')) sg_cachepress_purge_cache();
echo 'SLESS_SAFE_JSON:'.wp_json_encode(array(
    'active'=>is_plugin_active($plugin),'hashes'=>$hashes,
    'frontPageUnchanged'=>(int)get_option('page_on_front')===147,
    'homepageContentAndMediaUnchanged'=>$originalContentHash===hash('sha256',get_post(147)->post_content),
    'ordersCreated'=>false,'installedAt'=>gmdate('c')
)).PHP_EOL;
`;
const lint = spawnSync("php", ["-l"], { input: "<?php\n" + php, encoding: "utf8" });
if (lint.status !== 0) throw new Error("Operator PHP syntax check failed: " + lint.stderr);
const result = await sitegroundWordpress(php, { timeoutMs: 120000 });
await saveJson(receipt, result);
console.log(JSON.stringify(result));
