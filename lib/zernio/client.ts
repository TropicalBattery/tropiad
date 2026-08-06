// Server-only: do not import this module into client components.

import Zernio from "@zernio/node";

export function getZernioClient(): Zernio {
  if (!process.env.ZERNIO_API_KEY) {
    throw new Error("Missing ZERNIO_API_KEY.");
  }

  return new Zernio();
}
