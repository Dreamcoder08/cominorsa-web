// app/api/next-business-day/route.ts
//
// Utility endpoint the Twenty CRM workflow calls (via its HTTP Request
// node) to set a Task's follow-up due date. Twenty's own workflow editor
// has no relative-date function on this self-hosted instance — its
// "Code - Logic Function" node type is disabled — so this stands in for
// that missing capability.
//
// "Next business day" means Monday-Friday only; it does not account for
// Peruvian public holidays.

const PERU_UTC_OFFSET_MS = -5 * 60 * 60 * 1000; // Peru is UTC-5, no DST.
const BUSINESS_START_HOUR_PERU = 9;

export async function GET(): Promise<Response> {
  const date = nextBusinessDayAt9AmPeru(new Date());
  return Response.json({ date: date.toISOString() });
}

// Exported for unit testing with a controlled "now".
export function nextBusinessDayAt9AmPeru(nowUtc: Date): Date {
  // Shift the timestamp so its UTC-labeled getters read Peru's wall-clock
  // date/time instead of the true UTC one — cheaper than pulling in a
  // timezone library for a single fixed, non-DST offset.
  const peruNow = new Date(nowUtc.getTime() + PERU_UTC_OFFSET_MS);

  let candidate = new Date(
    Date.UTC(
      peruNow.getUTCFullYear(),
      peruNow.getUTCMonth(),
      peruNow.getUTCDate() + 1,
    ),
  );

  const dayOfWeek = candidate.getUTCDay(); // 0 = Sunday, 6 = Saturday
  if (dayOfWeek === 6) {
    candidate = new Date(candidate.getTime() + 2 * 24 * 60 * 60 * 1000);
  } else if (dayOfWeek === 0) {
    candidate = new Date(candidate.getTime() + 1 * 24 * 60 * 60 * 1000);
  }

  const peruBusinessMoment = new Date(
    Date.UTC(
      candidate.getUTCFullYear(),
      candidate.getUTCMonth(),
      candidate.getUTCDate(),
      BUSINESS_START_HOUR_PERU,
    ),
  );

  // Shift back out of the Peru-labeled-as-UTC frame into real UTC.
  return new Date(peruBusinessMoment.getTime() - PERU_UTC_OFFSET_MS);
}
