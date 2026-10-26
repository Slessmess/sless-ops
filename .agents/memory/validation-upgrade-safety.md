---
name: Validation upgrade safety
description: Non-obvious schema-library upgrade risks for partial updates and shared TypeScript declarations.
---

Keep defaults for newly created records separate from optional fields in partial
updates. An omitted patch field must stay omitted, especially publication status.

**Why:** Zod 4 applies nested defaults inside optional fields where Zod 3 did not.
That can make an empty WordPress update appear valid or introduce an unrequested
draft status. Security upgrades must not change publication behavior.

**How to apply:** Test both rejection of empty updates and preservation of omitted
fields when upgrading validation libraries. Keep explicit defaults on creation
schemas, not on optional patch fields.

Rebuild shared TypeScript declarations from scratch after changing a dependency's
public types before interpreting new consumer type failures as source defects.

**Why:** Incremental compilation can retain declarations emitted against the old
dependency even when the shared library's source has not changed. With skipped
declaration checks, consumers can silently lose useful inferred types.

**How to apply:** Force a clean declaration build once during a schema-library
upgrade, then use the normal workspace type check.
