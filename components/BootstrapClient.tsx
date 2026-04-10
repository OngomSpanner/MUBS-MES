"use client";

import { useEffect } from "react";

/**
 * Client component that imports Bootstrap JS at runtime.
 * This replaces the CDN <Script> tag so Bootstrap works fully offline.
 */
export default function BootstrapClient() {
  useEffect(() => {
    import("bootstrap/dist/js/bootstrap.bundle.min.js" as any);
  }, []);

  return null;
}
