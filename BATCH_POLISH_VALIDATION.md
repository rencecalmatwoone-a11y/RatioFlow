# Batch Mode polish and stabilization

Validated on 2026-10-06 against the local production build in headless Chrome 154 on Windows. Batch Mode remains a compact queue around the existing editor. All processing stays in the browser.

## UX and behavior

- The rail uses 64px thumbnails with separate 44px removal targets, a subtle active border, an immediate “3 of 12” counter, bounded Previous/Next controls, edited count, and capacity near the 25-photo limit.
- Only the rail scrolls to reveal the active thumbnail. Reduced motion uses immediate scrolling; horizontal wheel/touch and vertical page scrolling retain native behavior. Removal keeps keyboard focus in the queue.
- Each photo starts with `isEdited: false`. Intentional changes to focal point, zoom, Fit/Fill, ratio, manual frame, or platform preset mark that photo edited when values change. Selecting a photo, layout crop recalculation, unchanged zoom values, export settings, and safe-zone visibility do not mark it edited. The dot is a session flag, not an undo history or comparison against original settings. Reset Image restores only the active photo and clears its flag, preserving other photos and shared download settings. The existing single-photo Reset behavior remains.
- Import feedback combines counts by category and offers filename details in a disclosure. Duplicate-only feedback uses a neutral tone. Appending images preserves the active photo and all existing edits. Thumbnail failure shows a neutral placeholder without disabling removal.
- The active preview reserves its frame during decoding and displays a loading surface; decoding failure shows recovery guidance. The queue uses local previews capped at 128px, generated from the same sequential metadata bitmap. It never points thumbnail images at full originals. No full-batch or adjacent full-resolution preloading was added.
- Apply Ratio names the active ratio/preset and photo count, keeps each photo’s focal point/zoom/crop state, and announces completion. Free retains each source’s original aspect ratio.
- Batch download shows images × ratios = files, format, quality, size, and a nonblocking notice at 100+ files. Current, Selected, and All Ratios remain active-photo actions. The single-photo All label stays unchanged.
- Typed export phases are `idle`, `preparing`, `exporting`, `zipping`, `success`, and `error`. Visible progress reports completed files, total, source filename, and ratio. A linear progress bar exposes the completed count; polite announcements follow phases and 10% completion steps. Success reports “N files downloaded.”
- Failure identifies the source photo, retains edits, and exposes Retry batch. Inspecting Options retains this feedback. Retry restarts the entire export from a fresh snapshot of the current session. Export snapshots remain immutable while editing continues; source mutations and download settings are disabled until completion.
- Unicode names are retained, source-name prefixes are bounded to 100 UTF-8 bytes, suffixes are bounded, and case-insensitive folder/file collisions receive numeric suffixes. ZIP organization remains one folder per source.

## Every file created or modified in this phase

19 files: 16 modified and 3 created. Build-generated `next-env.d.ts` changes were restored and are excluded.

