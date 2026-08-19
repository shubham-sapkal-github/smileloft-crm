---
description: Set or change the project's stack in one place
argument-hint: e.g. "next.js, mongodb, vercel" or "react + vite, go api, postgres"
---

Set up or change the stack for this project. Requested: **$ARGUMENTS**

1. Look at what's already in the repo first — `package.json`, `go.mod`,
   `requirements.txt`, existing config, existing folders. Prefer what is
   actually here over what you would have picked.
2. Fill in `docs/STACK.md` from what I gave you. Infer what you reasonably can:
   a Next.js project's dev command, a Go project's test command, the standard
   place tests live for that ecosystem.
3. Leave a command row **blank** if that stack genuinely has no such step. Blank
   means "skip this rung", not "guess".
4. Ask me, in one batch, only what you truly can't infer.
5. Report back in three lines: what you filled in, what you guessed, what you
   need from me.

Edit `docs/STACK.md` and nothing else. If some other file needs changing when
the stack changes, tell me — that is a bug in this harness, not a normal edit.
