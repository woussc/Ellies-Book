import type { CapacitorConfig } from '@capacitor/cli';
import { KeyboardResize } from '@capacitor/keyboard';

const config: CapacitorConfig = {
  appId: 'com.woussc.elliesbook',
  appName: "Ellie's Book",
  webDir: 'dist-ios',
  backgroundColor: '#f6f3ec',
  ios: { backgroundColor: '#f6f3ec', preferredContentMode: 'mobile' },
  plugins: {
    Keyboard: { resize: KeyboardResize.Native },
    StatusBar: { style: 'LIGHT', backgroundColor: '#f6f3ec' },
  },
};

export default config;
