<?php
// Approved shirt photos only; no orders, prices, canvas or homepage content writes.
$p=wc_get_product(660);
if(!$p || $p->get_name()!=='Sless After Dark — Halloween Tee' || $p->get_status()!=='publish') {
    throw new Exception('Expected live shirt missing');
}
if(count($p->get_children())!==18) throw new Exception('Variation count changed');
$before=$payload['before'];
$checks=array();
foreach($p->get_children() as $id){
    $v=wc_get_product($id);
    $saved=array_values(array_filter($before['variants'],function($x)use($id){return $x['id']===$id;}));
    if(count($saved)!==1 || $saved[0]['price']!==$v->get_price() || $saved[0]['sku']!==$v->get_sku() ||
        $saved[0]['attributes']!==$v->get_variation_attributes()) throw new Exception('Variant changed');
}
require_once ABSPATH.'wp-admin/includes/media.php';
require_once ABSPATH.'wp-admin/includes/file.php';
require_once ABSPATH.'wp-admin/includes/image.php';
$colors=array();
foreach($payload['mockups'] as $mockup){
    $color=ucfirst($mockup['color']);
    if(!in_array($color,array('Purple','Black','Orange'),true)) throw new Exception('Unexpected color');
    $key='sless-approved-large-shirt-'.strtolower($color);
    $existing=get_posts(array('post_type'=>'attachment','post_status'=>'inherit','numberposts'=>2,
        'meta_key'=>'_sless_large_shirt_proof','meta_value'=>$key,'fields'=>'ids'));
    if(count($existing)>1) throw new Exception('Duplicate approved image marker');
    if($existing) $imageId=(int)$existing[0];
    else {
        $imageId=media_sideload_image($mockup['url'],660,'Sless After Dark — '.$color.' — larger printed front','id');
        if(is_wp_error($imageId)) throw new Exception('Approved image import failed');
        update_post_meta($imageId,'_sless_large_shirt_proof',$key);
    }
    update_post_meta($imageId,'_wp_attachment_image_alt',
        'Sless After Dark Halloween tee in '.strtolower($color).' with the approved larger front print');
    $colors[$color]=$imageId;
}
if(count($colors)!==3) throw new Exception('All three front photos required');
foreach($p->get_children() as $id){
    $v=wc_get_product($id);$a=$v->get_variation_attributes();$color=$a['attribute_gildan-colors']??'';
    if(!isset($colors[$color])) throw new Exception('Unknown variation color');
    $v->set_image_id($colors[$color]);$v->save();
}
$p->set_image_id($colors['Purple']);
$p->set_gallery_image_ids(array($colors['Black'],$colors['Orange']));
$description=$p->get_description();
if(strpos($description,'6.75 inches')!==false) $p->set_description(str_replace('6.75 inches','10.5 inches',$description));
elseif(strpos($description,'10.5 inches')===false) throw new Exception('Unexpected product description');
$p->save();
wc_delete_product_transients(660);clean_post_cache(660);
if(function_exists('sg_cachepress_purge_cache')) sg_cachepress_purge_cache();
$p=wc_get_product(660);
foreach($p->get_children() as $id){
    $v=wc_get_product($id);$a=$v->get_variation_attributes();$color=$a['attribute_gildan-colors'];
    if($v->get_image_id()!==$colors[$color]) throw new Exception('Variation photo not verified');
    $checks[]=array('id'=>$id,'color'=>$color,'image'=>$v->get_image_id(),'price'=>$v->get_price(),'sku'=>$v->get_sku());
}
echo 'SLESS_SAFE_JSON:'.wp_json_encode(array(
    'verified'=>count($checks)===18 && (int)$p->get_image_id()===$colors['Purple'] &&
        $p->get_gallery_image_ids()===array($colors['Black'],$colors['Orange']),
    'frontImages'=>$colors,'variations'=>$checks,'url'=>$p->get_permalink(),
    'canvasUnchanged'=>hash('sha256',serialize(wc_get_product(680)->get_data()))===$before['canvasHash'],
    'homepageUnchanged'=>hash('sha256',get_post(147)->post_content)===$before['homepageHash'],
    'description'=>$p->get_description(),'ordersCreated'=>false
));
