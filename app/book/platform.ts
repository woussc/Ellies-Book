import { Capacitor, registerPlugin } from "@capacitor/core";
import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import { Keyboard } from "@capacitor/keyboard";
import { Share } from "@capacitor/share";
import type { registerNativeShare } from "./ai-share";

const NativePrint = registerPlugin<{ print(): Promise<void> }>("NativePrint");

function shareCancelled(error: unknown) {
  return error instanceof Error && /share cancel(?:ed|led)/i.test(error.message);
}

export async function shareReport(title: string, text: string) {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    await Share.share({ title, text });
  } catch (error) {
    if (shareCancelled(error)) throw new DOMException("Sharing cancelled", "AbortError");
    throw error;
  }
  return true;
}

export async function saveFile(content: string, name: string, type: string) {
  if (Capacitor.isNativePlatform()) {
    const folder = crypto.randomUUID();
    try {
      const file = await Filesystem.writeFile({
        path: `${folder}/${name}`, data: content, directory: Directory.Cache,
        encoding: Encoding.UTF8, recursive: true,
      });
      await Share.share({ title: name, files: [file.uri] });
    } catch (error) {
      if (shareCancelled(error)) throw new DOMException("Sharing cancelled", "AbortError");
      throw error;
    } finally {
      await Filesystem.rmdir({ path: folder, directory: Directory.Cache, recursive: true }).catch(() => {});
    }
    return;
  }
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function printReport() {
  if (Capacitor.isNativePlatform()) await NativePrint.print();
  else window.print();
}

export function watchNativeKeyboard(registerShare: typeof registerNativeShare) {
  if (!Capacitor.isNativePlatform()) return () => {};
  registerShare(async (pack) => {
    try {
      await Share.share({ text: pack });
    } catch (error) {
      if (shareCancelled(error)) throw new DOMException("Sharing cancelled", "AbortError");
      throw error;
    }
  });
  document.documentElement.classList.add("native-app");
  void Keyboard.setAccessoryBarVisible({ isVisible: true }).catch(() => {});
  let keyboardVisible = false;
  let frame = 0;
  const scrollField = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const field = document.activeElement;
      if (field instanceof HTMLElement) {
        field.scrollIntoView({ block: "center", behavior: "smooth" });
      }
    });
  };
  const focus = () => { if (keyboardVisible) scrollField(); };
  const layout = new ResizeObserver(focus);
  layout.observe(document.body);
  document.addEventListener("focusin", focus);
  window.addEventListener("resize", focus);
  const listeners = [
    Keyboard.addListener("keyboardDidShow", () => {
      keyboardVisible = true;
      document.documentElement.classList.add("native-keyboard-open");
      scrollField();
    }),
    Keyboard.addListener("keyboardDidHide", () => {
      keyboardVisible = false;
      document.documentElement.classList.remove("native-keyboard-open");
    }),
  ];
  return () => {
    registerShare();
    cancelAnimationFrame(frame);
    layout.disconnect();
    document.removeEventListener("focusin", focus);
    window.removeEventListener("resize", focus);
    document.documentElement.classList.remove("native-keyboard-open");
    for (const listener of listeners) void listener.then((handle) => handle.remove());
  };
}
