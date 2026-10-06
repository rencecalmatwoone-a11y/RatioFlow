# Batch Image Mode — implementation and validation

Validated on October 6, 2026 against a local production build in Chrome. RatioFlow retains one visible editor and performs image preparation, editing, encoding, and ZIP creation locally.

## Store and state ownership

The previous single source image and flat editor fields were replaced with `batchImages: BatchImageItem[]` and `activeImageId`. Each item owns its File, object URL, filename, dimensions, byte size, and `ImageEditorState`. `selectActiveImage` / `selectActiveEditor` derive the active source and settings. There is no duplicate active-image object to synchronize.

Per-image state includes crop, normalized focal point, zoom, Fit/Fill, saved Fill crop/zoom, selected editor ratio, custom ratio, platform preset, safe-zone visibility, and manual frame sizing. Existing controls read and update the active item. The viewport remounts when its source changes so media measurements and pending interactions cannot leak between photos. Custom-ratio input drafts also reset to the selected photo's values.

Global export preferences include format, quality, selected target ratios, shared custom/platform target configuration, and output size. A platform output-size preset has its own stored ID, independent of the selected platform ratio target. Single-photo ratio/export synchronization remains intact. In a batch, editing another photo's ratio or resetting that photo preserves the chosen export targets and preferences.

New photos inherit ratio/preset preferences and start centered, at zoom 1, in Fill mode. Apply ratio to all copies ratio/preset configuration while preserving each photo's crop, focal point, zoom, and view-mode history. Free retains each source's own aspect ratio.

## Verified behavior

| Area | Result and evidence |
| --- | --- |
| Single image | Existing workflow passed; filmstrip, image counter, and Download Batch remain hidden for one photo. Add images can promote it to a batch. |
| Multi-upload and append | Five photos loaded in selection order; the first became active. Appending retained edits and gave new photos fresh spatial settings. JPEG, PNG, and WebP were accepted; PDF, oversized, empty, and corrupt files were skipped individually with inspectable reasons. |
| Independent editing | Repeated switching restored distinct crop transforms, focal framing, zoom, Fit/Fill, custom ratios, presets, and safe-zone state. Store tests also verified saved Fill framing and exact independent state. |
| Apply ratio to all | Store tests verified crop/focal/zoom values were not copied. Browser checks verified platform propagation and retained individual zoom settings. |
| Removal and clear | Removing a non-active photo retained the active source. Removing the active photo selected an adjacent source. Clear requires an inline confirmation, supports cancellation, and returns to UploadArea. |
| Source URL ownership | Tests verified targeted revocation on remove/replace and complete revocation on clear. Browser instrumentation found zero remaining source URLs after clear. Cancelled metadata preparation releases its pending URLs. Unmount releases source URLs and cancels preparation. |
| Duplicates and limits | Exact name/size/last-modified duplicates were skipped. Distinct same-name files remained valid. A 30-photo selection added the first 25 valid images and reported five omissions. The 250 MB aggregate limit was covered by a logic test. Limits are centralized: 25 images, 20 MB per file, 250 MB total source bytes. |
| Existing downloads | Download Image / Current, Selected, and All continued exporting only the active source with a batch loaded. Single-photo ZIPs retain their flat structure. |
| Batch downloads | Five images at three target ratios produced 15 files in five folders. Twenty-five images at one target produced 25 outputs. Filename sanitization, same-name sources, case-only collisions, and suffix collisions were tested. |
| Framing in exported files | Batch square PNGs matched each photo's direct PNG export byte-for-byte. Pixel checks confirmed distinct left/right focal framing. Logic tests verified the original-image crop geometry and independent zoom; the existing export engine remains shared. |
| Ratios and sizing | Standard multi-ratio, shared custom 2:1, Free/native-source ratios, and Instagram Story targets passed. Decoded custom/platform outputs had the expected aspect ratios and obeyed output-size/source limits. Custom sizing retains the existing multi-ratio longest-side rule for each photo's editor ratio. |
| Formats and guides | PNG, JPEG, and WebP exports passed. Custom sizes, platform presets, manual frame resizing, and editor-only safe-zone guides remained functional. Safe zones never enter export Canvas or thumbnails. |
| Progress and source guards | Browser tests observed increasing output counts and Creating ZIP. Source add/replace/remove/clear controls were disabled during export. Exports use a copied snapshot and do not select other thumbnails or change the active source. |
| Export failures | A simulated encoding failure displayed the source filename, retained images/edits, unlocked controls, and allowed a successful retry. No partial ZIP downloads silently omit a failed photo. |
| Resource cleanup | Preparation and export are sequential. Instrumentation observed at most one application-owned ImageBitmap at a time, all closed afterward, and all processing canvases reset to 0 × 0. Generated output Blobs stay local to export/ZIP functions and are never stored in Zustand. ZIP uses STORE compression. Existing download-URL delayed revocation remains covered by a logic test. |
| Large sources | Three 12–24 megapixel phone-shaped sources passed preparation, switching, a six-output batch ZIP, and cleanup checks. The existing single-image smoke also exported a 6000 × 4000 source across all ratios. |
| Responsive navigation | 320, 375, 430, 768, 1024, 1440, and 1920 px checks found one viewport and no page overflow. Mobile emulation verified thumbnail taps and native rail swipe. Next/Previous kept the selected thumbnail visible; reduced motion used immediate rail scrolling. |
| Keyboard and accessibility | Thumbnail selection uses scoped Left/Right keys, accessible Edit/Remove labels, and active-state semantics. Slider arrows remained local. Selection/import/export updates use polite status announcements. Clear confirmation supports Escape and focus return. |
| Privacy and scope | All processing remains browser-only; browser checks observed no upload requests. Production routes remain static. No API routes, backend, authentication, database, cloud storage, server image processing, reordering, multi-selection, AI cropping, or unrelated features were added. |

