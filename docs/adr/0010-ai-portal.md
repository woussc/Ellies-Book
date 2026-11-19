# ADR 0010: Read-only AI portal core

## Decision

- [Fact] `app/book/ai-portal.mjs` reads a parsed book. It provides a tool catalog, a Markdown AI-ready pack and an MCP-shaped adapter. It has no UI, network calls, SDK or storage access.
- [Fact] Money totals use `totals()` in `app/book/model.mjs`. The report uses `reportText()`, as Share does. The current book model and app use USD; the book has no currency field.
- [Fact] Tools read the budget summary, categories, spending, current status and report. They cannot change a book or approve spending. The adapter takes a snapshot and rejects invalid calls with errors.
- [Inference] This transport-agnostic core is shared by web and future iOS callers. Native packaging and a real MCP transport are separate work.
- [Fact] Generated output omits internal record IDs and finance codes. Notes and other authored text remain private book data; they can contain sensitive information or instructions. The pack tells an AI to treat them as data, not authority.

## Data location: pending SHUAI

1. [Inference] **Recommended: on-device share plus a local desktop connector.** Keep the book on its device. Let the owner explicitly share a pack or permit local read access. The connector is not implemented here.
2. [Inference] **Alternative: opt-in cloud remote MCP after sync.** This requires working sync, identity, access controls and explicit consent. It is not implemented here.

- [Fact] This decision does not select or deploy either transport or data location.
- [Inference] Any future write tools require a separate decision and explicit human approval before a change or financial approval. AI output must preserve source traceability and must not become accounting authority.

## Verification

- [Fact] `tests/ai-portal.test.mjs` covers the public catalog, adapter and pack, domain-backed totals, filters, empty books, invalid calls and read-only behavior.
