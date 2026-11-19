# Ask AI with an on-device book

[Fact] In **Share a report**, choose **Ask AI**. Review the copy, including private notes. Share it to an app you trust, copy it, or download `ellies-book-ai.md` when sharing is unavailable. Nothing is sent to an Ellie's Book server. The receiving AI app applies its own data policy.

## Claude Desktop local connector

[Fact] Download a **book backup** from Ellie's Book. The connector reads `ellies-book.md`, not the shorter AI pack. It reads the saved file on each tool request. It cannot write a book. Update the backup when you want fresh data.

Use Node 22.13 or later. Add this entry to Claude Desktop's `claude_desktop_config.json`, using absolute paths on your machine, then restart Claude Desktop:

```json
{
  "mcpServers": {
    "ellies-book": {
      "command": "node",
      "args": ["/absolute/path/to/Ellies-Book/scripts/ellies-book-mcp.mjs", "/absolute/path/to/ellies-book.md"]
    }
  }
}
```

[Fact] Alternatively, set `env: { "ELLIES_BOOK_FILE": "/absolute/path/to/ellies-book.md" }` in the server entry and omit the second argument. Use the absolute Node executable path if the desktop app cannot find `node`.

[Fact] The server uses newline-delimited JSON-RPC over stdio. It supports `initialize`, `notifications/initialized`, `ping`, `tools/list` and `tools/call`. It opens no network port and installs no SDK. It offers the five read-only tools from ADR 0010.

[Inference] Local file access does not make an AI conversation offline. Claude Desktop may send tool results to its model provider. Give access only to a backup you intend to share.

## Native wrapper

[Fact] A future Capacitor wrapper can call `registerNativeShare(async (pack) => { /* share the text with @capacitor/share */ })` from `app/book/ai-share.ts`. The web UI needs no change. Call `registerNativeShare()` to remove the handler. Native packaging and the plugin are not included here.
