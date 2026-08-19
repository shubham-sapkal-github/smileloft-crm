# Definition of done

Nothing is done because it ran once. Work up the ladder. Commands come from
`docs/STACK.md` — if a command is blank there, say you skipped that rung and
why, don't invent one.

1. **It compiles.** The `lint / typecheck` and `build` commands pass.
2. **Tests pass.** The `test` command. New logic leaves one runnable check
   behind — the smallest thing that fails if the logic breaks. No frameworks or
   fixtures beyond what the project already uses.
3. **The public surface hasn't moved by accident.** Routes, exported functions,
   API response shapes. If something changed, it was on purpose and it's in the
   spec.
4. **Watched happen for real.** In the browser, against real data, doing what a
   user would actually do. This rung catches what every rung above it misses.

## The report

State plainly:

- what passed
- what failed, with the actual output pasted
- what wasn't tested, and why
- what couldn't be tested at all, and why

A case that couldn't be produced is recorded with its reason, not dropped to
make the total look better.

## Before believing a failure

Open the evidence for that specific case first. **Broken tests look exactly
like broken products.** A suite that cries wolf is worse than no suite, because
people stop reading it.
