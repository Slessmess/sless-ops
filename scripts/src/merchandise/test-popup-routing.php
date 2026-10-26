<?php
define('ABSPATH', '/test/');
$config = array('enabled'=>true,'brand_verified'=>true,'return_links_verified'=>true,
    'catalog_verified'=>true,'origin'=>'https://shop.slessismore.org',
    'products'=>array('485'=>'https://shop.slessismore.org/product/example-shirt'));
function get_option($key,$fallback=null) { global $config; return $key==='sless_popup_routing'?$config:$fallback; }
function add_filter(...$args) {}
function add_action(...$args) {}
function wp_parse_url($url) { return parse_url($url); }
function home_url($path='') { return 'https://slessismore.org'.$path; }
function url_to_postid($url) { return str_contains($url, 'digital')?900:485; }
function absint($value) { return abs((int)$value); }
function sanitize_text_field($value) { return strip_tags($value); }
function add_query_arg($q,$url) { return $url.'?'.http_build_query($q); }
function wc_get_product($id) { return new class($id) {
    private $id; function __construct($id){$this->id=$id;}
    function is_virtual(){return $this->id===900;}
    function is_downloadable(){return $this->id===900;}
}; }
require __DIR__.'/../../../wordpress/sless-refresh/woocommerce-plugins/sless-popup-routing/sless-popup-routing.php';
$tests = array(
    array('/shop/','https://shop.slessismore.org/'),
    array('/store/','https://shop.slessismore.org/'),
    array('https://slessismore.org/product/no-introduction-needed/','https://shop.slessismore.org/product/example-shirt'),
    array('/product/digital-download/','/product/digital-download/'),
    array('/ai/','/ai/'),
    array('/download/','/download/'),
    array('/my-account/view-order/702/','/my-account/view-order/702/'),
    array('/checkout-2/order-received/702/?key=private','/checkout-2/order-received/702/?key=private'),
    array('https://other.example/shop/','https://other.example/shop/'),
    array('mailto:shop@example.org','mailto:shop@example.org'),
    array('/shop/?utm_source=facebook&key=private','https://shop.slessismore.org/?utm_source=facebook'),
    array('/?add-to-cart=485','https://shop.slessismore.org/product/example-shirt'),
    array('/?add-to-cart=900','/?add-to-cart=900'),
);
foreach($tests as [$input,$expected]) {
    $actual=sless_popup_rewrite_url($input);
    if($actual!==$expected) throw new Exception("URL routing mismatch: ".$input);
}
$config['brand_verified']=false;
if(sless_popup_rewrite_url('/shop/')!=='/shop/') throw new Exception('Unverified branding must block cutover');
$config['brand_verified']=true;$config['products']['485']='https://evil.example/phish';
if(sless_popup_rewrite_url('/product/shirt/')!=='https://shop.slessismore.org/') throw new Exception('Unsafe destination accepted');
echo "15 routing safety checks passed\n";
