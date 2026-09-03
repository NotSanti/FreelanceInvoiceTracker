import { addMonthsISO, endOfMonthISO, startOfMonthISO } from "@/lib/dates";

export type TaxableSupply = {
  date: string;
  amountCents: number;
};

export type ThresholdExceededBy =
  | "none"
  | "single_quarter"
  | "rolling_four_quarters";

export type SmallSupplierStatus = {
  isSmallSupplier: boolean;
  thresholdCents: number;
  currentQuarterTaxableSuppliesCents: number;
  rollingFourQuarterTaxableSuppliesCents: number;
  remainingBeforeThresholdCents: number;
  thresholdExceededBy: ThresholdExceededBy;
  isApproachingThreshold: boolean;
  estimatedRegistrationEffectiveDate?: string;
};

export type CalendarQuarter = {
  year: number;
  quarter: 1 | 2 | 3 | 4;
  start: string;
  end: string;
};

export function calendarQuarterFromDate(isoDate: string): CalendarQuarter {
  const year = Number(isoDate.slice(0, 4));
  const month = Number(isoDate.slice(5, 7));
  const quarter = (Math.floor((month - 1) / 3) + 1) as 1 | 2 | 3 | 4;
  const startMonth = (quarter - 1) * 3 + 1;
  const start = `${year}-${String(startMonth).padStart(2, "0")}-01`;
  const end = endOfMonthISO(addMonthsISO(start, 2));
  return { year, quarter, start, end };
}

export function previousCalendarQuarter(quarter: CalendarQuarter): CalendarQuarter {
  if (quarter.quarter === 1) {
    return calendarQuarterFromDate(`${quarter.year - 1}-12-01`);
  }
  return calendarQuarterFromDate(
    `${quarter.year}-${String((quarter.quarter - 2) * 3 + 1).padStart(2, "0")}-01`,
  );
}

export function rollingFourQuarters(asOfDate: string): CalendarQuarter[] {
  const current = calendarQuarterFromDate(asOfDate);
  const quarters = [current];
  let cursor = current;
  for (let index = 0; index < 3; index += 1) {
    cursor = previousCalendarQuarter(cursor);
    quarters.unshift(cursor);
  }
  return quarters;
}

function sumInRange(supplies: TaxableSupply[], start: string, end: string) {
  return supplies.reduce((sum, supply) => {
    if (supply.date >= start && supply.date <= end) {
      return sum + supply.amountCents;
    }
    return sum;
  }, 0);
}

export function evaluateSmallSupplierStatus({
  taxableSupplies,
  asOfDate,
  thresholdCents,
  approachingThresholdRatio = 0.8,
}: {
  taxableSupplies: TaxableSupply[];
  asOfDate: string;
  thresholdCents: number;
  approachingThresholdRatio?: number;
}): SmallSupplierStatus {
  const currentQuarter = calendarQuarterFromDate(asOfDate);
  const window = rollingFourQuarters(asOfDate);
  const currentQuarterTaxableSuppliesCents = sumInRange(
    taxableSupplies,
    currentQuarter.start,
    currentQuarter.end,
  );
  const rollingFourQuarterTaxableSuppliesCents = sumInRange(
    taxableSupplies,
    window[0].start,
    window[window.length - 1].end,
  );

  const exceededQuarter = currentQuarterTaxableSuppliesCents > thresholdCents;
  const exceededRolling = rollingFourQuarterTaxableSuppliesCents > thresholdCents;
  const thresholdExceededBy: ThresholdExceededBy = exceededQuarter
    ? "single_quarter"
    : exceededRolling
      ? "rolling_four_quarters"
      : "none";

  const remainingBeforeThresholdCents = Math.max(
    0,
    Math.min(
      thresholdCents - currentQuarterTaxableSuppliesCents,
      thresholdCents - rollingFourQuarterTaxableSuppliesCents,
    ),
  );

  let estimatedRegistrationEffectiveDate: string | undefined;
  if (exceededQuarter) {
    estimatedRegistrationEffectiveDate = startOfMonthISO(addMonthsISO(asOfDate, 1));
  } else if (exceededRolling) {
    estimatedRegistrationEffectiveDate = startOfMonthISO(
      addMonthsISO(currentQuarter.end, 2),
    );
  }

  return {
    isSmallSupplier: thresholdExceededBy === "none",
    thresholdCents,
    currentQuarterTaxableSuppliesCents,
    rollingFourQuarterTaxableSuppliesCents,
    remainingBeforeThresholdCents,
    thresholdExceededBy,
    isApproachingThreshold:
      thresholdExceededBy === "none" &&
      rollingFourQuarterTaxableSuppliesCents >=
        Math.round(thresholdCents * approachingThresholdRatio),
    estimatedRegistrationEffectiveDate,
  };
}
