import { Capacitor, registerPlugin } from "@capacitor/core";
import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import { Keyboard } from "@capacitor/keyboard";
import { Share } from "@capacitor/share";

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
    const path = `${crypto.randomUUID()}-${name}`;
    const file = await Filesystem.writeFile({
      path, data: content, directory: Directory.Cache, encoding: Encoding.UTF8,
    });
    try {
      await Share.share({ title: name, files: [file.uri] });
    } catch (error) {
      if (shareCancelled(error)) throw new DOMException("Sharing cancelled", "AbortError");
      throw error;
    } finally {
      await Filesystem.deleteFile({ path, directory: Directory.Cache }).catch(() => {});
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

export function watchNativeKeyboard() {
  if (!Capacitor.isNativePlatform()) return () => {};
  document.documentElement.classList.add("native-app");
  const listener = Keyboard.addListener("keyboardDidShow", () => {
    const field = document.activeElement;
    if (field instanceof HTMLElement) {
      field.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  });
  return () => { void listener.then((handle) => handle.remove()); };
}
