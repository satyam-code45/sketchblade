"use client";
import { initDraw } from "@/draw/init";
import { useEffect, useRef } from "react";

export default function CanvasPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (canvasRef.current) {
      initDraw(canvasRef.current,"7");
    }
  }, [canvasRef]);
  return (
    <div>
      <canvas ref={canvasRef} width={1080} height={1080}></canvas>
    </div>
  );
}