## Checks

- `npm.cmd run build`: passed, including the production TypeScript build.
- `npm.cmd run typecheck`: passed.
- `node --test tests/*.test.mjs`: 31 passed, zero failed.
- `tests/batchMode.browser.mjs`: passed against the production build.
- `tests/browserSmoke.mjs`: passed.
- `tests/exportRatioSync.browser.mjs`: passed.
- `tests/resizeHandles.browser.mjs`: passed.
- `git diff --check`: passed.
- Lint: no lint command or linter configuration exists in this project.

Browser scripts accept the application URL and Chrome/Edge CDP URL. The ratio-sync script now waits for React hydration before submitting files to avoid racing the prerendered upload input.

## File manifest

Created:

- `BATCH_MODE_VALIDATION.md`
- `src/components/editor/BatchImageNavigator.tsx`
- `src/constants/batchLimits.ts`
- `src/lib/batchImages.ts`
- `src/lib/exportBatchImages.ts`
- `tests/batchMode.browser.mjs`
- `tests/batchMode.test.mjs`
- `tests/browserClient.mjs`

Modified:

- `README.md`
- `src/types/editor.ts`
- `src/store/editorStore.ts`
- `src/hooks/useImage.ts`
- `src/hooks/useImageExport.ts`
- `src/lib/downloadZip.ts`
- `src/lib/exportMultiple.ts`
- `src/lib/fileName.ts`
- `src/components/editor/CustomRatioControl.tsx`
- `src/components/editor/ExportMenu.tsx`
- `src/components/editor/ImageViewport.tsx`
- `src/components/editor/ImageWorkspace.tsx`
- `src/components/editor/OutputSizeControl.tsx`
- `src/components/editor/PlatformPresetSelector.tsx`
- `src/components/editor/RatioSelector.tsx`
- `src/components/editor/UploadArea.tsx`
- `src/components/editor/ZoomControl.tsx`
- `tests/exportRatioSync.browser.mjs`

## Remaining limitations

- Sessions are in memory; refreshing or leaving the editor clears photos and edits.
- Batch caps are 25 photos, 20 MB each, and 250 MB combined. Actual memory also depends on decoded source dimensions and encoded outputs; ZIP output is retained in memory until download preparation finishes.
- There is no export cancellation or partial-success ZIP. A failed photo stops the export and can be removed before retrying.
- Validation used desktop Chrome and emulated touch/mobile sizes. Firefox, Safari, physical phones, and long-duration memory/performance behavior remain unverified.
