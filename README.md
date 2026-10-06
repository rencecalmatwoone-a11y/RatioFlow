# RatioFlow

RatioFlow is a browser-based image ratio editor. Open one image or a shoot of JPEG, PNG, and WebP images using the same editor. Each photo retains its own framing, focal point, zoom, Fit/Fill, ratio, and platform preset. Add more images, navigate the thumbnail filmstrip, remove individual photos, or apply the active ratio to all photos without copying their framing.

Download Image / Current, Selected, and All export only the active photo. Download Batch exports every loaded photo at the ratios selected in Options, into one ZIP with a collision-safe folder per source photo. Format, quality, output size, and batch targets are shared; changing a photo's editor ratio in a batch keeps the chosen export targets. A selected custom ratio or platform target applies to every photo; Free uses each source's original ratio.

Files are validated independently, exact name/size/last-modified duplicates are skipped, and preparation and export run sequentially. Limits are centralized in `src/constants/batchLimits.ts`: 25 images, 20 MB per image, and 250 MB total source files. ZIP outputs remain in browser memory until the download is prepared. Batch exports stop with a filename-specific error if any photo fails; retry or remove that photo. Sessions are in memory and are cleared when leaving or refreshing the page.

Image decoding, cropping, encoding, and ZIP creation happen locally in the browser. Images and metadata never leave the device; the app has no image upload endpoint, backend, database, accounts, or cloud storage.

Validation: `npm run typecheck`, `npm run build`, `node --test tests/*.test.mjs`. Browser suites in `tests/*.browser.mjs` and `tests/browserSmoke.mjs` accept a local application URL and a Chrome/Edge CDP URL. No lint command is configured.