| File | Change |
| --- | --- |
| [README.md](README.md) | Updated queue, tracking, export, and validation documentation. |
| [src/components/editor/BatchImageNavigator.tsx](src/components/editor/BatchImageNavigator.tsx) | Compact rail, edited indicators/counter, capacity, failure placeholder, focus retention, resize-aware auto-scroll, explicit Apply label and result. |
| [src/components/editor/ExportMenu.tsx](src/components/editor/ExportMenu.tsx) | Batch summary, progress bar, accessible announcements, Retry, disabled reasons, settings lock and active-only All Ratios label. |
| [src/components/editor/ImageViewport.tsx](src/components/editor/ImageViewport.tsx) | Stable decoding/error surface and preview readiness. |
| [src/components/editor/ImageWorkspace.tsx](src/components/editor/ImageWorkspace.tsx) | Active-only Reset Image and neutral duplicate details. |
| [src/hooks/useImage.ts](src/hooks/useImage.ts) | Consolidated import feedback and source/preview URL cleanup. |
| [src/hooks/useImageExport.ts](src/hooks/useImageExport.ts) | Typed phases, completed progress, throttled announcements, success/error feedback and complete retry. |
| [src/lib/batchImages.ts](src/lib/batchImages.ts) | Import categories/summary, initial edited state, sequential 128px previews, shared URL cleanup. |
| [src/lib/exportBatchImages.ts](src/lib/exportBatchImages.ts) | Filename/ratio progress, recovery messages and explicit JSZip entry cleanup. |
| [src/lib/exportImage.ts](src/lib/exportImage.ts) | HTML image fallback now clears source and handlers as well as its temporary URL on success/failure. |
| [src/lib/fileName.ts](src/lib/fileName.ts) | Bounded Unicode-safe filenames and reserved-name handling. |
| [src/store/editorStore.ts](src/store/editorStore.ts) | Intentional edited tracking, no-op update suppression, active-only reset, ratio-only apply and paired URL cleanup. |
| [src/types/editor.ts](src/types/editor.ts) | Edited flag, small preview URL and reset action types. |
| [tests/batchMode.browser.mjs](tests/batchMode.browser.mjs) | Updated assertions for the polished labels, import summary and progress. |
| [tests/batchMode.test.mjs](tests/batchMode.test.mjs) | Tracking/reset, import summary, Unicode limits, small-preview lifecycle and updated progress/recovery assertions. |
| [tests/exportImage.test.mjs](tests/exportImage.test.mjs) | HTML fallback cleanup after success, decoding failure and encoding failure. |
| [tests/batchPolish.browser.mjs](tests/batchPolish.browser.mjs) — created | Detailed polish workflow, 30-output fidelity, live-edit snapshots, Retry, Unicode, 40→25 import and large repeated-batch resource/timing checks. |
| [tests/batchProfile.browser.mjs](tests/batchProfile.browser.mjs) — created | Production React thumbnail commit profiling during a 30-move crop drag with 25 photos. |
| [BATCH_POLISH_VALIDATION.md](BATCH_POLISH_VALIDATION.md) — created | This complete manifest, validation evidence, checklist and limitations. |

## Validation

Commands run successfully:

```powershell
npm.cmd run typecheck
npm.cmd run build
node --experimental-strip-types --test tests/*.test.mjs
git diff --check
```

All 37 Node tests pass. The repository has no configured lint command.

Six browser suites pass against the production server. Each command accepts the application and Chrome CDP URLs:

```powershell
node tests/batchProfile.browser.mjs http://localhost:3137 http://127.0.0.1:9228
node tests/batchPolish.browser.mjs http://localhost:3137 http://127.0.0.1:9228
node tests/batchMode.browser.mjs http://localhost:3137 http://127.0.0.1:9228
node tests/browserSmoke.mjs http://localhost:3137 http://127.0.0.1:9228
node tests/exportRatioSync.browser.mjs http://localhost:3137 http://127.0.0.1:9228
node tests/resizeHandles.browser.mjs http://localhost:3137 http://127.0.0.1:9228
```

The 10-photo × 3-ratio browser scenario checks all 30 ZIP entries and their dimensions, including ten byte-for-byte comparisons against those photos’ direct PNG exports. A zoom edit made during the batch export is retained in the live editor while the ZIP retains the original snapshot. Progress exposes every completed count from 0 through 30 and uses at most 14 phase/completion announcements in that scenario. Injected encoding failure retains framing and Retry produces the complete 30-file ZIP.

Other browser checks cover 8 edited + 4 appended photos; active-only reset; duplicate/mixed-invalid feedback; failed thumbnail removal; no-op navigation; first/last boundaries; rapid selection/removal; 40 selected → first 25 imported in order; long Unicode collisions; PNG/JPEG/WebP; shared custom and Story targets; safe-zone persistence; scoped keyboard navigation; native wheel/touch; and no page overflow at 320, 375, 430, 768, 1024, 1440 and 1920px. Single-image regression suites cover Fit/Fill, direct/current/selected/all exports, replacement, custom size/ratio, platform selection and resize handles. Instagram Story and YouTube have browser coverage; X Header additionally has unit geometry coverage in both Fit and Fill.

## Profiling and resource evidence

