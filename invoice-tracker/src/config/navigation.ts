export const primaryNav = [
  { href: "/", label: "Overview" },
  { href: "/invoices", label: "Invoices" },
  { href: "/clients", label: "Clients" },
  { href: "/taxes", label: "Taxes" },
] as const;

export const secondaryNav = [
  { href: "/settings", label: "Settings" },
] as const;

export type NavItem = (typeof primaryNav)[number] | (typeof secondaryNav)[number];
