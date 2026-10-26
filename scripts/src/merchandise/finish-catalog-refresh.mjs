/**
 * Check native WooCommerce sync and curate printed-front image galleries.
 * Existing prices, variant identities, URLs, originals and approved Halloween
 * merchandise are protected. No checkout, payment or order writes.
 */
import { readFile } from "node:fs/promises";
import { sitegroundWordpress } from "../siteground-wordpress.mjs";
import { saveJson } from "./printify-api.mjs";

const mode = process.argv[2];
if (!["baseline", "check", "finish"].includes(mode)) throw new Error("baseline|check|finish required");
if (mode === "finish" && !process.argv.includes("--apply")) throw new Error("--apply required");
const dir = "generated-artifacts/catalog-refresh";
const manifest = JSON.parse(await readFile(`${dir}/rendered.json`, "utf8"));
const log = JSON.parse(await readFile(`${dir}/operations.json`, "utf8"));
let repairs = { products: [] };
try { repairs = JSON.parse(await readFile(`${dir}/woocommerce-repaired-images.json`, "utf8")); }
catch (error) { if (error.code !== "ENOENT") throw error; }
let baseline = null;
if (mode !== "baseline") baseline = JSON.parse(await readFile(`${dir}/woocommerce-before.json`, "utf8"));
const data = manifest.map(item => ({
  sku: item.sku, id: Number(item.externalId || log.products[item.sku]?.externalId || repairs.products.find(p => p.sku === item.sku)?.id || 0),
  title: item.title, description: item.description, category: item.category,
  collection: item.collection, new: Boolean(item.new),
}));
const php = `
$payload=json_decode(stream_get_contents(STDIN),true);
$mode=$payload['mode'];$items=$payload['items'];$baseline=$payload['baseline'];
$protected=array(485,493,502,660,680);
$snapshot=function($p){
 $variants=array();foreach($p->get_children() as $vid){$v=wc_get_product($vid);if(!$v)continue;
  $variants[]=array('id'=>$vid,'sku'=>$v->get_sku(),'price'=>$v->get_regular_price(),'sale'=>$v->get_sale_price(),'attributes'=>$v->get_attributes(),'image'=>$v->get_image_id());}
 return array('id'=>$p->get_id(),'title'=>$p->get_name(),'slug'=>$p->get_slug(),'status'=>$p->get_status(),
  'price'=>$p->get_regular_price(),'sale'=>$p->get_sale_price(),'sku'=>$p->get_sku(),'variants'=>$variants,
  'featured'=>$p->get_image_id(),'gallery'=>$p->get_gallery_image_ids(),'url'=>$p->get_permalink(),
  'description'=>$p->get_description(),'shortDescription'=>$p->get_short_description());
};
if($mode==='baseline'){
 $result=array('products'=>array(),'protected'=>array());
 foreach($items as $item){if(!$item['id'])continue;$p=wc_get_product($item['id']);if(!$p)throw new Exception('Baseline product missing');$result['products'][(string)$item['id']]=$snapshot($p);}
 foreach($protected as $id){$p=wc_get_product($id);$result['protected'][(string)$id]=$snapshot($p);}
 echo 'SLESS_SAFE_JSON:'.wp_json_encode($result);return;
}
$results=array();$waiting=array();$errors=array();
foreach($items as $item){
 $id=$item['id'];if(!$id){$waiting[]=$item['sku'];continue;}
 if(in_array($id,$protected,true))throw new Exception('Protected item rejected');
 $p=wc_get_product($id);
 if(!$p||$p->get_status()!=='publish'||$p->get_name()!==$item['title']||
    trim(html_entity_decode($p->get_description(),ENT_QUOTES,'UTF-8'))!==trim(html_entity_decode($item['description'],ENT_QUOTES,'UTF-8'))){
  $waiting[]=$item['sku'];continue;
 }
 $old=$baseline['products'][(string)$id]??null;$current=$snapshot($p);
 if($old){
  $a=$old['variants'];$b=$current['variants'];
  foreach($a as &$v){unset($v['image']);}unset($v);foreach($b as &$v){unset($v['image']);}unset($v);
  if($a!==$b||$old['price']!==$current['price']||$old['sale']!==$current['sale']||$old['sku']!==$current['sku']){
   $errors[]=array('sku'=>$item['sku'],'error'=>'price_or_variant_mismatch');continue;
  }
  if($old['featured']===$current['featured']){$errors[]=array('sku'=>$item['sku'],'error'=>'featured_image_not_refreshed');continue;}
  $stale=false;foreach($old['variants'] as $ov){foreach($current['variants'] as $nv){
   if($ov['id']===$nv['id']&&$ov['image']&&$ov['image']===$nv['image'])$stale=true;}}
  if($stale){$errors[]=array('sku'=>$item['sku'],'error'=>'variation_image_not_refreshed');continue;}
 }
 if($mode==='finish'){
  if($old&&$p->get_slug()!==$old['slug'])$p->set_slug($old['slug']);
  preg_match_all('/<p>(.*?)<\\/p>/s',$item['description'],$paragraphs);
  $p->set_short_description(implode('',array_slice($paragraphs[0],0,2)));
  if($item['category']==='Apparel'){
   $fronts=array();$preferred=0;
   foreach($p->get_children() as $vid){$v=wc_get_product($vid);$image=$v->get_image_id();
    if(!$image||!wp_attachment_is_image($image))throw new Exception('Variation front image missing');
    $fronts[]=$image;foreach($v->get_attributes() as $attribute=>$value){if(strpos(str_replace(array('-','_'),' ',strtolower($value)),'forest green')!==false)$preferred=$image;}
    update_post_meta($image,'_wp_attachment_image_alt',$item['title'].' — printed front');
   }
   $fronts=array_values(array_unique($fronts));
   if(count($fronts)){$featured=$preferred?:$fronts[0];$p->set_image_id($featured);$p->set_gallery_image_ids(array_values(array_diff($fronts,array($featured))));}
  }
  if($item['new']){
   $cats=$p->get_category_ids();foreach(array('t-shirts','christmas') as $slug){
    $term=get_term_by('slug',$slug,'product_cat');if(!$term)throw new Exception('Expected category missing');$cats[]=(int)$term->term_id;
   }
   $uncategorized=get_term_by('slug','uncategorized','product_cat');if($uncategorized)$cats=array_diff($cats,array((int)$uncategorized->term_id));
   $p->set_category_ids(array_values(array_unique($cats)));
  }
  $p->save();wc_delete_product_transients($id);clean_post_cache($id);
 }
 $results[]=array('sku'=>$item['sku'],'id'=>$id,'title'=>$p->get_name(),'url'=>$p->get_permalink(),'variantCount'=>count($p->get_children()),'imageCount'=>1+count($p->get_gallery_image_ids()),'price'=>$p->get_price(),'shortCopy'=>strlen($p->get_short_description())>0);
}
$protectedUnchanged=true;
foreach($protected as $id){$now=$snapshot(wc_get_product($id));if($now!==$baseline['protected'][(string)$id])$protectedUnchanged=false;}
if($mode==='finish'&&function_exists('sg_cachepress_purge_cache'))sg_cachepress_purge_cache();
echo 'SLESS_SAFE_JSON:'.wp_json_encode(array('mode'=>$mode,'verified'=>count($results),'products'=>$results,'waiting'=>$waiting,'errors'=>$errors,'protectedUnchanged'=>$protectedUnchanged,'ordersCreated'=>false));
`;
const result = await sitegroundWordpress(php, {
  input: JSON.stringify({ mode, items: data, baseline }), timeoutMs: 120_000,
});
result.nativeAcknowledgementsPending = Object.values(log.products).filter(p => p.locked || !p.externalId).length;
await saveJson(`${dir}/${mode === "baseline" ? "woocommerce-before" : `woocommerce-${mode}`}.json`, result);
if (mode === "baseline") console.log(JSON.stringify({ baselineSaved: true, products: Object.keys(result.products).length, protected: Object.keys(result.protected).length }));
else console.log(JSON.stringify(result));
