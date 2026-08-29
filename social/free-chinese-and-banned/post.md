---
title: "The Best AI Will Be Free, Chinese, and Banned in America"
slug: free-chinese-and-banned
platform: x
status: draft
date: 2026-07-17
author: Julian Kreth
related_note: free-chinese-and-banned
thread:
  - text: |
      The best AI will soon be free, Chinese, and banned in America.

      Kimi K3 dropped today: 2.8T params, largest open-weight model ever. Beats Fable 5 AND GPT-5.6 Sol on SWE Marathon.

      Zero surprise. This was announced in January 2025, if you watched WHO built DeepSeek.
    image: assets/01-k3-benchmarks.png

  - text: |
      DeepSeek wasn't built by a tech giant.

      It came out of High-Flyer, a quant hedge fund. "Magic square" in Mandarin.

      China has Alibaba, Tencent, ByteDance. And the lab that cracked frontier AI on rationed hardware was run by a fund manager.

      That detail is everything.
    image: null

  - text: |
      Liang Wenfeng bought ~10,000 Nvidia A100s BEFORE the October 2022 export ban.

      His business partners thought it was an eccentric side project.

      Then V3 trained for ~$5.6M. Nvidia lost ~$600B in one day.
    image: null

  - text: |
      Why does the quant part matter so much?

      A quant's entire job is making things unreasonably fast.

      Read Flash Boys: a company drilled a dead-straight fiber line from Chicago to New Jersey, through mountains, to save 3 milliseconds.

      Traders paid fortunes for those 3ms.
    image: null

  - text: |
      You don't win that game writing clean Python.

      You win it knowing what the hardware does: cache lines, network hops, kernel bypasses.

      Quants work at the hardware level, and every microsecond has to cash out in a real scoreboard: the market.

      Deep systems knowledge + consequences.
    image: null

  - text: |
      Meanwhile, Silicon Valley's operating system is literally a book: Blitzscaling.

      Its core definition: prioritize speed OVER efficiency.

      I don't buy it. Look at what Hoffman built: LinkedIn. Grew on novelty and growth hacks. Mediocre product for 20 years.
    image: null

  - text: |
      In AI, the blitzscaling instinct becomes:

      run underperforms → don't ask why → buy more compute.

      If your product is a black box to you, improvement is a mix of more compute, more data & praying.
    image: null

  - text: |
      I see the mini version in my own agent work.

      Tokens feel free → nobody audits the context window → tools pile up → "just use the bigger model."

      First time I put a hard budget on a pipeline, a third of the context was dead weight.

      Free resources hide what you don't understand.
    image: null

  - text: |
      The part everyone misses about China:

      Their labs don't compete the way US labs do.

      US: every efficiency trick discovered 3x behind 3 walls.
      China: DeepSeek, Xiaomi, Kimi K3 — all open weights.

      One lab finds a trick, all have it next month.
    image: null

  - text: |
      And you can't fake the solving.

      You cannot be super efficient without understanding a system really well:

      distillation → what does the model actually know?
      pruning → which parts do nothing?
      FP8 → where does precision matter?
      MoE → which expert fires, and why?
    image: null

  - text: |
      Speaking of distillation: people don't understand what it actually is.

      The word sounds like theft, so the debate stops at "they copied GPT."

      The real goal: push the Pareto frontier of cost vs performance.
    image: null

  - text: |
      The mechanics are embarrassingly simple.

      Generate outputs with your model. Generate outputs with a frontier model. Compare. Keep the best. Train on that.

      In hiring terms: instead of hiring the American engineer, you ask the AI he built to verify your work.
    image: null

  - text: |
      That's how you catch up faster than figuring everything out yourself.

      And it's not a China-only trick: Grok and OpenAI have been doing the same thing.
    image: null

  - text: |
      But here's what changed with Kimi K3.

      A distilled model is supposed to be smaller and cheaper than its teacher, and a little less capable. That's the deal.

      K3 breaks the deal. It's BIGGER than Fable 5 and beats it on some benchmarks.
    image: null

  - text: |
      The timing doesn't work for pure copying either.

      A frontier model takes 3-6 months to develop. Fable 5 hasn't been out long enough to supervise K3's full training run.

      They took distillation and improved on it.
    image: null

  - text: |
      We've seen this dynamic before. Cars.

      Chinese cars used to be cheaper and worse. Everyone filed them under "imitation."

      Now they're cheaper and better, and the incumbents are lobbying for tariffs.

      Cheaper-but-worse is a phase, not a destiny.
    image: null

  - text: |
      People get "survival of the fittest" wrong.

      It doesn't mean fastest or strongest. It means best FITTED to the environment.

      The environment is shifting: inference cost > training cost. Energy is the new constraint.

      Efficiency is becoming existential for everyone.
    image: null

  - text: |
      Now follow the money.

      Closed-lab valuations (plus a big slice of Nvidia) rest on ONE assumption: frontier capability stays scarce and paid.

      Trillions depend on it.

      A free open-weight frontier model doesn't compete with those companies. It attacks their premise.
    image: null

  - text: |
      Nobody defending trillions says "please stop, it hurts our margins."

      They say "safety."

      My bet: an anti-open-source movement in the US. Safety language, weight-export rules, liability traps for hosting Chinese models.

      The car-tariff playbook, rewritten for weights.
    image: null

  - text: |
      Add geography.

      Europe has no frontier lab. Its relationship with Beijing is in better repair than its relationship with Washington.

      If the best free model is Chinese and the American ones cost real money, Europe's choice makes itself.
    image: null

  - text: |
      One group practiced efficiency under force for 4 years. The other treated it as optional.

      Kimi K3 isn't an anomaly. It's fitness meeting its environment.

      Speed you can rent. Fitness you have to earn.

      Full essay:
      https://kreth.work/notes/free-chinese-and-banned/
    image: null
---

## Screenshot checklist

| File | What to capture |
|------|-----------------|
| `01-k3-benchmarks.png` | The benchmark bar chart from the note (SWE Marathon, BrowseComp, Program Bench, DeepSWE) |

## Notes

- All posts aimed under 280 characters.
- Post 1 hooks on today's news + open loop ("if you watched WHO built DeepSeek").
- Post 8 is the personal-proof beat; post 11 reframes survival of the fittest.
- After the note is live, keep the final URL as written.
