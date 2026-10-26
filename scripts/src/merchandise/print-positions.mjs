export function selectPrintPositions(product, placeholders) {
  if (/AOP|Backpack/i.test(product.catalogTitle)) {
    return placeholders.filter((p) => !/_(dtf|embroidery)$/.test(p.position));
  }
  const front = placeholders.find((p) => p.position === "front");
  return front ? [front] : [placeholders[0]];
}
