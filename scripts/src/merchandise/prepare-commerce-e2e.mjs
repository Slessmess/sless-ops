import { readFile, writeFile, chmod } from "node:fs/promises";
import { sitegroundWordpress } from "../siteground-wordpress.mjs";

const code = await readFile("wordpress/sless-refresh/commerce-e2e-guard.php", "utf8");
const access = await sitegroundWordpress(String.raw`
$payload=json_decode(stream_get_contents(STDIN),true);
token_get_all($payload['code'],TOKEN_PARSE);
$path=WPMU_PLUGIN_DIR.'/sless-commerce-e2e-guard.php';
if(is_file($path)&&strpos(file_get_contents($path),'Plugin Name: Sless Isolated Commerce QA')===false)throw new Exception('Unexpected QA file');
$s=get_option('woocommerce_stripe_settings');
if(($s['testmode']??'')!=='no'||empty($s['test_secret_key'])||empty($s['test_webhook_secret']))throw new Exception('Live and sandbox separation unavailable');
$r=wp_remote_get('https://api.stripe.com/v1/balance',array('headers'=>array('Authorization'=>'Bearer '.$s['test_secret_key']),'timeout'=>20));
$stripe=json_decode(wp_remote_retrieve_body($r),true);
if(($stripe['livemode']??null)!==false)throw new Exception('Sandbox key verification failed');
if(file_put_contents($path,$payload['code'])!==strlen($payload['code']))throw new Exception('QA guard write failed');
$token=bin2hex(random_bytes(24));$batch='qa-'.gmdate('Ymd-His');
$config=array('batch'=>$batch,'token_hash'=>hash('sha256',$token),'expires'=>time()+7200);
update_option('sless_commerce_qa',$config,false);
if(function_exists('sg_cachepress_purge_cache'))sg_cachepress_purge_cache();
$email=get_option('woocommerce_email_from_address');
if(!is_email($email)||!preg_match('/@slessismore\.org$/i',$email))throw new Exception('Verified test mailbox unavailable');
echo 'SLESS_SAFE_JSON:'.wp_json_encode(array('batch'=>$batch,'entry1'=>add_query_arg(array('sless_qa_enter'=>$token,'flow'=>1),home_url('/')),'entry2'=>add_query_arg(array('sless_qa_enter'=>$token,'flow'=>2),home_url('/')),'buyerEmail'=>$email));
`, { input: JSON.stringify({ code }), timeoutMs: 100_000 });
// Session entry capabilities are private runtime data, never project files/logs.
await writeFile("/tmp/sless-commerce-e2e-access.json", JSON.stringify(access), { mode: 0o600 });
await chmod("/tmp/sless-commerce-e2e-access.json", 0o600);
console.log(JSON.stringify({ batch: access.batch, sandboxVerified: true, liveGlobalModeUnchanged: true, privateAccessFile: "/tmp/sless-commerce-e2e-access.json" }));
