import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  // Note: serverActions.bodySizeLimit only applies to Server Actions, not API routes
  // For API routes, we handle large files by uploading directly to S3
  // If you need larger uploads, consider using presigned URLs for direct S3 uploads
};

export default nextConfig;
