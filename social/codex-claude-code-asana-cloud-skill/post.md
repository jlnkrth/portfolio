---
title: "Codex vs Claude Code — both pushed their own cloud when I asked for Asana"
slug: codex-claude-code-asana-cloud-skill
platform: x
status: draft
date: 2026-07-13
author: Julian Kreth
related_note: hosted-agents-from-asana
thread:
  - text: |
      I gave Codex and Claude Code the same prompt:

      "Run this skill in the cloud so a teammate can trigger it from Asana."

      Same goal. Same constraints. Two very similar answers.
    image: null

  - text: |
      What I wanted was boring infrastructure:

      a hosted agent that picks up work from Asana, runs a skill, posts the result back.

      Not a product pitch. Not a new workflow inside someone's IDE.
    image: null

  - text: |
      Codex first.

      In the thinking step it admits there are better fits for "trigger from Asana in the cloud."

      Then it recommends… Codex cloud / their hosted setup anyway.

      Screenshot 👇
    image: assets/01-codex-thinking-and-recommendation.png

  - text: |
      Claude Code did the same dance.

      Reasoning: "you probably want a generic worker or webhook, not us."

      Answer: here's how to wire it through Claude Code / their cloud offering.

      Screenshot 👇
    image: assets/02-claude-thinking-and-recommendation.png

  - text: |
      Both agents knew the right shape of the solution.

      Both still tried to route me through their own product.

      That's not helpfulness. That's capture — with a polite preamble.
    image: null

  - text: |
      We ended up with something simpler: hosted agents that actually listen to Asana.

      Full write-up coming — how we wired skills, webhooks, and workers so the team can trigger agents from a task comment.

      (link: /notes/hosted-agents-from-asana/ — publish when ready)
    image: null
---

## Screenshot checklist

Add these to `assets/` before publishing:

| File | What to capture |
|------|-----------------|
| `01-codex-thinking-and-recommendation.png` | Codex thread showing thinking/reasoning that acknowledges better alternatives, followed by a recommendation that still pushes Codex cloud |
| `02-claude-thinking-and-recommendation.png` | Claude Code thread with the same pattern — admits generic worker/webhook is the fit, then routes to Claude Code cloud |

**Tips:** crop to the thinking block + final recommendation. Redact API keys or internal URLs if visible.

## Notes for the blog post (`hosted-agents-from-asana`)

When the note is published:

1. Set `related_note: hosted-agents-from-asana` (already set).
2. Replace the placeholder link in the final thread post with the live note URL.
3. Optionally add a 7th thread post that's just the link + one-line hook.
