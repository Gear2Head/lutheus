// SECTION: EXTENSION_TYPES
// PURPOSE: Minimal Chrome extension global used by dashboard-v2 when compiled through the root Next.js tsconfig.

declare const chrome: {
  runtime: {
    lastError?: { message?: string };
    getURL: (path: string) => string;
    sendMessage: (message: unknown, callback?: (response: any) => void) => void;
    onMessage: {
      addListener: (callback: (message: any, sender: any, sendResponse: (response?: any) => void) => boolean | void) => void;
      removeListener: (callback: (message: any, sender: any, sendResponse: (response?: any) => void) => boolean | void) => void;
    };
  };
  storage: {
    local: {
      get: (keys: unknown, callback: (result: any) => void) => void;
      set: (items: Record<string, unknown>, callback?: () => void) => void;
      remove: (keys: unknown, callback?: () => void) => void;
    };
  };
};
