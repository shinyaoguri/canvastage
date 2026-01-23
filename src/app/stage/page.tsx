"use client";

import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { useBroadcastChannel } from "@/hooks/useBroadcastChannel";

const P5Runner = dynamic(() => import("@/components/P5Runner").then((m) => m.P5Runner), {
  ssr: false,
});

const CHANNEL_NAME = "canvastage-sync";

export default function StagePage() {
  const [code, setCode] = useState("");

  const handleMessage = useCallback((data: string) => {
    setCode(data);
  }, []);

  useBroadcastChannel<string>(CHANNEL_NAME, handleMessage);

  return (
    <main className="w-screen h-screen bg-black overflow-hidden">
      {code ? (
        <P5Runner code={code} />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <p className="text-zinc-600 font-mono">Waiting for code...</p>
        </div>
      )}
    </main>
  );
}
