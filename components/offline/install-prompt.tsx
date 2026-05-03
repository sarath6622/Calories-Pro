"use client";

/**
 * Phase 8 / F-PWA-3 — capture `beforeinstallprompt` on supported browsers
 * (Chrome / Edge / Opera on Android & desktop) and surface an "Install"
 * button. Dismissed once → suppressed for the rest of the session via
 * sessionStorage so we don't pester the user.
 *
 * Safari and Firefox don't fire `beforeinstallprompt`, so the component
 * renders nothing there — installation goes through the browser's own UI
 * (Add to Home Screen / Share menu) and we don't pretend otherwise.
 */
import { useEffect, useState } from "react";
import Snackbar from "@mui/material/Snackbar";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

const DISMISS_KEY = "caloriespro-install-dismissed";

export function InstallPrompt() {
  const [evt, setEvt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (typeof sessionStorage !== "undefined" && sessionStorage.getItem(DISMISS_KEY) === "1") {
      return;
    }

    function onBeforeInstall(e: Event) {
      // Prevent Chrome's mini-infobar — we'll show our own UI instead.
      e.preventDefault();
      setEvt(e as BeforeInstallPromptEvent);
    }

    function onInstalled() {
      setEvt(null);
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!evt) return null;

  function handleInstall() {
    if (!evt) return;
    void evt.prompt();
    void evt.userChoice.then(() => {
      // Whether the user accepted or dismissed, the same prompt event can't
      // be reused — Chrome will fire a fresh `beforeinstallprompt` later if
      // it's still applicable.
      setEvt(null);
    });
  }

  function handleDismiss() {
    if (typeof sessionStorage !== "undefined") sessionStorage.setItem(DISMISS_KEY, "1");
    setEvt(null);
  }

  return (
    <Snackbar
      open
      anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      message="Install CaloriesPro for offline use"
      data-testid="install-prompt"
      action={
        <>
          <Button color="primary" size="small" variant="contained" onClick={handleInstall}>
            Install
          </Button>
          <IconButton
            size="small"
            color="inherit"
            aria-label="Dismiss install prompt"
            onClick={handleDismiss}
            sx={{ ml: 1 }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </>
      }
    />
  );
}
