import { createHash } from "crypto";

export function sha256Hash(input: string): Buffer {
  const hash = createHash("sha256");
  hash.update(input);
  return hash.digest();
}

export function base64URLEncode(data: Buffer): string {
  return data
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

export function generateCodeChallenge(codeVerifier: string): string {
  return base64URLEncode(sha256Hash(codeVerifier));
}

export function generateRandomString(length: number): string {
  const charset =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return result;
}

export function generateCodeVerifier(): string {
  return generateRandomString(64);
}

export function generateState(): string {
  return generateRandomString(16);
}
