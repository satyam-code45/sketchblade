import { Tool } from "@/components/Canvas";
import { getExistingShape } from "./route";

type Shape =
  | {
      type: "rect";
      x: number;
      y: number;
      width: number;
      height: number;
    }
  | {
      type: "circle";
      centerX: number;
      centerY: number;
      radius: number;
    }
  | {
      type: "pencil";
      startX: number;
      startY: number;
      endX: number;
      endY: number;
    };

export class Game {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private existingShapes: Shape[];
  private roomId: string;
  private socket: WebSocket;
  private clicked: boolean;
  private startX: number = 0;
  private startY: number = 0;
  private selectedTool: Tool = "circle";

  constructor(canvas: HTMLCanvasElement, roomId: string, socket: WebSocket) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.existingShapes = [];
    this.socket = socket;
    this.roomId = roomId;
    this.clicked = false;
    this.init();
    this.initHandlers();
    this.initMouseHandlers();
  }

  async init() {
    this.existingShapes = await getExistingShape(this.roomId);
    this.clearCanvas();
  }

  setTool(tool: Tool) {
    console.log(tool);

    this.selectedTool = tool;
  }

  destory() {
    this.canvas.removeEventListener("mousedown", this.mouseDownHandler);

    this.canvas.removeEventListener("mouseup", this.mouseUpHandler);

    this.canvas.removeEventListener("mousemove", this.mouseMoveHandler);
  }

  initHandlers() {
    this.socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === "chat") {
        const parsedShape = JSON.parse(message.message);
        this.existingShapes.push(parsedShape.shape);
        this.clearCanvas();
      }
    };
  }

  clearCanvas() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.fillStyle = "rgba(0,0,0)";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.strokeStyle = "rgba(255,255,255)";

    this.existingShapes.map((shape) => {
      if (shape.type === "rect") {
        this.ctx.strokeRect(shape.x, shape.y, shape.width, shape.height);
      } else if (shape.type === "circle") {
        this.ctx.beginPath();
        this.ctx.arc(
          shape.centerX,
          shape.centerY,
          shape.radius,
          0,
          Math.PI * 2
        );
        this.ctx.stroke();
        this.ctx.closePath();
      }
    });
  }

  mouseDownHandler = (e: MouseEvent) => {
    this.clicked = true;
    this.startX = e.clientX;
    this.startY = e.clientY;
  }

  mouseUpHandler = (e: MouseEvent) => {
    this.clicked = false;
    const width = Math.abs(e.clientX - this.startX);
    const height = Math.abs(e.clientY - this.startY);
    const selectedTool = this.selectedTool;
    let shape: Shape | null = null;
    if (selectedTool === "rect") {
      shape = {
        type: "rect",
        height: height,
        width: width,
        x: this.startX,
        y: this.startY,
      };
    } else if (selectedTool === "circle") {
      shape = {
        type: "circle",
        centerX: this.startX + width / 2,
        centerY: this.startY + height / 2,
        radius: Math.max(width, height) / 2,
      };
    } else if (selectedTool === "pencil") {
      shape = {
        type: "pencil",
        endX: e.clientX,
        endY: e.clientY,
        startX: this.startX,
        startY: this.startY,
      };
    }

    if (!shape) {
      return;
    }
    this.existingShapes.push(shape);

    const chatRoomId = Number(this.roomId);
    this.socket.send(
      JSON.stringify({
        type: "chat",
        roomId: chatRoomId,
        message: JSON.stringify({
          shape,
        }),
      })
    );
  }

  mouseMoveHandler = (e: MouseEvent) => {
    if (this.clicked) {
      const width = Math.abs(e.clientX - this.startX);
      const height = Math.abs(e.clientY - this.startY);

      this.clearCanvas();
      this.ctx.strokeStyle = "rgba(255,255,255)";

      const selectedTool = this.selectedTool;
      console.log("Selected Tool", selectedTool);

      if (selectedTool === "rect") {
        this.ctx.strokeRect(this.startX, this.startY, width, height);
      } else if (selectedTool === "circle") {
        const centerX = this.startX + width / 2;
        const centerY = this.startY + height / 2;
        const radius = Math.max(width, height) / 2;
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        this.ctx.stroke();
        this.ctx.closePath();
      }
    }
  }
  initMouseHandlers() {
    this.canvas.addEventListener("mousedown", this.mouseDownHandler);

    this.canvas.addEventListener("mouseup", this.mouseUpHandler);

    this.canvas.addEventListener("mousemove", this.mouseMoveHandler);
  }
}
