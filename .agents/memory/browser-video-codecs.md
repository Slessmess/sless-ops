---
name: Browser video codec compatibility
description: Keep social-download and browser-preview codec requirements separate.
---

A valid MP4 file does not guarantee playback in the preview/testing browser.
Keep a broadly supported browser preview available while preserving the
platform-appropriate social download.

**Why:** A generated H.264 MP4 passed media inspection, but the testing browser
reported `DEMUXER_ERROR_NO_SUPPORTED_STREAMS`. Such Chromium builds may omit
proprietary codecs. Re-encoding or declaring a MIME type alone is not proof of
browser compatibility.

**How to apply:** For restaurant videos, retain H.264 MP4 downloads and serve
VP9 WebM previews with MP4 fallback. Verify playback with advancing
`currentTime`, not only successful HTTP status or a valid file header. Changed
render bytes must also change the preview URL so the browser reloads the media.
