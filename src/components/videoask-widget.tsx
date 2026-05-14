import { useEffect } from "react";
import { useLocation } from "@tanstack/react-router";

const SCRIPT_ID = "videoask-embed-script";
const CONFIG_ID = "videoask-embed-config";

export function VideoAskWidget() {
  const { pathname } = useLocation();
  const enabled = typeof window !== "undefined" && !pathname.startsWith("/app");

  useEffect(() => {
    if (!enabled) {
      // Remove widget if it was previously injected (e.g. user navigated into /app)
      document.getElementById(SCRIPT_ID)?.remove();
      document.getElementById(CONFIG_ID)?.remove();
      document.querySelectorAll("iframe[src*='videoask.com']").forEach((el) => el.remove());
      // VideoAsk injects a container; remove known wrappers if present
      document.querySelectorAll("[id^='videoask-embed']").forEach((el) => {
        if (el.id !== SCRIPT_ID && el.id !== CONFIG_ID) el.remove();
      });
      delete (window as any).VIDEOASK_EMBED_CONFIG;
      return;
    }

    (window as any).VIDEOASK_EMBED_CONFIG = {
      kind: "widget",
      url: "https://www.videoask.com/fvl7fxyd1",
      options: {
        widgetType: "VideoThumbnailWindowTall",
        text: "",
        backgroundColor: "#0487AF",
        position: "bottom-right",
        dismissible: false,
        videoPosition: "center center",
      },
    };

    if (!document.getElementById(SCRIPT_ID)) {
      const script = document.createElement("script");
      script.id = SCRIPT_ID;
      script.src = "https://www.videoask.com/embed/embed.js";
      script.async = true;
      document.body.appendChild(script);
    }
  }, [enabled]);

  return null;
}
