---
name: WordPress snippet activation safety
description: Preserve stored Code Snippets data and account for code execution when activating the plugin.
---

Treat installing and activating Code Snippets as a code-execution change, not as an empty deployment target. An absent plugin entry does not prove that saved snippet records are absent from the WordPress database.

**Why:** During Sless deployment work, activating Code Snippets exposed four saved records even though the plugin was not in the pre-install plugin inventory. Their contents were not inspected or changed.

**How to apply:** Before activating Code Snippets for deployment, verify or back up its stored records through an authorized interface. Do not overwrite or delete saved records without explicit approval. If activation is unintended, deactivate the plugin while preserving its data.
