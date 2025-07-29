import express from "express";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "@repo/backend-common/config";
import { middleware } from "./middleware";
import {
  CreateRoomSchema,
  CreateUserSchema,
  SignInSchema,
} from "@repo/common/types";

const app = express();

app.get("/", (req, res) => {
  console.log("welcome");
  res.send("Welcome");
});

app.post("/sign-up", (req, res) => {
  //db call
  const data = CreateUserSchema.safeParse(req.body);
  if (!data.success) {
    return res.json({
      message: "Incorrect Inputs",
    });
  }
  console.log("signed up");

  res.json({
    userId: 123,
  });
});

app.post("/sign-in", (req, res) => {
  const data = SignInSchema.safeParse(req.body);
  if (!data.success) {
    return res.json({
      message: "Incorrect Inputs",
    });
  }

  const userId = 1;
  const token = jwt.sign(
    {
      userId,
    },
    JWT_SECRET
  );
  console.log("signed in");
  res.json({ token });
});

app.post("/create-room", middleware, (req, res) => {
  //db call

  const data = CreateRoomSchema.safeParse(req.body);
  if (!data.success) {
    return res.json({
      message: "Incorrect Inputs",
    });
  }

  res.send("RoomId: 12345");
});

app.listen(3001);
