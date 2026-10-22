/**
 * Dependency-free markdown -> rich-text renderer (Wave 10 WS-C).
 *
 * SHUAI asked for the Notes reading pane to look like "a proper text file",
 * not a raw/plain markdown dump. This module turns the authored markdown into a
 * polished, document-grade set of SEMANTIC React elements (<h1>..<h3>, <p>,
 * <ul>/<ol>/<li>, <blockquote>, <hr>, <pre>/<code>) while preserving the exact
 * `[[wikilink]]` -> jumpToNode and `#tag` -> tag-filter interactivity the app
 * already ships.
 *
 * It is intentionally small and in-repo (no npm dependency): the sandbox cannot
 * install packages, the parsing of wikilinks/tags stays in the pure engine
 * (`extractWikilinks` in `budget-domain.mjs`, UNCHANGED), and this renderer only
 * composes block-level markdown around the SAME inline pass the preview already
 * used. Full CommonMark/GFM (tables, task lists, nested quotes) is deferred to a
 * follow-up that may add a lightweight parser with the lockfile refreshed in CI.
 */

import { Fragment, ReactNode } from "react";

/** Interactive handlers the preview wires to its existing node/tag behaviour. */
export type MarkdownHandlers = {
  /** Jump to the graph node a `[[wikilink]]` targets. */
  onWikilink: (target: string) => void;
  /** Apply the tag filter a `#tag` selects. */
  onTag: (tag: string) => void;
};

/**
 * Strip a leading YAML frontmatter block. The frontmatter bar is rendered
 * separately by the preview (from `extractWikilinks().frontmatter`), so the
 * reading body must not repeat it.
 */
export function stripFrontmatter(markdown: string): string {
  return markdown.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
}

// Matches a `[[target|alias]]` / `[[target]]` wikilink OR a `#tag`. This is the
// SAME token shape the preview used before; the pills it produces are identical.
const INLINE_LINK_REGEX =
  /\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]|#[a-zA-Z][a-zA-Z0-9/_-]*/g;
// Matches **bold**, *italic*/_italic_, and `inline code`.
const INLINE_EMPHASIS_REGEX =
  /(\*\*([^*]+?)\*\*|\*([^*]+?)\*|_([^_]+?)_|`([^`]+?)`)/g;

/**
 * Tokenize one line of inline markdown into React nodes: wikilink/tag pills plus
 * bold/italic/inline-code spans. The wikilink/tag pass runs first (so emphasis
 * markers inside a link label are not mis-parsed), then the plain-text segments
 * between pills get the emphasis pass.
 */
function renderInline(
  text: string,
  handlers: MarkdownHandlers,
  keyPrefix: string,
): ReactNode[] {
  const out: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let i = 0;
  INLINE_LINK_REGEX.lastIndex = 0;

  while ((match = INLINE_LINK_REGEX.exec(text)) !== null) {
    if (match.index > lastIndex) {
      out.push(
        ...renderEmphasis(
          text.slice(lastIndex, match.index),
          `${keyPrefix}-t${i}`,
        ),
      );
    }
    if (match[0].startsWith("[[")) {
      const target = match[1].trim();
      const label = (match[2] ? match[2] : match[1]).trim();
      out.push(
        <button
          key={`${keyPrefix}-w${i}`}
          type="button"
          className="eb-wikilink-pill"
          onClick={() => handlers.onWikilink(target)}
        >
          [[{label}]]
        </button>,
      );
    } else {
      const tag = match[0].slice(1).toLowerCase();
      out.push(
        <button
          key={`${keyPrefix}-g${i}`}
          type="button"
          className="eb-tag-pill"
          onClick={() => handlers.onTag(tag)}
        >
          {match[0]}
        </button>,
      );
    }
    lastIndex = INLINE_LINK_REGEX.lastIndex;
    i += 1;
  }
  if (lastIndex < text.length) {
    out.push(...renderEmphasis(text.slice(lastIndex), `${keyPrefix}-t${i}`));
  }
  return out;
}

// Render bold, italic (asterisk or underscore) and inline code in a plain run.
function renderEmphasis(text: string, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let i = 0;
  INLINE_EMPHASIS_REGEX.lastIndex = 0;

  while ((match = INLINE_EMPHASIS_REGEX.exec(text)) !== null) {
    if (match.index > lastIndex) {
      out.push(
        <Fragment key={`${keyPrefix}-x${i}`}>
          {text.slice(lastIndex, match.index)}
        </Fragment>,
      );
    }
    if (match[2] !== undefined) {
      out.push(<strong key={`${keyPrefix}-b${i}`}>{match[2]}</strong>);
    } else if (match[3] !== undefined || match[4] !== undefined) {
      out.push(
        <em key={`${keyPrefix}-i${i}`}>{match[3] ?? match[4]}</em>,
      );
    } else if (match[5] !== undefined) {
      out.push(
        <code key={`${keyPrefix}-c${i}`} className="eb-md-code">
          {match[5]}
        </code>,
      );
    }
    lastIndex = INLINE_EMPHASIS_REGEX.lastIndex;
    i += 1;
  }
  if (lastIndex < text.length) {
    out.push(
      <Fragment key={`${keyPrefix}-x${i}`}>{text.slice(lastIndex)}</Fragment>,
    );
  }
  return out;
}

const HEADING_REGEX = /^(#{1,6})\s+(.*)$/;
const UL_ITEM_REGEX = /^\s*[-*]\s+(.*)$/;
const OL_ITEM_REGEX = /^\s*\d+\.\s+(.*)$/;
const BLOCKQUOTE_REGEX = /^\s*>\s?(.*)$/;
const HR_REGEX = /^\s*(-{3,}|\*{3,}|_{3,})\s*$/;
const FENCE_REGEX = /^\s*```/;

