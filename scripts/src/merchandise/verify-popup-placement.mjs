/** Read-only supplier checks; saves local evidence, never edits artwork/products. */
import { readFile } from "node:fs/promises";
import { isDeepStrictEqual } from "node:util";
import { api, saveJson } from "./printify-api.mjs";
const path = "wordpress/sless-refresh/printify-popup-drafts.json";
const receipts = JSON.parse(await readFile(path, "utf8"));
const maxErrorPixels = 0.05; // One twentieth of a supplier-template pixel.
for (const [id, row] of Object.entries(receipts.products).filter(([, p]) => !p.verified)) {
  const [a, b] = await Promise.all([
    api(`shops/${receipts.sourceShopId}/products/${id}.json`),
    api(`shops/${receipts.destinationShopId}/products/${row.productId}.json`),
  ]);
  const selected = p => p.variants.filter(v => v.is_enabled).sort((x,y) => x.id-y.id);
  const av = selected(a), bv = selected(b);
  if (b.visible !== false || a.title !== b.title || a.description !== b.description ||
      a.blueprint_id !== b.blueprint_id || a.print_provider_id !== b.print_provider_id ||
      !isDeepStrictEqual(av.map(v=>[v.id,v.price]), bv.map(v=>[v.id,v.price])) ||
      !isDeepStrictEqual(a.print_details, b.print_details)) throw Error("Non-placement configuration mismatch");
  const templates = await api(`catalog/blueprints/${a.blueprint_id}/print_providers/${a.print_provider_id}/variants.json`);
  const evidence = [];
  for (const v of av) {
    const positions = p => p.print_areas.filter(ar => ar.variant_ids.includes(v.id))
      .flatMap(ar => ar.placeholders.filter(h => h.images?.length).map(h => ({
        position:h.position, method:h.decoration_method, background:ar.background, images:h.images,
      }))).sort((x,y)=>x.position.localeCompare(y.position));
    const from = positions(a), to = positions(b);
    if (from.length !== to.length || !from.length) throw Error("Print position mismatch");
    from.forEach((h, index) => {
      const dest = to[index];
      const shape = templates.variants.find(c=>c.id===v.id)?.placeholders.find(p=>p.position===h.position);
      if (!shape?.width || !shape.height || h.position !== dest.position || h.method !== dest.method ||
          h.background !== dest.background || h.images.length !== dest.images.length) throw Error("Template/layer mismatch");
      h.images.forEach((im, i) => {
        const dm = dest.images[i];
        if (im.id !== dm.id || !!im.flipX !== !!dm.flipX || !!im.flipY !== !!dm.flipY ||
            !isDeepStrictEqual(im.pattern, dm.pattern) || Math.abs(im.scale-dm.scale)>1e-12 ||
            Math.abs(im.angle-dm.angle)>1e-12) throw Error("Artwork transform or stacking mismatch");
        const x = Math.abs(im.x-dm.x)*shape.width, y = Math.abs(im.y-dm.y)*shape.height;
        if (!Number.isFinite(x+y) || x>maxErrorPixels || y>maxErrorPixels) throw Error("Placement exceeds physical tolerance");
        evidence.push({ variant:v.id, position:h.position, xErrorPixels:x, yErrorPixels:y });
      });
    });
  }
  row.verified = true;
  row.enabledVariants = av.length;
  row.placementVerification = {
    method:"Original supplier variant template dimensions, exact asset/layer/configuration checks",
    tolerancePixels:maxErrorPixels,
    maximumObservedErrorPixels:Math.max(...evidence.flatMap(e=>[e.xErrorPixels,e.yErrorPixels])),
    evidence,
  };
  delete row.reviewReason;
  await saveJson(path, receipts);
  console.log(JSON.stringify({verified:row.title, hidden:true, maxTemplatePixelError:row.placementVerification.maximumObservedErrorPixels}));
}
