# Working from a spec

The user writes detailed specs (new cards, move sets, rebalances). They are good but have gaps, and the user expects those gaps found and asked about before anything is built. A wrong guess costs a whole rework.

## Steps

1. **Read the spec against the code.** For every item, find the code or data it changes. Done when each item maps to a place, or is listed as a gap.
2. **List the gaps.** A gap is anything the code can't take as written:
   - it contradicts the codebase: the data is stored differently, an effect it names doesn't exist, two moves would share an id;
   - it contradicts itself: a rule that undercuts another, numbers that don't add up;
   - it leaves a choice open that changes the outcome: which kind a move is, what "Hold cards" covers, whether a drawback scales too.

   Gaps you can settle with a sensible default and no gameplay effect (a translation, a CSS detail, an icon): decide them and list them in the report.
3. **Ask** about the rest, in one batch, each with your recommended option first and its consequence spelled out. When the spec says "stop and ask", or "wait for approval", stop there: show what you'll do (tables of old → new values, samples) and change nothing until the user says go. Approval of one plan covers that plan only.
4. **Baseline first.** Before changing anything a spec measures, save the "before" numbers (`npm run simulate -- --out before-<topic>`, plus any table the spec asks for) in `simulation/`.
5. **Build in steps you can check.** For a long rework (many cards, every move set), keep a tracker in the repo, as CARD_REWORK.md does: the decisions, a checklist, and the full table. Tick a step only when its tests pass. Done when every item of the spec is built or explicitly reported as left out.
6. **Report against the spec.** Before vs after for every number the spec targets, met or missed. When a target is missed, name the constant or value to change and by roughly how much, and leave the change to the user.

## Habits that keep specs honest

- When existing behaviour has to change to fit the spec (a rounding, a scaling order, a test's expected value), say so in the report with the reason.
- When the user drops a request ("no go, forget it"), revert nothing already written without asking, write nothing more for it, and say what, if anything, was left behind.
- Keep the user's later edits: when a file changed on disk since you read it (a constant tuned, a test adjusted), build on their version and adapt your work and tests to it.
