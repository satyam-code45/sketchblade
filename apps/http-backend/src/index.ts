import express from "express";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "@repo/backend-common/config";
import { middleware } from "./middleware";
import {
  CreateRoomSchema,
  CreateUserSchema,
  SignInSchema,
} from "@repo/common/types";
import { prismaClient } from "@repo/db/client";
import bcrypt from "bcrypt";

const app = express();
app.use(express.json());

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

    if (user) {
      return res.status(200).json({
        userid: user.id,
      });
    }
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
      token: token,
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
      message: "Incorrect Inputs",
    });
  }
  //@ts-ignore : TODO: Fix this??
  const userId = req.userId;

  try {
    const room = await prismaClient.room.create({
      data: {
        slug: parsedData.data.name,
        adminId: userId,
      },
    });

    res.status(200).json({
      roomId: room.id,
    });
  } catch (error) {
    console.log(error);
    res.status(411).json({
      message: "Room already exists!",
    });
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

app.listen(3001);
