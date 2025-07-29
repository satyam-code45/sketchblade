import express from "express";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "./congif";
import { middleware } from "./middleware";

const app = express();

app.get("/", (req, res) => {
  console.log("welcome");
  res.send("Welcome");
});

app.post("/sign-up", (req, res) => {
    //db call
  //zod validation
  console.log("signed up");

  res.json({
    userId: 123
  });
});

app.post("/sign-in", (req, res) => {
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
  res.send("RoomId: 12345");
});

app.listen(3001);
