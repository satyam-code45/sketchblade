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
    .min(1, { message: "Room name is required." })
    .max(50, { message: "Room name cannot exceed 50 characters." }),
  password: z.string().optional(),
});
