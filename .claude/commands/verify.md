---
description: Check the current change against the definition of done
---

Verify the current change against `docs/VERIFICATION.md`.

Run each rung's command from `docs/STACK.md`, in order. Stop at the first
failure and show me the **actual output**, not a summary of it.

Then report: what passed, what failed, what you did not test, and what could
not be tested at all with the reason.

If a failure looks like a product bug, open the evidence for that specific case
before you call it one. Broken tests look exactly like broken products.

Do not tell me it works if you have only run step 1.
