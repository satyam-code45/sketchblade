import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET ?? "secret123";

export function getUserId(req: Request): string | null {
  const token = req.headers.get("authorization") ?? "";
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
    return decoded.userId ?? null;
  } catch {
    return null;
  }
}

export function signToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: "30d" });
}

export function signResetToken(email: string): string {
  return jwt.sign({ email, purpose: "reset" }, JWT_SECRET, { expiresIn: "1h" });
}

export function verifyResetToken(token: string): string | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
    if (decoded.purpose !== "reset") return null;
    return decoded.email ?? null;
  } catch {
    return null;
  }
}
