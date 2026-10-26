/**
 * Operator-only installation. Secret data travels on SSH stdin, never in argv,
 * stdout, tracked files, or diagnostics. No mail/order/fulfillment is triggered.
 */
import { readFile } from "node:fs/promises";
import { sitegroundWordpress } from "./siteground-wordpress.mjs";

const host = process.env.SITEGROUND_SMTP_HOST?.trim();
const password = process.env.SITEGROUND_SMTP_PASSWORD;
if (!host || !/^[a-zA-Z0-9.-]+$/.test(host) || !password) {
  throw new Error("SMTP host must be a hostname and the mailbox password must be configured");
}
const plugin = await readFile(new URL("../../wordpress/sless-refresh/sless-siteground-mail.php", import.meta.url), "utf8");
const php = `
$input=json_decode(stream_get_contents(STDIN),true);
if(!is_array($input)||empty($input['host'])||empty($input['password'])){exit(52);}
foreach(array('Exception','PHPMailer','SMTP') as $class){
 require_once ABSPATH.WPINC.'/PHPMailer/'.$class.'.php';
}
$mail=new \\PHPMailer\\PHPMailer\\PHPMailer(true);
$mail->isSMTP();$mail->Host=$input['host'];$mail->Port=587;
$mail->SMTPSecure='tls';$mail->SMTPAuth=true;
$mail->Username=$input['username'];$mail->Password=$input['password'];
$mail->Timeout=25;$mail->SMTPDebug=0;
$mail->SMTPOptions=array('ssl'=>array('verify_peer'=>true,'verify_peer_name'=>true,'allow_self_signed'=>false));
try{$ok=$mail->smtpConnect();}catch(Throwable $e){$ok=false;}
if(!$ok){
 $error=$mail->getSMTPInstance()->getError();
 echo 'SLESS_SAFE_JSON:'.json_encode(array('authenticated'=>false,'smtp_code'=>$error['smtp_code']??null));return;
}
$mail->smtpClose();
$directory=dirname(rtrim(ABSPATH,'/')).'/.sless-private';
$target=WPMU_PLUGIN_DIR.'/sless-siteground-mail.php';
if(file_exists($target)&&strpos(file_get_contents($target),'Plugin Name: Sless SiteGround Transactional Mail')===false){exit(53);}
if(!is_dir($directory)&&!mkdir($directory,0700,true)){exit(54);}
chmod($directory,0700);
$config=array('host'=>$input['host'],'username'=>$input['username'],'password'=>$input['password']);
umask(0077);
$temp=tempnam($directory,'mail-');
if(file_put_contents($temp,"<?php\\nreturn ".var_export($config,true).";\\n")===false){exit(55);}
chmod($temp,0600);
if(!rename($temp,$directory.'/mail.php')){unlink($temp);exit(56);}
if(!is_dir(WPMU_PLUGIN_DIR)&&!mkdir(WPMU_PLUGIN_DIR,0755,true)){exit(57);}
$plugin_temp=tempnam(WPMU_PLUGIN_DIR,'mail-');
if(file_put_contents($plugin_temp,$input['plugin'])===false){exit(58);}
chmod($plugin_temp,0644);
if(!rename($plugin_temp,$target)){unlink($plugin_temp);exit(59);}
update_option('woocommerce_email_from_address',$input['username']);
echo 'SLESS_SAFE_JSON:'.json_encode(array('authenticated'=>true,'installed'=>true,'sender_updated'=>get_option('woocommerce_email_from_address')===$input['username'],'private_config'=>((fileperms($directory.'/mail.php')&0777)===0600)));
`;
console.log(JSON.stringify(await sitegroundWordpress(php, {
  input: JSON.stringify({ host, password, username: "cs@slessismore.org", plugin }),
}), null, 2));