With 25 photos loaded, production React profiling observed **zero inactive-thumbnail renders** during 30 pointer-move crop updates. Before this phase it observed zero thumbnail renders; with the new edited dot it observes one active-thumbnail render when the flag first changes, then none for subsequent drag updates. This supports retaining the existing memoization and narrow selectors. No whole-batch thumbnail regeneration runs during crop/zoom changes.

The recorded small-preview run used synthetic JPEG fixtures with 4032×3024, 6000×4000 and 4000×6000 dimensions (12–24 MP), repeated with unique metadata. These are local-machine measurements, not estimates for a phone or a guarantee for complex camera files. Timing includes CDP polling, with about 100ms granularity. The 25-photo run uses six ratios, PNG and a 1080px longest side; other resource-cycle exports use one ratio and 64px output to isolate repeated decoding/lifecycle work.

| Photos | Outputs / size | Import | Export | Largest import frame gap | Largest export frame gap | ZIP | JS heap after clear + GC |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 5 | 5 / 64px | 331ms | 452ms | 17ms | 17ms | <0.1 MB | 4.4 MB |
| 15 | 15 / 64px | 1087ms | 1219ms | 17ms | 17ms | 0.1 MB | 4.4 MB |
| 25 | 150 / 1080px | 1759ms | 17176ms | 33ms | 50ms | 40.8 MB | 4.5 MB |
| 10, subsequent cycle | 10 / 64px | 657ms | 879ms | 17ms | 17ms | 0.1 MB | 4.5 MB |

Preparation yielded animation frames throughout (20/65/105/40 respectively). The 150-output export yielded 987 frames. Later clear/import/export cycles showed no material heap growth or increasing per-photo cost in this sample.

Resource instrumentation confirms:

- At most one explicitly decoded ImageBitmap is live during preparation/export; every bitmap closes.
- Metadata and preview share that bitmap. All temporary preview/export canvases reset to 0×0.
- The rail references generated preview Blobs capped at 128px, never source Files. The active viewport is the only mounted original-image preview; no adjacent-source preload cache exists.
- Removing one photo revokes only its original/thumbnail URLs; replacing revokes both old URLs; clear and unmount release all session preview URLs. Cancelled import also releases both pending URLs.
- Each clear leaves zero source/thumbnail URLs. Download URLs retain the existing 60-second handoff grace period; the stress harness explicitly executes those timer callbacks, then confirms zero outstanding URLs of any type. It does not claim these URLs expire immediately after download in production.
- Individual encoded outputs live in local JSZip entries only. Entries are removed in `finally` after ZIP generation or failure. Blobs, canvases and bitmaps are never stored in Zustand. The final ZIP remains referenced by the browser download URL during its grace period.
- HTML decoding fallback removes its `src`, load/error handlers and temporary URL on success and failure; Node tests cover decoding and encoding failures.
- Source/network audit found no upload endpoint or source-data request. Observed browser requests stayed on the local app origin or `blob:`/`data:` URLs, with no POST/PUT/PATCH requests and no console errors.

JS heap and tracked resources do not measure all native image/codec/GPU allocations or browser caches. Their eventual reclamation remains browser-managed; this is a bounded lifecycle audit, not a claim that every native allocation was measured.

## Requested completion checklist

