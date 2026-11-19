"use client";

import { useEffect, useRef, useState } from "react";
import { copyAiPack, shareAiPack } from "./ai-share";
import type { Budget } from "./model.mjs";

export default function AskAiSheet({ pack, book, onClose }: { pack: string; book: Budget; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [offerDownload, setOfferDownload] = useState(false);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  async function share() {
    setBusy(true);
    try {
      const result = await shareAiPack(pack);
      setOfferDownload(result.offerDownload);
      setMessage(result.method === "cancelled" ? "Sharing cancelled. Your book has not changed."
        : result.method === "clipboard" ? "Copied for AI. You can also download a copy below."
        : result.method === "download" ? "Sharing and copying are not available. Download a copy below."
        : "Shared a copy. Your book has not changed.");
    } catch {
      setOfferDownload(true);
      setMessage("Could not share this copy. Try copying or downloading it instead.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <dialog ref={dialog} className="ai-sheet" aria-labelledby="ask-ai-title" aria-describedby="ask-ai-description" onClose={onClose}>
      <div className="ai-sheet-heading">
        <h2 id="ask-ai-title">Ask AI</h2>
        <button className="text-button" onClick={() => dialog.current?.close()}>Close</button>
      </div>
      <p id="ask-ai-description">A read-only copy of your book. Nothing is sent to us.</p>
      <section className="ai-share-contents" aria-labelledby="ai-shared-title">
        <h3 id="ai-shared-title">What gets shared</h3>
        <ul>
          <li>Budget totals</li>
          <li>{book.categories.length} {book.categories.length === 1 ? "category" : "categories"}</li>
          <li>{book.expenses.length} spending {book.expenses.length === 1 ? "entry" : "entries"}</li>
          <li>{book.notes.trim() ? "Your notes" : "Notes (none added yet)"}</li>
        </ul>
      </section>
      <section className="ai-questions" aria-labelledby="ai-questions-title">
        <h3 id="ai-questions-title">Try asking</h3>
        <ul>
          <li>Where am I overspending?</li>
          <li>What’s left for the rest of the month?</li>
          <li>Write a short update for my partner.</li>
        </ul>
      </section>
      <div className="ai-sheet-actions">
        <button className="primary" disabled={busy} onClick={share}>{busy ? "Opening share…" : "Share to AI app"}</button>
        <button className="secondary" disabled={busy} onClick={async () => {
          try { await copyAiPack(pack); setMessage("Copied for AI."); }
          catch { setOfferDownload(true); setMessage("Could not copy. Select the preview text or download a copy."); }
        }}>Copy for AI</button>
      </div>
      <p className="hint">Paste into ChatGPT or Claude. Only share with an app you trust.</p>
      <p role="status">{message}</p>
      {offerDownload && <a className="text-button" download="ellies-book-ai.md" href={`data:text/markdown;charset=utf-8,${encodeURIComponent(pack)}`}>Download AI copy</a>}
      <details className="ai-exact-copy">
        <summary>See exactly what’s shared</summary>
        <label className="field">Exact copy
          <textarea className="ai-pack-preview" readOnly value={pack} />
        </label>
      </details>
    </dialog>
  );
}
