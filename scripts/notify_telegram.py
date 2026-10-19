"""Gated Telegram Bot Notifier for Ellie's Book (@Hydrateh_bot).

Strictly enforces SHUAI's notification policy:
- ONLY push to Telegram for:
  1. Key architectural/product decisions requiring SHUAI's choice (--type decision)
  2. Major feature updates / completed milestone waves (--type milestone)
"""

import argparse
import os
import sys
import urllib.request
import json


def send_telegram_notification(msg_type: str, title: str, body: str) -> None:
    bot_token = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
    chat_id = os.environ.get("TELEGRAM_CHAT_ID", "").strip()

    if not bot_token or not chat_id:
        print("Error: TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID must be set.", file=sys.stderr)
        sys.exit(1)

    badge = (
        "🧭 *ELLIE'S BOOK — KEY DECISION REQUIRED*"
        if msg_type == "decision"
        else "🚀 *ELLIE'S BOOK — MAJOR FEATURE UPDATE*"
    )
    text = f"{badge}\n*{title}*\n\n{body}"

    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
    payload = json.dumps({
        "chat_id": chat_id,
        "text": text[:4000],
        "parse_mode": "Markdown",
        "disable_web_page_preview": True,
    }).encode("utf-8")

    req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            if resp.status == 200:
                print(f"[Telegram Gate] Sent {msg_type} notification: {title}")
                return
    except Exception:
        # Fallback without Markdown parse_mode if special characters caused a 400
        fallback_payload = json.dumps({
            "chat_id": chat_id,
            "text": text[:4000],
            "disable_web_page_preview": True,
        }).encode("utf-8")
        req2 = urllib.request.Request(
            url, data=fallback_payload, headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req2, timeout=15) as resp2:
            print(f"[Telegram Gate] Sent {msg_type} notification (plain fallback): {title}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Send gated decision or milestone updates to Telegram.")
    parser.add_argument(
        "--type",
        choices=["decision", "milestone"],
        required=True,
        help="Strictly 'decision' (requires SHUAI's choice) or 'milestone' (major feature update).",
    )
    parser.add_argument("--title", required=True, help="Short headline for the decision or milestone.")
    parser.add_argument("--body", required=True, help="Structured options or milestone summary.")
    args = parser.parse_args()
    send_telegram_notification(args.type, args.title, args.body)


if __name__ == "__main__":
    main()
