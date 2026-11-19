type NativeShare = (pack: string) => Promise<void>;
let nativeShare: NativeShare | undefined;

export function registerNativeShare(handler?: NativeShare) {
  nativeShare = handler;
}

export async function copyAiPack(pack: string) {
  await navigator.clipboard.writeText(pack);
}

export async function shareAiPack(pack: string) {
  if (nativeShare) {
    try {
      await nativeShare(pack);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError")
        return { method: "cancelled", offerDownload: false };
      throw error;
    }
    return { method: "native", offerDownload: false };
  }
  if (navigator.share) {
    const data: ShareData = { title: "Ellie's Book · Ask AI", text: pack };
    const file = new File([pack], "ellies-book-ai.md", { type: "text/markdown" });
    if (navigator.canShare?.({ files: [file] })) data.files = [file];
    try {
      await navigator.share(data);
      return { method: "share", offerDownload: false };
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError")
        return { method: "cancelled", offerDownload: false };
    }
  }
  try {
    await copyAiPack(pack);
    return { method: "clipboard", offerDownload: true };
  } catch {
    return { method: "download", offerDownload: true };
  }
}
