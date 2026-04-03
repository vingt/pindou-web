/**
 * 触发浏览器下载。移动端 / 微信内置浏览器常忽略 `<a download>`：
 * 先尝试 Web Share API，微信内再回退为新窗口打开 Blob URL 预览（可长按保存）。
 */
export async function downloadBlob(blob: Blob, filename: string): Promise<void> {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isMobileUa = /iPhone|iPad|iPod|Android/i.test(ua);
  const inWeChat = /MicroMessenger/i.test(ua);

  const tryShare = async (): Promise<boolean> => {
    if (
      typeof navigator === "undefined" ||
      typeof navigator.share !== "function" ||
      typeof navigator.canShare !== "function"
    ) {
      return false;
    }
    try {
      const mime = blob.type || "application/octet-stream";
      const file = new File([blob], filename, { type: mime });
      const data: ShareData = { files: [file], title: filename };
      if (!navigator.canShare(data)) return false;
      await navigator.share(data);
      return true;
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return true;
      return false;
    }
  };

  if (isMobileUa || inWeChat) {
    const shared = await tryShare();
    if (shared) return;
  }

  const url = URL.createObjectURL(blob);

  if (inWeChat) {
    window.open(url, "_blank", "noopener,noreferrer");
    window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
    return;
  }

  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch {
    /* ignore */
  }

  window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
}
