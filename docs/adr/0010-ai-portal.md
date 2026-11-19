# ADR 0010: Read-only AI portal core

## Decision

- [Fact] Accepted by SHUAI: Option 1 is the launch path. Cloud copy is later and opt-in.

- [Fact] `app/book/ai-portal.mjs` reads a parsed book. It provides a tool catalog, a Markdown AI-ready pack and an MCP-shaped adapter. It has no UI, network calls, SDK or storage access.
- [Fact] Money totals use `totals()` in `app/book/model.mjs`. The report uses `reportText()`, as Share does. The current book model and app use USD; the book has no currency field.
- [Fact] Tools read the budget summary, categories, spending, current status and report. They cannot change a book or approve spending. The adapter takes a snapshot and rejects invalid calls with errors.
- [Inference] This transport-agnostic core is shared by web and future iOS callers. Native packaging and a remote MCP transport are separate work; the local stdio connector reuses the same tools.
- [Fact] Generated output omits internal record IDs and finance codes. Notes and other authored text remain private book data; they can contain sensitive information or instructions. The pack tells an AI to treat them as data, not authority.

## Data location: accepted

1. [Fact] **Now: on-device share plus a local desktop connector.** Keep the book on its device. The owner explicitly shares a pack or permits local read access to a saved backup using `scripts/ellies-book-mcp.mjs`.
2. [Inference] **Later: opt-in cloud remote MCP after sync.** This requires working sync, identity, access controls and explicit consent. It is not implemented here.

- [Fact] `app/book/ai-share.ts` uses a registered native handler first, then Web Share (with a Markdown file when supported), then clipboard and a download offer. `registerNativeShare(fn)` lets a Capacitor wrapper supply native sharing without UI changes.
- [Fact] The Share flow previews the exact pack before sharing. The hook sends nothing to an Ellie’s Book server. A chosen AI app receives a copy only through the owner's action.
- [Inference] Any future write tools require a separate decision and explicit human approval before a change or financial approval. AI output must preserve source traceability and must not become accounting authority.

## Verification

- [Fact] `tests/ai-portal.test.mjs` covers the public catalog, adapter and pack, domain-backed totals, filters, empty books, invalid calls and read-only behavior.
