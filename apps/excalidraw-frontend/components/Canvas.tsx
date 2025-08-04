"use client";

import { initDraw } from "@/draw/init";
import { useEffect, useRef } from "react";

export function Canvas({roomId} : {roomId: string}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (canvasRef.current) {
      initDraw(canvasRef.current, roomId);
    }
  }, [canvasRef,roomId]);
  return (
    <div>
      <canvas ref={canvasRef} width={1080} height={1080}></canvas>
    </div>
  );
}
