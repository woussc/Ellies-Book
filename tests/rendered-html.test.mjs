import assert from "node:assert/strict";
import test from "node:test";

async function render() {
  const { default: worker } = await import("../dist/server/index.js");
  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    {
      ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
    },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("the real app renders Book-first onboarding and the approved navigation", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  for (const text of [
    "Ellie",
    "A book for your plans.",
    "Book name",
    "Household",
    "Just me",
    "Team",
    "Continue",
    "Plan by category",
    "Log spending",
    "Your board",
    "Your books",
    "Your profile",
    "Skip to content",
  ])
    assert.ok(html.includes(text), text);
  assert.doesNotMatch(
    html,
    /Function Budget Studio|classicStudioSlot|SEED_PROJECTS|Look A ·|Design preview|codex-preview|react-loading-skeleton/i,
  );
});

test("server rendering never claims browser data is already saved", async () => {
  const html = await (await render()).text();
  assert.match(html, /Opening book/);
  assert.doesNotMatch(
    html,
    />Saved on this device<|November rent|MKT-003/,
  );
  assert.match(html, /viewport-fit=cover/);
  assert.doesNotMatch(html, /fonts\.googleapis\.com/);
});
