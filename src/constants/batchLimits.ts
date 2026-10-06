export const MAX_BATCH_IMAGES = 25;
export const MAX_FILE_SIZE = 20 * 1024 * 1024;
export const MAX_BATCH_TOTAL_BYTES = 250 * 1024 * 1024;

export const IMAGE_ACCEPT = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
};

export const IMAGE_INPUT_ACCEPT = Object.entries(IMAGE_ACCEPT)
  .flatMap(([mime, extensions]) => [mime, ...extensions]).join(",");