| # | Confirmation | Evidence |
| --- | --- | --- |
| 1 | Every created/modified file shown | 19-file manifest above. |
| 2 | Batch UX summarized | Compact queue, edited progress, grouped import feedback, explicit export/recovery. |
| 3 | Edited tracking explained | Intentional changed values only; session flag cleared by active reset. |
| 4 | Image counter remains correct | Add/remove/rapid selection and first/last boundary browser assertions. |
| 5 | Active thumbnail auto-scroll works | Rail bounds, unchanged page scroll and reduced-motion browser assertions. |
| 6 | Add preserves edits | 8 edited + 4 appended; active ID and framing unchanged. |
| 7 | Invalid feedback consolidated | Mixed import browser and category summary unit tests. |
| 8 | Duplicate feedback works | Explicit duplicate count and neutral details. |
| 9 | Reset affects active image only | Browser count/zoom and store identity/shared-settings tests. |
| 10 | Apply Ratio preserves framing | Focal/crop/zoom unit tests, distinct zooms in 10-photo browser workflow. |
| 11 | Correct total output count | 10×3=30 and 25×6=150 ZIP/summary checks. |
| 12 | Batch progress correct | Monotonic exact completed values, filename/ratio and phase assertions. |
| 13 | Failure keeps edits | Injected encoding failure preserves editor and batch. |
| 14 | Retry works | Full 30-file retry; failure remains available after inspecting Options. |
| 15 | Duplicate filenames safe | Case/suffix/sanitization unit tests and same-base/long-Unicode ZIP checks. |
| 16 | Folder organization correct | One distinct source folder; every expected ratio entry retained. |
| 17 | Remove cleans affected resources | Paired source/thumbnail revocation tests. |
| 18 | Clear cleans batch | Empty UploadArea, zero session URLs, zero live bitmaps, reset canvases. |
| 19 | Repeated batches do not leak URLs | Repeated 5/15/25/10 cycles and driven download cleanup. |
| 20 | Import responsive | 5/15/25 preparation timing and animation frame sampling. |
| 21 | Large exports safely bounded | Sequential outputs and one explicitly live bitmap; 150-file ZIP. |
| 22 | Single-image workflow preserved | Existing single-image browser suites and original Reset/All labels. |
| 23 | Download Current active only | Existing batch and single-image browser assertions. |
| 24 | Download Selected active only | Exact active-photo ratio ZIP checks. |
| 25 | Download All Ratios active only | Existing batch browser ZIP count; single All behavior retained. |
| 26 | Download Batch whole batch | Every expected source folder and output in 30/150-file runs. |
| 27 | Custom ratios work | Shared 2:1 ZIP dimensions and independent editor/browser checks. |
| 28 | Platform presets work | Story/YouTube browser checks; X Header and catalog unit geometry checks. |
| 29 | Safe zones work | Per-photo guide persistence and existing overlay behavior; export engine consumes no guide. |
| 30 | PNG works | Direct pixel/byte fidelity and batch ZIP checks. |
| 31 | JPEG works | MIME, extension, ZIP dimensions and Fit padding tests. |
| 32 | WebP works | MIME, extension, ZIP dimensions and Fit padding tests. |
| 33 | Mobile navigation works | 320px tap/swipe, rail scrolling and minimum targets. |
| 34 | Tablet layout works | 768/1024px browser overflow/layout checks. |
| 35 | Desktop layout works | 1440/1920px browser checks and screenshots. |
| 36 | Keyboard navigation works | Scoped arrows, focus retention and existing crop/resize/zoom keys. |
| 37 | Accessible labels present | Selection/current/edited and separate removal labels; list semantics. |
| 38 | No remote image upload | Source audit plus observed local-only network requests. |
| 39 | No backend/auth/cloud added | Client orchestration retained; source/diff audit. |
| 40 | TypeScript passes | `npm.cmd run typecheck` and production build type checks. |
| 41 | Lint if configured | Not applicable: no configured lint command. |
| 42 | Production build succeeds | `npm.cmd run build`. |
| 43 | Remaining limitations listed | See below. |
| 44 | No further major feature | This phase ends here pending the user’s approval of polish. |

## Remaining limitations

- Sessions and flags are memory-only. Refresh/navigation ends the session; no undo or saved project was added.
- Limits remain 25 images, 20 MB per source, 250 MB total. Encoded ZIP contents still accumulate in memory until generation completes; maximum-size originals can require substantially more native memory than the measured 1080px fixture run.
- Import commits the queue after sequential preparation. No early edit while staging or adjacent full-resolution preloader was added. A failed small preview uses a placeholder while the readable original remains usable.
- Retry restarts the whole batch; there is no partial ZIP download, resume, cancellation or worker-based export. The recorded largest workload completed in about 17 seconds. Slower devices or maximum-size exports can take longer.
- Validation used headless Chrome with emulated responsive viewports and touch input. Physical phones/tablets, Safari, Firefox and assistive-technology speech output were not tested. Accessible DOM state and announcement throttling were checked programmatically.
- Native codec/GPU/cache memory and the physical disk download were not directly measured. Tests capture generated Blobs/ZIPs and inspect their contents; the app hands them to the browser using its existing download flow.
