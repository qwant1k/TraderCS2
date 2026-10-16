import { SignJWT, errors, jwtVerify } from "jose";

const PURPOSE = "email-verification";
const MAX_AGE = "30m";

function signingKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET должен быть не короче 32 символов");
  return new TextEncoder().encode(secret);
}

export async function createEmailVerificationToken(userId: string, email: string) {
  return new SignJWT({ uid: userId, email, purpose: PURPOSE })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(MAX_AGE)
    .sign(signingKey());
}

export async function readEmailVerificationToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, signingKey());
    if (payload.purpose !== PURPOSE || typeof payload.uid !== "string" || typeof payload.email !== "string") return null;
    return { userId: payload.uid, email: payload.email };
  } catch (error) {
    if (error instanceof errors.JWTExpired) return "expired" as const;
    return null;
  }
}

