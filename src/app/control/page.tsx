"use client";

import { useState, useCallback } from "react";
import { useBroadcastChannel } from "@/hooks/useBroadcastChannel";

const CHANNEL_NAME = "canvastage-sync";

export default function ControlPage() {
  const [text, setText] = useState("");
  const { postMessage } = useBroadcastChannel<string>(CHANNEL_NAME);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      setText(value);
      postMessage(value);
    },
    [postMessage]
  );

  return (
    <main className="min-h-screen bg-zinc-900 p-8">
      <h1 className="text-2xl font-bold text-white mb-4">Control</h1>
      <textarea
        value={text}
        onChange={handleChange}
        placeholder="Type here..."
        className="w-full h-96 bg-zinc-800 text-white font-mono p-4 rounded-lg border border-zinc-700 focus:border-zinc-500 focus:outline-none resize-none"
      />
      <p className="text-zinc-500 mt-4 text-sm">
        Open <code className="text-zinc-400">/stage</code> in another window to see the output.
      </p>
    </main>
  );
}
