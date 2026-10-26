---
name: Facebook publication verification
description: Separate native Facebook scheduling receipts from public visibility and asynchronous video processing.
---

Facebook API post creation and native scheduling receipts do not establish public visibility when the Meta app is unpublished or in Development mode.

**Why:** Meta's App Modes documentation says posts created in Development mode are visible only to app-role users until the app switches to Live. The owner's app setup showed Unpublished; public visibility must not be assumed from API success.

**How to apply:** Record publication and scheduling separately from app-mode and anonymous-view verification. Ask the owner to complete the app's Publish requirements; do not recreate existing posts to make them public.

Video creation can succeed before the corresponding scheduled Page post appears.

**Why:** An accepted campaign video had a saved media ID but initially no scheduled-post listing. A subsequent read confirmed processing complete and the exact approved future time.

**How to apply:** Poll saved media status and the scheduled-post listing. Reconcile by approved caption and exact time before any retry; never blindly upload a second video.
