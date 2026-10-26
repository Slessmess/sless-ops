export function validateManifest(manifest) {
  if (manifest.account !== "slessismoree" || manifest.timezone !== "America/New_York" ||
      manifest.maxPostsPerDay !== 2 || manifest.minimumHoursBetweenPosts !== 6 ||
      manifest.paidSpendAuthorized !== false || manifest.posts.length !== 12)
    throw new Error("Unexpected campaign boundaries");
  const seen = new Set();
  const slots = [];
  const counts = new Map();
  for (const post of manifest.posts) {
    if (seen.has(post.id) || !["image", "video"].includes(post.kind) ||
        !/^[a-f0-9]{64}$/.test(post.assetSha256) ||
        !/^[a-f0-9]{64}$/.test(post.captionsSha256) ||
        !post.instagram || !post.facebook ||
        post.assetObject !== `assets/${post.id}-${post.assetSha256}.${post.kind === "video" ? "mp4" : "jpg"}`)
      throw new Error("Invalid approved campaign entry");
    seen.add(post.id);
    const when = new Date(post.publishAt);
    if (!Number.isFinite(+when) || !Number.isFinite(+new Date(post.expiresAt)) ||
        when > new Date(post.expiresAt) ||
        (post.notBefore && dateKey(when, manifest.timezone) < post.notBefore))
      throw new Error("Invalid campaign dates");
    slots.push(when);
    const day = dateKey(when, manifest.timezone);
    counts.set(day, (counts.get(day) || 0) + 1);
  }
  if (!seen.has("I08") || !seen.has("I09")) throw new Error("Required campaign entries missing");
  slots.sort((a, b) => a - b);
  if ([...counts.values()].some(count => count > 2) ||
      slots.some((time, i) => i && time - slots[i - 1] < 6 * 3600000))
    throw new Error("Staggered schedule violated");
}
export function dateKey(date, timezone = "America/New_York") {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(date);
}
export function nextDue(manifest, journal, now = new Date()) {
  validateManifest(manifest);
  const pending = manifest.posts.filter(post => !["published", "missed"].includes(journal.posts[post.id]?.status));
  if (pending.some(post => ["creation_started", "publication_started", "published_receipt_pending"].includes(journal.posts[post.id]?.status)))
    throw new Error("Uncertain previous write requires reconciliation; automatic retries blocked");
  return pending.filter(post => new Date(post.publishAt) <= now && now <= new Date(post.expiresAt) &&
      now - new Date(post.publishAt) <= 3600000 &&
      (!post.notBefore || dateKey(now, manifest.timezone) >= post.notBefore))
    .sort((a, b) => new Date(a.publishAt) - new Date(b.publishAt))[0] || null;
}
export function checkSpacing(manifest, journal, now) {
  const published = Object.values(journal.posts).filter(post => post.status === "published");
  if (published.some(post => !post.publishedAt || !Number.isFinite(+new Date(post.publishedAt))))
    throw new Error("Reconcile publication timestamps before posting");
  if (published.filter(post => dateKey(new Date(post.publishedAt)) === dateKey(now)).length >= manifest.maxPostsPerDay)
    throw new Error("Daily posting limit reached");
  if (published.some(post => now - new Date(post.publishedAt) < manifest.minimumHoursBetweenPosts * 3600000))
    throw new Error("Minimum six-hour spacing has not elapsed");
}
