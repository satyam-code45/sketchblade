import { z } from "zod";

export const CreateUserSchema = z.object({
  email: z.email(),
  password: z
    .string()
    .min(8, { message: "Password must be at least 8 characters!" }),
  name: z
    .string()
    .min(1, { message: "Name is required!" })
    .max(100, { message: "Name is too long!" }),
});

export const SignInSchema = z.object({
  email: z.email(),
  password: z
    .string()
    .min(8, { message: "Password must be at least 8 characters!" }),
});

export const CreateRoomSchema = z.object({
  name: z
    .string()
    .min(3, { message: "Room name must be at least 3 characters long." })
    .max(10, { message: "Room name cannot exceed 10 characters." }),
});
