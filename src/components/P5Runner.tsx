"use client";

import { useEffect, useRef } from "react";
import p5 from "p5";

interface P5RunnerProps {
  code: string;
  width?: number;
  height?: number;
}

export function P5Runner({ code, width, height }: P5RunnerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const p5InstanceRef = useRef<p5 | null>(null);

  useEffect(() => {
    if (!containerRef.current || !code.trim()) return;

    // 既存のインスタンスをクリーンアップ
    if (p5InstanceRef.current) {
      p5InstanceRef.current.remove();
      p5InstanceRef.current = null;
    }

    const sketch = (p: p5) => {
      try {
        // ユーザーコードを実行して setup/draw を取得
        // with(p) でラップすることで p. プレフィックスなしで書ける
        const fn = new Function(
          "p",
          `
          with (p) {
            ${code}
            return {
              setup: typeof setup === 'function' ? setup : undefined,
              draw: typeof draw === 'function' ? draw : undefined,
              mousePressed: typeof mousePressed === 'function' ? mousePressed : undefined,
              mouseMoved: typeof mouseMoved === 'function' ? mouseMoved : undefined,
              keyPressed: typeof keyPressed === 'function' ? keyPressed : undefined,
            };
          }
        `
        );

        const userFunctions = fn(p);

        p.setup = () => {
          // デフォルトのキャンバスサイズ
          const w = width ?? window.innerWidth;
          const h = height ?? window.innerHeight;
          p.createCanvas(w, h);

          // ユーザーの setup があれば実行
          if (userFunctions.setup) {
            userFunctions.setup();
          }
        };

        if (userFunctions.draw) {
          p.draw = userFunctions.draw;
        }

        if (userFunctions.mousePressed) {
          p.mousePressed = userFunctions.mousePressed;
        }

        if (userFunctions.mouseMoved) {
          p.mouseMoved = userFunctions.mouseMoved;
        }

        if (userFunctions.keyPressed) {
          p.keyPressed = userFunctions.keyPressed;
        }
      } catch (err) {
        console.error("p5.js execution error:", err);
        p.setup = () => {
          p.createCanvas(400, 200);
          p.background(30);
          p.fill(255, 100, 100);
          p.textSize(14);
          p.text(`Error: ${err}`, 10, 30);
        };
      }
    };

    p5InstanceRef.current = new p5(sketch, containerRef.current);

    return () => {
      if (p5InstanceRef.current) {
        p5InstanceRef.current.remove();
        p5InstanceRef.current = null;
      }
    };
  }, [code, width, height]);

  return <div ref={containerRef} className="w-full h-full" />;
}
