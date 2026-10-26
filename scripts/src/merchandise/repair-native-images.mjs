/**
 * Repair confirmed catalog publication image-import failures over SSH.
 * Imports real supplier mockups; never invents publication acknowledgements.
 * No product, variant, order, payment or manufacturing creation endpoints.
 */
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { sitegroundWordpress } from "../siteground-wordpress.mjs";
import { api, saveJson } from "./printify-api.mjs";

if (!process.argv.includes("--apply") || process.env.REPLIT_DEPLOYMENT === "1") throw new Error("Workspace --apply required");
const dir = "generated-artifacts/catalog-refresh";
const manifest = JSON.parse(await readFile(`${dir}/rendered.json`, "utf8"));
const baseline = JSON.parse(await readFile(`${dir}/woocommerce-before.json`, "utf8"));
const log = JSON.parse(await readFile(`${dir}/operations.json`, "utf8"));
const before = JSON.parse(await readFile(`${dir}/before.json`, "utf8"));
const only = process.argv.find(a => a.startsWith("--only="))?.slice(7).split(",");
let report = { products: [], ordersCreated: false, productionApproved: false };
try { report = JSON.parse(await readFile(`${dir}/woocommerce-repaired-images.json`, "utf8")); }
catch (error) { if (error.code !== "ENOENT") throw error; }
for (const item of manifest.filter(i => !only || only.includes(i.sku))) {
  const record = log.products[item.sku];
  const provider = item.new ? await api(`shops/${log.shop}/products/${record.id}.json`) : before.find(p => p.id === item.id);
  const variants = record.variants.map(v => ({ ...v, sku: provider.variants.find(p => p.id === v.id)?.sku }));
  if (variants.some(v => !v.sku)) throw new Error("Variant SKU map incomplete");
  const selections = variants.map(v => {
    const candidates = record.mockups.filter(m => m.variant_ids.includes(v.id));
    const front = m => m.position === "front" || /^front(?:-|$)/.test(new URL(m.src).searchParams.get("camera_label") || "");
    const image = item.category === "Apparel"
      ? candidates.find(front)
      : candidates.find(m => m.is_default) || candidates[0];
    if (!image) throw new Error("Checked mockup missing: " + item.sku);
    return { sku: v.sku, url: image.src, preferred: v.title.includes("Forest Green") };
  });
  const images = [];
  for (const url of new Set(selections.map(s => s.url))) {
    if (new URL(url).hostname !== "images.printify.com" || !url.includes(record.id)) throw new Error("Untrusted mockup source");
    const response = await fetch(url, { signal: AbortSignal.timeout(60_000), redirect: "error" });
    if (!response.ok || !response.headers.get("content-type")?.startsWith("image/")) throw new Error("Supplier photo unavailable");
    const bytes = Buffer.from(await response.arrayBuffer());
    const key = createHash("sha256").update(bytes).digest("hex");
    images.push({ url, key, contents: bytes.toString("base64") });
  }
  const php = `
  $in=json_decode(stream_get_contents(STDIN),true);$item=$in['item'];$id=$item['id'];
  if(!$id){
   $parents=array();foreach($in['selections'] as $selection){$vid=wc_get_product_id_by_sku($selection['sku']);$v=$vid?wc_get_product($vid):null;
    if(!$v||!$v->get_parent_id()){$parents=array();break;}$parents[]=$v->get_parent_id();}
   $parents=array_values(array_unique($parents));if(count($parents)===1)$id=$parents[0];
  }
  if(in_array($id,array(485,493,502,660,680),true))throw new Exception('Protected product');
  $p=$id?wc_get_product($id):null;
  if(!$p){echo 'SLESS_SAFE_JSON:'.json_encode(array('sku'=>$item['sku'],'pendingNativeCreation'=>true));return;}
  if($p->get_status()!=='publish')throw new Exception('Native product not published');
  $old=$in['baseline'];$bySku=array();
  foreach($p->get_children() as $vid){$v=wc_get_product($vid);$bySku[$v->get_sku()]=$v;}
  if(count($bySku)!==count($in['selections']))throw new Exception('Variant count mismatch');
  if($item['new']){foreach($in['variants'] as $expected){$v=$bySku[$expected['sku']]??null;
   if(!$v||abs((float)$v->get_regular_price()*100-$expected['price'])>.01)throw new Exception('New variation price mismatch');}}
  if($old){foreach($old['variants'] as $previous){$v=$bySku[$previous['sku']]??null;
   if(!$v||$v->get_id()!==$previous['id']||$v->get_regular_price()!==$previous['price']||$v->get_sale_price()!==$previous['sale']||$v->get_attributes()!==$previous['attributes'])throw new Exception('Protected price or variant changed');}}
  require_once ABSPATH.'wp-admin/includes/image.php';
  $imported=array();
  foreach($in['images'] as $image){
   $found=get_posts(array('post_type'=>'attachment','post_status'=>'inherit','numberposts'=>2,'meta_key'=>'_sless_verified_illustrated_photo','meta_value'=>$image['key'],'fields'=>'ids'));
   if(count($found)>1)throw new Exception('Duplicate image marker');
   if($found)$aid=(int)$found[0];else{
    $upload=wp_upload_bits('sless-illustrated-'.$image['key'].'.jpg',null,base64_decode($image['contents'],true));
    if($upload['error'])throw new Exception('Image file write failed');
    $aid=wp_insert_attachment(array('post_mime_type'=>'image/jpeg','post_title'=>$item['title'].' — printed design','post_status'=>'inherit'),$upload['file'],$id,true);
    if(is_wp_error($aid))throw new Exception('Attachment creation failed');
    update_post_meta($aid,'_sless_verified_illustrated_photo',$image['key']);
    wp_update_attachment_metadata($aid,wp_generate_attachment_metadata($aid,$upload['file']));
   }
   if(!wp_attachment_is_image($aid))throw new Exception('Imported image invalid');
   update_post_meta($aid,'_wp_attachment_image_alt',$item['title'].' — supplier mockup showing the printed design');
   $imported[$image['url']]=$aid;
  }
  $fronts=array();$preferred=0;
  foreach($in['selections'] as $selection){$v=$bySku[$selection['sku']]??null;if(!$v)throw new Exception('Unexpected variation SKU');
   $aid=$imported[$selection['url']];$v->set_image_id($aid);$v->save();$fronts[]=$aid;if($selection['preferred'])$preferred=$aid;}
  $fronts=array_values(array_unique($fronts));
  $p->set_name($item['title']);$p->set_description($item['description']);
  preg_match_all('/<p>(.*?)<\\/p>/s',$item['description'],$paragraphs);$p->set_short_description(implode('',array_slice($paragraphs[0],0,2)));
  if($old)$p->set_slug($old['slug']);
  $p->set_image_id($preferred?:$fronts[0]);$p->set_gallery_image_ids(array_values(array_diff($fronts,array($p->get_image_id()))));
  if($item['new']){$cats=$p->get_category_ids();foreach(array('t-shirts','christmas') as $slug){$term=get_term_by('slug',$slug,'product_cat');if(!$term)throw new Exception('Category missing');$cats[]=(int)$term->term_id;}$p->set_category_ids(array_values(array_unique($cats)));}
  $p->save();wc_delete_product_transients($id);clean_post_cache($id);
  echo 'SLESS_SAFE_JSON:'.json_encode(array('sku'=>$item['sku'],'id'=>$id,'title'=>$p->get_name(),'imageIds'=>$fronts,'variants'=>count($bySku),'url'=>$p->get_permalink(),'pricesPreserved'=>true,'ordersCreated'=>false));
  `;
  const id = Number(item.externalId || record.externalId || provider.external?.id || 0);
  const result = await sitegroundWordpress(php, {
    input: JSON.stringify({ item: { ...item, id }, selections, variants, images, baseline: baseline.products[String(id)] }),
    timeoutMs: 180_000,
  });
  report.products = report.products.filter(p => p.sku !== item.sku);
  report.products.push(result);
  await saveJson(`${dir}/woocommerce-repaired-images.json`, report);
  console.log(JSON.stringify(result));
}
