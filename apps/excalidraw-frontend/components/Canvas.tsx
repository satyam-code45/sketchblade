import { initDraw } from "@/draw/init";
import { useEffect, useRef, useState } from "react";
import IconButton from "./IconButton";
import { Pencil } from "lucide-react";
import { RectangleHorizontal } from "lucide-react";
import { Circle } from "lucide-react";

export const enum CurrentShape {
  Rect = "rect",
  Circle = "circle",
  Pencil = "pencil",
}

export default function Canvas({
  roomId,
  socket,
}: {
  roomId: string;
  socket: WebSocket;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedTool, setSelectedTool] = useState<CurrentShape>(
    CurrentShape.Pencil
  );

  useEffect(() => {
    if (canvasRef.current) {
      initDraw(canvasRef.current, roomId, socket);
    }
  }, [canvasRef, roomId, socket]);

  return (
    <div className="h-[100vh] overflow-hidden">
      <canvas
        ref={canvasRef}
        width={window.innerWidth}
        height={window.innerHeight}
      ></canvas>
      <Topbar selectedTool={selectedTool} setSelectedTool={setSelectedTool} />
    </div>
  );
}

function Topbar({
  selectedTool,
  setSelectedTool,
}: {
  selectedTool: CurrentShape;
  setSelectedTool: (s: CurrentShape) => void;
}) {
  return (
    <div className="fixed top-10 left-10">
      <div className="flex gap-3">
        <IconButton
          icon={<Pencil />}
          onClick={() => {
            setSelectedTool(CurrentShape.Pencil);
          }}
          activated={selectedTool === "pencil"}
        />
        <IconButton
          icon={<RectangleHorizontal />}
          onClick={() => {
            setSelectedTool(CurrentShape.Rect);
          }}
          activated={selectedTool === "rect"}
        />
        <IconButton
          icon={<Circle />}
          onClick={() => {
            setSelectedTool(CurrentShape.Circle);
          }}
          activated={selectedTool === "circle"}
        />
      </div>
    </div>
  );
}
