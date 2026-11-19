# Read-only AI portal core

Build a pure book tool catalog, Markdown AI pack and MCP-shaped adapter.
Use model totals and reportText; no UI, network or runtime dependencies.
Public seams: createAiPortal(book), buildAiReadyPack(book), createMcpAdapter(book).
Test all tools, domain equivalence, filters, empty books, invalid input and read-only behavior.
Document shared web/iOS core and pending data-location decision in ADR 0010.
Verify portal/domain/model tests, lint and build; commit and push feature branch.

## Launch scope update

SHUAI accepted Option 1 on-device for launch; cloud is later and opt-in.
Add a native-pluggable web share hook, a Look A Ask AI preview sheet, and a
dependency-free local MCP stdio connector with tests and a Claude Desktop guide.
Run the full test/lint/build gate and save 390/1440px screenshots outside git.
