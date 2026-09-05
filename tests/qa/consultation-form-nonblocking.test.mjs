// Real DOM interaction tests proving app/ConsultationForm.tsx's fire-and-forget
// CRM lead-capture fetch() never blocks or delays the WhatsApp handoff.
//
// tests/qa/crm-lead-route.test.mjs only exercises the server-side route
// handler in isolation via direct POST() calls — it never renders or
// submits the client component, and tests/qa/analytics-events.test.mjs's
// source-order assertion only proves statement ORDER in the source text,
// not runtime behavior. This file renders the real component in jsdom,
// mocks window.open and fetch, submits the form, and asserts window.open
// plus the "sent" status text both land synchronously while the mocked
// fetch's promise is still pending/unresolved (or rejecting) — proving the
// requirement from openspec/changes/website-crm-lead-capture/specs/
// website-lead-capture/spec.md's "Non-Blocking Lead Capture Call" at
// runtime, not just by source inspection.
//
// jsdom globals must exist before react-dom/client and the component are
// imported, and the tsx loader must be registered before importing the
// .tsx source file — both happen synchronously below, then everything else
// is a dynamic import. Same setup convention as
// tests/qa/mobile-nav-interaction.test.mjs.

import assert from "node:assert/strict";
import test from "node:test";
import { register } from "tsx/esm/api";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost/",
  pretendToBeVisual: true,
});

globalThis.window = dom.window;
globalThis.document = dom.window.document;
// Node has its own read-only global `navigator` (getter, no setter) — must
// override via defineProperty instead of assignment.
Object.defineProperty(globalThis, "navigator", {
  value: dom.window.navigator,
  configurable: true,
  writable: true,
});
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.Event = dom.window.Event;
globalThis.FormData = dom.window.FormData;
globalThis.requestAnimationFrame =
  dom.window.requestAnimationFrame ?? ((cb) => setTimeout(cb, 0));
globalThis.cancelAnimationFrame =
  dom.window.cancelAnimationFrame ?? clearTimeout;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

register();

const React = await import("react");
const { render, fireEvent, cleanup } = await import("@testing-library/react");
const { ConsultationForm } = await import("../../app/ConsultationForm.tsx");

function renderForm() {
  return render(React.createElement(ConsultationForm));
}

function fillRequiredFields() {
  const form = document.querySelector("form.consultation-form");
  fireEvent.change(form.querySelector('input[name="name"]'), {
    target: { value: "Juan Perez" },
  });
  fireEvent.change(form.querySelector('input[name="city"]'), {
    target: { value: "Piura" },
  });
  fireEvent.change(form.querySelector('select[name="service"]'), {
    target: { value: "REINFO" },
  });
  fireEvent.change(form.querySelector('textarea[name="question"]'), {
    target: { value: "Necesito orientacion sobre mi tramite REINFO." },
  });
  return form;
}

function getStatusText() {
  return document.querySelector(".form-status").textContent;
}

test.afterEach(() => {
  cleanup();
  delete globalThis.fetch;
});

test("window.open and the sent status fire before a slow CRM fetch ever resolves", (t) => {
  let fetchSettled = false;
  let resolveFetch;
  const pendingFetch = new Promise((resolve) => {
    resolveFetch = resolve;
  });
  const fetchMock = t.mock.fn((..._args) =>
    pendingFetch.then(() => {
      fetchSettled = true;
      return { ok: true };
    }),
  );
  globalThis.fetch = fetchMock;

  renderForm();
  const form = fillRequiredFields();
  const windowOpenMock = t.mock.fn(() => null);
  globalThis.window.open = windowOpenMock;

  fireEvent.submit(form);

  assert.equal(
    windowOpenMock.mock.calls.length,
    1,
    "window.open must be called synchronously on submit",
  );
  assert.match(
    windowOpenMock.mock.calls[0].arguments[0],
    /^https:\/\/wa\.me\//,
    "window.open must be called with the WhatsApp deep link",
  );
  assert.equal(
    getStatusText(),
    "Tu mensaje fue preparado y enviado a WhatsApp.",
    "the sent status must render synchronously on submit",
  );
  assert.equal(
    fetchMock.mock.calls.length,
    1,
    "the CRM lead-capture fetch must actually be attempted",
  );
  assert.equal(fetchMock.mock.calls[0].arguments[0], "/api/crm-lead");
  assert.equal(fetchMock.mock.calls[0].arguments[1].method, "POST");
  assert.equal(
    fetchSettled,
    false,
    "the CRM fetch must still be pending/unresolved when WhatsApp already opened",
  );

  // Resolve the deferred promise so it does not linger past the test.
  resolveFetch();
});

test("a rejecting CRM fetch is silently absorbed and never blocks or delays window.open", async (t) => {
  const fetchMock = t.mock.fn(() => Promise.reject(new Error("network down")));
  globalThis.fetch = fetchMock;

  renderForm();
  const form = fillRequiredFields();
  const windowOpenMock = t.mock.fn(() => null);
  globalThis.window.open = windowOpenMock;

  fireEvent.submit(form);

  assert.equal(
    windowOpenMock.mock.calls.length,
    1,
    "window.open must fire even though the CRM fetch will reject",
  );
  assert.equal(
    getStatusText(),
    "Tu mensaje fue preparado y enviado a WhatsApp.",
    "the sent status must render even though the CRM fetch will reject",
  );
  assert.equal(fetchMock.mock.calls.length, 1);

  // Let the rejected fetch's microtask settle. The component's own
  // `.catch(() => {})` must absorb it — no unhandled rejection, no thrown
  // error reaching this test, and no extra window.open call triggered by
  // the rejection.
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(
    windowOpenMock.mock.calls.length,
    1,
    "no extra window.open calls must be triggered once the rejection settles",
  );
});
