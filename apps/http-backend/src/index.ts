import express from "express";
import jwt from "jsonwebtoken";
import { randomUUID } from "crypto";
import { JWT_SECRET } from "@repo/backend-common/config";
import { middleware } from "./middleware";
import {
  CreateRoomSchema,
  CreateUserSchema,
  SignInSchema,
} from "@repo/common/types";
import { prismaClient } from "@repo/db/client";
import bcrypt from "bcrypt";
import cors from "cors";

const app = express();
app.use(express.json());
app.use(cors());

// token -> { email, expiresAt } — cleared after use or expiry
const resetTokens = new Map<string, { email: string; expiresAt: number }>();

app.post("/sign-up", async (req, res) => {
  const data = CreateUserSchema.safeParse(req.body);
  if (!data.success) {
    return res.json({
      message: "Incorrect Inputs",
    });
  }
  try {
    const existingUser = await prismaClient.user.findUnique({
      where: {
        email: req.body.email,
      },
    });

    if (!!existingUser) {
      return res.status(409).json({
        message: "User already exists!",
      });
    }

    const hashedPassword = await bcrypt.hash(req.body.password, 5);

    const user = await prismaClient.user.create({
      data: {
        name: req.body.name,
        email: req.body.email,
        password: hashedPassword,
        photo: req.body.photo,
      },
    });

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "30d" });
    return res.status(200).json({
      token,
      name: user.name,
      userId: user.id,
    });
  } catch (error) {
    console.log(error);
    return res.status(400).json({
      message: "Something went wrong! Please try again.",
    });
  }
});

app.post("/sign-in", async (req, res) => {
  const data = SignInSchema.safeParse(req.body);
  if (!data.success) {
    return res.json({
      message: "Incorrect Inputs",
    });
  }

  try {
    const user = await prismaClient.user.findUnique({
      where: {
        email: req.body.email,
      },
    });

    if (!user) {
      return res.status(404).json({
        message: "User does not exists!",
      });
    }

    const validUser = await bcrypt.compare(req.body.password, user.password);

    if (!validUser) {
      return res.status(404).json({
        message: "Incorrect email or password!",
      });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, {
      expiresIn: "30d",
    });

    return res.status(200).json({
      message: "Signed In successfully!",
      token,
      name: user.name,
      userId: user.id,
    });
  } catch (error) {
    console.log(error);
    return res.status(400).json({
      message: "Something went wrong! Please try again.",
    });
  }
});

app.post("/create-room", middleware, async (req, res) => {
  const parsedData = CreateRoomSchema.safeParse(req.body);
  if (!parsedData.success) {
    return res.json({
      message: parsedData.error.issues[0]?.message ?? "Incorrect Inputs",
    });
  }
  //@ts-ignore
  const userId = req.userId;

  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let slug: string;
  do {
    slug = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  } while (await prismaClient.room.findUnique({ where: { slug } }));

  try {
    const room = await prismaClient.room.create({
      data: {
        slug,
        name: parsedData.data.name,
        adminId: userId,
        password: parsedData.data.password ?? null,
      },
    });

    res.status(200).json({
      roomId: room.id,
      slug: room.slug,
      password: room.password,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Failed to create room." });
  }
});

app.get("/chats/:roomId", async (req, res) => {
  const roomId = Number(req.params.roomId);
  const messages = await prismaClient.chat.findMany({
    where: {
      roomId: roomId,
    },
    orderBy: {
      id: "desc",
    },
    take: 50,
  });

  res.json({
    messages,
  });
});

app.get("/room/:slug", async (req, res) => {
  const slug = req.params.slug;
  const room = await prismaClient.room.findFirst({ where: { slug } });
  if (!room) {
    return res.json({ room: null });
  }
  res.json({
    room: {
      id: room.id,
      slug: room.slug,
      name: room.name,
      hasPassword: !!room.password,
    },
  });
});

app.post("/room/:slug/join", async (req, res) => {
  const slug = req.params.slug;
  const { password } = req.body;

  const room = await prismaClient.room.findFirst({ where: { slug } });
  if (!room) {
    return res.status(404).json({ message: "Room not found." });
  }

  if (room.password) {
    if (!password) {
      return res.status(401).json({ message: "This room is password protected." });
    }
    if (password !== room.password) {
      return res.status(401).json({ message: "Incorrect room password." });
    }
  }

  return res.status(200).json({ roomId: room.id });
});

app.get("/my-rooms", middleware, async (req, res) => {
  // @ts-ignore
  const userId = req.userId;
  const rooms = await prismaClient.room.findMany({
    where: { adminId: userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      slug: true,
      name: true,
      adminId: true,
      password: true,
      createdAt: true,
      updateAt: true,
    },
  });
  return res.json({ rooms });
});

app.post("/forgot-password", async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }

  const user = await prismaClient.user.findUnique({ where: { email } });

  // Don't reveal whether the email exists
  if (!user) {
    return res.status(200).json({
      message: "If this email is registered, a reset token has been generated.",
    });
  }

  const token = randomUUID();
  resetTokens.set(token, { email, expiresAt: Date.now() + 60 * 60 * 1000 }); // 1 hour

  return res.status(200).json({
    message: "Reset token generated.",
    resetToken: token,
  });
});

app.post("/reset-password", async (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return res.status(400).json({ message: "Token and new password are required" });
  }

  const entry = resetTokens.get(token);
  if (!entry) {
    return res.status(400).json({ message: "Invalid or expired reset token" });
  }
  if (entry.expiresAt < Date.now()) {
    resetTokens.delete(token);
    return res.status(400).json({ message: "Reset token has expired. Please request a new one." });
  }

  const hashedPassword = await bcrypt.hash(newPassword, 5);
  await prismaClient.user.update({
    where: { email: entry.email },
    data: { password: hashedPassword },
  });

  resetTokens.delete(token);
  return res.status(200).json({ message: "Password reset successfully" });
});

app.post("/change-password", middleware, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  // @ts-ignore
  const userId = req.userId;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: "Current and new password are required" });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ message: "New password must be at least 6 characters" });
  }

  const user = await prismaClient.user.findUnique({ where: { id: userId } });
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  const valid = await bcrypt.compare(currentPassword, user.password);
  if (!valid) {
    return res.status(400).json({ message: "Current password is incorrect" });
  }

  const hashedPassword = await bcrypt.hash(newPassword, 5);
  await prismaClient.user.update({
    where: { id: userId },
    data: { password: hashedPassword },
  });

  return res.status(200).json({ message: "Password changed successfully" });
});

const PORT = Number(process.env.PORT) || 4000;
app.listen(PORT, () => console.log(`HTTP backend listening on port ${PORT}`));
