import { useEffect, useRef, useState } from "react";
import IconButton from "./IconButton";
import { Pencil } from "lucide-react";
import { RectangleHorizontal } from "lucide-react";
import { Circle } from "lucide-react";
import { Game } from "@/draw";

export type Tool = "circle" | "rect" | "pencil";

export default function Canvas({
  roomId,
  socket,
}: {
  roomId: string;
  socket: WebSocket;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedTool, setSelectedTool] = useState<Tool>("circle");
  const [game, setGame] = useState<Game>();

  useEffect(() => {
    game?.setTool(selectedTool);
    console.log("Use Effect selected tool renender");
  }, [selectedTool, game]);

  useEffect(() => {
    if (canvasRef.current) {
      console.log("Game instance is created");

      const g = new Game(canvasRef.current, roomId, socket);
      setGame(g);
      return () => {
        g.destory();
      };
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
  selectedTool: Tool;
  setSelectedTool: (s: Tool) => void;
}) {
  return (
    <div className="fixed top-10 left-10">
      <div className="flex gap-3">
        <IconButton
          icon={<Pencil />}
          onClick={() => {
            setSelectedTool("pencil");
          }}
          activated={selectedTool === "pencil"}
        />
        <IconButton
          icon={<RectangleHorizontal />}
          onClick={() => {
            setSelectedTool("rect");
          }}
          activated={selectedTool === "rect"}
        />
        <IconButton
          icon={<Circle />}
          onClick={() => {
            setSelectedTool("circle");
          }}
          activated={selectedTool === "circle"}
        />
      </div>
    </div>
  );
}
