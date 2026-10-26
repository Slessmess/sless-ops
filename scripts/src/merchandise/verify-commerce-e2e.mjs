import { sitegroundWordpress } from "../siteground-wordpress.mjs";
import { saveJson } from "./printify-api.mjs";

const report = await sitegroundWordpress(String.raw`
$config=get_option('sless_commerce_qa',array());
if(empty($config['batch']))throw new Exception('No current QA batch');
$s=get_option('woocommerce_stripe_settings');
$out=array('batch'=>$config['batch'],'publicStripeMode'=>$s['testmode']??null,'orders'=>array(),'liveFundsTransferred'=>false);
foreach(wc_get_orders(array('limit'=>50,'orderby'=>'date','order'=>'DESC')) as $order){
    if($order->get_meta('_sless_e2e_batch')!==$config['batch'])continue;
    $payment=array('verified'=>false);
    $intent=$order->get_meta('_stripe_intent_id');
    $transaction=$order->get_transaction_id();
    $path=$intent?'payment_intents/'.rawurlencode($intent):(strpos($transaction,'ch_')===0?'charges/'.rawurlencode($transaction):null);
    if($path){
        $r=wp_remote_get('https://api.stripe.com/v1/'.$path,array('headers'=>array('Authorization'=>'Bearer '.$s['test_secret_key']),'timeout'=>25));
        if(!is_wp_error($r)){
            $p=json_decode(wp_remote_retrieve_body($r),true);
            $amount=(int)($p['amount_received']??$p['amount']??0);
            $paid=($p['status']??'')==='succeeded'||($p['paid']??false)===true;
            $payment=array('httpStatus'=>wp_remote_retrieve_response_code($r),'livemode'=>$p['livemode']??null,'succeeded'=>$paid,'amountMinor'=>$amount,'currency'=>$p['currency']??null,
                'matchesOrder'=>($amount===(int)round((float)$order->get_total()*100))&&strtoupper($p['currency']??'')===$order->get_currency(),
                'verified'=>($p['livemode']??null)===false&&$paid&&$amount===(int)round((float)$order->get_total()*100));
        }
    }
    $lines=array();
    foreach($order->get_items() as $line){
        $product=$line->get_product();$supplierMeta=false;
        if($product)foreach($product->get_meta_data() as $meta)if(stripos($meta->key,'printify')!==false)$supplierMeta=true;
        $lines[]=array('productId'=>$line->get_product_id(),'variationId'=>$line->get_variation_id(),'quantity'=>$line->get_quantity(),'lineTotal'=>(float)$line->get_total(),'supplierMetadataPresent'=>$supplierMeta);
    }
    $keys=array();foreach($order->get_meta_data() as $meta)if(preg_match('/gla.*track|purchase.*track|track.*purchase/',$meta->key))$keys[]=$meta->key;
    $out['orders'][]=array('id'=>$order->get_id(),'flow'=>(int)$order->get_meta('_sless_e2e_flow'),'status'=>$order->get_status(),'paid'=>$order->is_paid(),'total'=>(float)$order->get_total(),'shipping'=>(float)$order->get_shipping_total(),'tax'=>(float)$order->get_total_tax(),'currency'=>$order->get_currency(),'items'=>$lines,
        'stripe'=>$payment,'doNotFulfill'=>$order->get_meta('_sless_e2e_do_not_fulfill')==='yes','fulfillmentWebhookSuppressed'=>(bool)$order->get_meta('_sless_e2e_fulfillment_blocked'),
        'emailTransportStatus'=>$order->get_meta('_sless_e2e_mail_status'),'conversionMarkerKeys'=>$keys,'metaBrowserPurchaseMarked'=>(bool)$order->get_meta('_meta_purchase_tracked_browser'));
}
$out['twoPaidSandboxOrders']=count(array_filter($out['orders'],function($order){return $order['paid']&&$order['stripe']['verified']&&$order['stripe']['matchesOrder']&&$order['fulfillmentWebhookSuppressed'];}))===2;
echo 'SLESS_SAFE_JSON:'.wp_json_encode($out);
`, { timeoutMs: 120_000 });
await saveJson("wordpress/sless-refresh/commerce-e2e-verification.json", { checkedAt: new Date().toISOString(), ...report });
console.log(JSON.stringify(report, null, 2));
