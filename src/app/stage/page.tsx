"use client";

import { useState, useCallback } from "react";
import { useBroadcastChannel } from "@/hooks/useBroadcastChannel";

const CHANNEL_NAME = "canvastage-sync";

export default function StagePage() {
  const [text, setText] = useState("");

  const handleMessage = useCallback((data: string) => {
    setText(data);
  }, []);

  useBroadcastChannel<string>(CHANNEL_NAME, handleMessage);

  return (
    <main className="min-h-screen bg-black flex items-center justify-center p-8">
      <pre className="text-white font-mono text-2xl whitespace-pre-wrap break-words max-w-full">
        {text || <span className="text-zinc-600">Waiting for input...</span>}
      </pre>
    </main>
  );
}
