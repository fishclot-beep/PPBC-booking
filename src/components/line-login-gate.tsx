"use client";

import { ReactNode, useEffect, useState } from "react";

declare global {
  interface Window { liff?: { init: (config: { liffId: string; withLoginOnExternalBrowser?: boolean }) => Promise<void>; isLoggedIn: () => boolean; login: (options?: { redirectUri?: string }) => void; getIDToken: () => string | null }; }
}

export function LineLoginGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("正在連線至 LINE…");

  useEffect(() => {
    // A LIFF ID is public by design. The fallback keeps this production app functional
    // if Vercel has not yet rebuilt after its public environment variable was added.
    const liffId = process.env.NEXT_PUBLIC_LINE_LIFF_ID || "2010876193-eoCnYlYX";
    if (!liffId) { setMessage("LINE LIFF 尚未設定。請在 .env.local 填入 NEXT_PUBLIC_LINE_LIFF_ID。 "); setState("error"); return; }
    const script = document.createElement("script"); script.src = "https://static.line-scdn.net/liff/edge/2/sdk.js"; script.async = true;
    script.onload = async () => {
      try {
        const liff = window.liff; if (!liff) throw new Error("LIFF SDK 載入失敗。");
        await liff.init({ liffId, withLoginOnExternalBrowser: true });
        if (!liff.isLoggedIn()) {
          sessionStorage.setItem("sports-booking-return-path", `${window.location.pathname}${window.location.search}`);
          liff.login({ redirectUri: window.location.href }); return;
        }
        const idToken = liff.getIDToken(); if (!idToken) throw new Error("未取得 LINE ID Token。請確認 LIFF 已啟用 openid scope。");
        const response = await fetch("/api/auth/line", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken }) });
        if (!response.ok) { const payload = await response.json(); throw new Error(payload.error ?? "LINE 登入失敗。"); }
        const returnPath = sessionStorage.getItem("sports-booking-return-path");
        if (returnPath && returnPath !== `${window.location.pathname}${window.location.search}`) {
          sessionStorage.removeItem("sports-booking-return-path");
          window.location.replace(returnPath); return;
        }
        sessionStorage.removeItem("sports-booking-return-path");
        setState("ready");
      } catch (error) { setMessage(error instanceof Error ? error.message : "LINE 登入失敗。"); setState("error"); }
    };
    script.onerror = () => { setMessage("無法載入 LINE LIFF SDK。"); setState("error"); };
    document.head.appendChild(script); return () => script.remove();
  }, []);

  if (state === "ready") return <>{children}</>;
  return <main className="line-login-state"><section><p>LINE LOGIN</p><h1>{state === "loading" ? "正在登入" : "尚未完成 LINE 設定"}</h1><span>{message}</span></section></main>;
}