/**
 * Parse block-level markdown into semantic React elements.
 *
 * Supported blocks: ATX headings (`#`..`######`, mapped onto the 24/20/16
 * type scale), blank-line-separated paragraphs, unordered (`-`/`*`) and ordered
 * (`1.`) lists, blockquotes (`>`), horizontal rules (`---`/`***`/`___`), and
 * fenced code blocks (```). Inline: `[[wikilink]]`, `#tag`, bold, italic and
 * inline `code`.
 */
export function renderMarkdownDocument(
  markdown: string,
  handlers: MarkdownHandlers,
): ReactNode[] {
  const body = stripFrontmatter(markdown);
  const lines = body.split(/\r?\n/);
  const blocks: ReactNode[] = [];
  let paragraph: string[] = [];
  let key = 0;

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    const nodeKey = `p-${key++}`;
    // Soft line breaks inside a paragraph become <br/>, so authored line wraps
    // read as the writer intended without fragmenting into a wall of <p>.
    const inner: ReactNode[] = [];
    paragraph.forEach((ln, idx) => {
      if (idx > 0) inner.push(<br key={`${nodeKey}-br${idx}`} />);
      inner.push(...renderInline(ln, handlers, `${nodeKey}-l${idx}`));
    });
    blocks.push(
      <p key={nodeKey} className="eb-md-paragraph">
        {inner}
      </p>,
    );
    paragraph = [];
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];

    // Blank line: close the current paragraph.
    if (line.trim() === "") {
      flushParagraph();
      continue;
    }

    // Fenced code block: collect raw lines verbatim until the closing fence.
    if (FENCE_REGEX.test(line)) {
      flushParagraph();
      const code: string[] = [];
      i += 1;
      while (i < lines.length && !FENCE_REGEX.test(lines[i])) {
        code.push(lines[i]);
        i += 1;
      }
      blocks.push(
        <pre key={`pre-${key++}`} className="eb-md-pre">
          <code>{code.join("\n")}</code>
        </pre>,
      );
      continue;
    }

    // Horizontal rule.
    if (HR_REGEX.test(line)) {
      flushParagraph();
      blocks.push(<hr key={`hr-${key++}`} className="eb-md-hr" />);
      continue;
    }

    // ATX heading. Six markdown levels collapse onto a 3-step scale
    // (h1=24, h2=20, h3=16) so Notes never grows a sixth type size.
    const heading = line.match(HEADING_REGEX);
    if (heading) {
      flushParagraph();
      const level = heading[1].length;
      const content = renderInline(heading[2], handlers, `h-${key}`);
      const nodeKey = `h-${key++}`;
      if (level === 1) {
        blocks.push(
          <h1 key={nodeKey} className="eb-md-h1">
            {content}
          </h1>,
        );
      } else if (level === 2) {
        blocks.push(
          <h2 key={nodeKey} className="eb-md-h2">
            {content}
          </h2>,
        );
      } else {
        blocks.push(
          <h3 key={nodeKey} className="eb-md-h3">
            {content}
          </h3>,
        );
      }
      continue;
    }

    // Blockquote: collect consecutive `>` lines.
    if (BLOCKQUOTE_REGEX.test(line)) {
      flushParagraph();
      const quoteLines: string[] = [];
      while (i < lines.length && BLOCKQUOTE_REGEX.test(lines[i])) {
        quoteLines.push(lines[i].match(BLOCKQUOTE_REGEX)![1]);
        i += 1;
      }
      i -= 1;
      const nodeKey = `bq-${key++}`;
      blocks.push(
        <blockquote key={nodeKey} className="eb-md-quote">
          {quoteLines.map((ql, idx) => (
            <Fragment key={`${nodeKey}-l${idx}`}>
              {idx > 0 ? <br /> : null}
              {renderInline(ql, handlers, `${nodeKey}-r${idx}`)}
            </Fragment>
          ))}
        </blockquote>,
      );
      continue;
    }

    // Ordered list: collect consecutive `1.` items.
    if (OL_ITEM_REGEX.test(line)) {
      flushParagraph();
      const items: string[] = [];
      while (i < lines.length && OL_ITEM_REGEX.test(lines[i])) {
        items.push(lines[i].match(OL_ITEM_REGEX)![1]);
        i += 1;
      }
      i -= 1;
      const nodeKey = `ol-${key++}`;
      blocks.push(
        <ol key={nodeKey} className="eb-md-list">
          {items.map((it, idx) => (
            <li key={`${nodeKey}-i${idx}`} className="eb-md-list-item">
              {renderInline(it, handlers, `${nodeKey}-i${idx}`)}
            </li>
          ))}
        </ol>,
      );
      continue;
    }

    // Unordered list: collect consecutive `-`/`*` items.
    if (UL_ITEM_REGEX.test(line)) {
      flushParagraph();
      const items: string[] = [];
      while (i < lines.length && UL_ITEM_REGEX.test(lines[i])) {
        items.push(lines[i].match(UL_ITEM_REGEX)![1]);
        i += 1;
      }
      i -= 1;
      const nodeKey = `ul-${key++}`;
      blocks.push(
        <ul key={nodeKey} className="eb-md-list">
          {items.map((it, idx) => (
            <li key={`${nodeKey}-i${idx}`} className="eb-md-list-item">
              {renderInline(it, handlers, `${nodeKey}-i${idx}`)}
            </li>
          ))}
        </ul>,
      );
      continue;
    }

    // Otherwise part of a paragraph.
    paragraph.push(line);
  }
  flushParagraph();

  return blocks;
}
