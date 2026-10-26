type ClerkIdentity = {
  id: string;
  primaryEmailAddressId: string | null;
  emailAddresses: {
    id: string;
    emailAddress: string;
    verification: { status: string } | null;
  }[];
};

export async function isOpsAdministrator(
  userId: string,
  config: { userIds?: string; emails?: string },
  lookup: (id: string) => Promise<ClerkIdentity>,
): Promise<boolean> {
  const list = (value?: string) => (value ?? "").split(",").map(v => v.trim()).filter(Boolean);
  if (list(config.userIds).includes(userId)) return true;
  const emails = list(config.emails).map(email => email.toLowerCase());
  if (!emails.length) return false;
  // Resolve in the running environment's Clerk instance. Never trust email
  // supplied by the browser, editable metadata, or a development user ID in prod.
  const user = await lookup(userId);
  if (user.id !== userId) return false;
  return user.emailAddresses.some(email =>
    email.id === user.primaryEmailAddressId &&
    email.verification?.status === "verified" &&
    emails.includes(email.emailAddress.trim().toLowerCase()),
  );
}
