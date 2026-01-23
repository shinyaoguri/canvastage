"use client";

import { useEffect, useRef, useCallback } from "react";

type MessageHandler<T> = (data: T) => void;

export function useBroadcastChannel<T = unknown>(
  channelName: string,
  onMessage?: MessageHandler<T>
) {
  const channelRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    const channel = new BroadcastChannel(channelName);
    channelRef.current = channel;

    if (onMessage) {
      channel.onmessage = (event: MessageEvent<T>) => {
        onMessage(event.data);
      };
    }

    return () => {
      channel.close();
      channelRef.current = null;
    };
  }, [channelName, onMessage]);

  const postMessage = useCallback((data: T) => {
    channelRef.current?.postMessage(data);
  }, []);

  return { postMessage };
}
