import assert from "node:assert/strict";
import test from "node:test";
import {
  GET,
  nextBusinessDayAt9AmPeru,
} from "../../app/api/next-business-day/route.ts";

// All inputs/expectations below are given as UTC ISO strings, with a
// comment naming the corresponding Peru wall-clock (UTC-5) day.

test("weekday (Peru) at midday rolls to the next day at 9am Peru", () => {
  const now = new Date("2026-09-08T15:00:00.000Z"); // Tue 10am Peru
  const result = nextBusinessDayAt9AmPeru(now);
  assert.equal(result.toISOString(), "2026-09-09T14:00:00.000Z"); // Wed 9am Peru
});

test("Friday (Peru) rolls to the following Monday, not Saturday", () => {
  const now = new Date("2026-09-11T15:00:00.000Z"); // Fri 10am Peru
  const result = nextBusinessDayAt9AmPeru(now);
  assert.equal(result.toISOString(), "2026-09-14T14:00:00.000Z"); // Mon 9am Peru
});

test("Saturday (Peru) rolls to the following Monday", () => {
  const now = new Date("2026-09-12T15:00:00.000Z"); // Sat 10am Peru
  const result = nextBusinessDayAt9AmPeru(now);
  assert.equal(result.toISOString(), "2026-09-14T14:00:00.000Z"); // Mon 9am Peru
});

test("Sunday (Peru) rolls to the following Monday", () => {
  const now = new Date("2026-09-13T15:00:00.000Z"); // Sun 10am Peru
  const result = nextBusinessDayAt9AmPeru(now);
  assert.equal(result.toISOString(), "2026-09-14T14:00:00.000Z"); // Mon 9am Peru
});

test("late-night Peru time still uses the Peru calendar date, not the UTC one", () => {
  // 2026-09-08T04:00:00Z is 2026-09-07T23:00 in Peru (still Monday night).
  const now = new Date("2026-09-08T04:00:00.000Z");
  const result = nextBusinessDayAt9AmPeru(now);
  assert.equal(result.toISOString(), "2026-09-08T14:00:00.000Z"); // Tue 9am Peru
});

test("month rollover: last day of the month rolls into the 1st correctly", () => {
  const now = new Date("2026-08-31T15:00:00.000Z"); // Mon 10am Peru
  const result = nextBusinessDayAt9AmPeru(now);
  assert.equal(result.toISOString(), "2026-09-01T14:00:00.000Z"); // Tue 9am Peru
});

test("GET returns { date } as an ISO string for the current time", async () => {
  const response = await GET();
  assert.equal(response.status, 200);
  const json = await response.json();
  assert.match(json.date, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
});
