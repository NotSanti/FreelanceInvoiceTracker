export const DASHBOARD_PERIODS = [
  { value: "month", label: "This month" },
  { value: "year", label: "This year" },
] as const;

export type DashboardPeriodKind = (typeof DASHBOARD_PERIODS)[number]["value"];

export const DUE_SOON_DAYS = 14;
export const OLD_DRAFT_DAYS = 14;
export const RECENT_INVOICE_LIMIT = 5;
export const ATTENTION_LIMIT = 8;
export const MONTH_CHART_MONTHS = 6;
