import type { NextConfig } from "next";

/**
 * MinIO / web.makeblock.com 静态部署：网关路径为 /site/<app-name>/…
 * 仅在使用 MINIO_BASE_PATH 构建时启用 `output: "export"`，本地 `next dev` 不受影响。
 *
 * 构建与上传：
 *   npm run build:minio
 *   mc cp --recursive out/ minio/site/pindou/
 *
 * 勿同时设置会与 basePath 叠加的绝对 assetPrefix（易导致对象 Key 重复拼接）。
 */
const minioBasePath = process.env.MINIO_BASE_PATH?.trim() ?? "";

const nextConfig: NextConfig = {
  ...(minioBasePath
    ? {
        output: "export" as const,
        basePath: minioBasePath,
        images: { unoptimized: true },
      }
    : {}),
};

export default nextConfig;
