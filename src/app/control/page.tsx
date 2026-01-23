"use client";

import { useState, useCallback } from "react";
import { useBroadcastChannel } from "@/hooks/useBroadcastChannel";

const CHANNEL_NAME = "canvastage-sync";

const SAMPLE_CODE = `function setup() {
  // createCanvas is called automatically
  background(20);
}

function draw() {
  // アニメーションする円
  background(20, 20, 30, 25);

  fill(255, 100, 150);
  noStroke();

  let x = width / 2 + sin(frameCount * 0.02) * 200;
  let y = height / 2 + cos(frameCount * 0.03) * 150;
  let size = 50 + sin(frameCount * 0.05) * 30;

  ellipse(x, y, size, size);

  // マウス追従
  fill(100, 200, 255, 150);
  ellipse(mouseX, mouseY, 30, 30);
}`;

export default function ControlPage() {
  const [code, setCode] = useState(SAMPLE_CODE);
  const { postMessage } = useBroadcastChannel<string>(CHANNEL_NAME);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setCode(e.target.value);
    },
    []
  );

  const handleRun = useCallback(() => {
    postMessage(code);
  }, [code, postMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Cmd/Ctrl + Enter で実行
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        handleRun();
      }
    },
    [handleRun]
  );

  return (
    <main className="min-h-screen bg-zinc-900 p-8">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-white">Control</h1>
        <button
          onClick={handleRun}
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 transition-colors font-medium"
        >
          Run (⌘↵)
        </button>
      </div>
      <textarea
        value={code}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        spellCheck={false}
        className="w-full h-[calc(100vh-200px)] bg-zinc-800 text-white font-mono text-sm p-4 rounded-lg border border-zinc-700 focus:border-zinc-500 focus:outline-none resize-none"
      />
      <p className="text-zinc-500 mt-4 text-sm">
        Open <code className="text-zinc-400">/stage</code> in another window, then click Run.
      </p>
    </main>
  );
}
