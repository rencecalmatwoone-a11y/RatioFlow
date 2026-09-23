# RatioFlow

RatioFlow is a browser-based image ratio editor. It accepts one JPEG, PNG, or WebP image at a time and can export standard ratios, custom ratios, and platform presets as individual images or a ZIP file. Image decoding, cropping, encoding, and ZIP creation happen in the browser; the app has no image upload endpoint.

## Development

```sh
npm install
npm run dev
```

Run `npm run typecheck`, `node --test tests/*.test.mjs`, and `npm run build` before release. The project does not currently have a lint script.

For a layout smoke test, start the production server and a Chrome or Edge instance with a remote debugging port, then run `node tests/browserSmoke.mjs http://localhost:3000 http://127.0.0.1:9222`.

Export dimensions are capped at 8192 pixels per side and 32 million pixels total. Uploads are limited to 20 MB.
