import { atenderPeticionAuth, auth } from "@/lib/auth";
import { db } from "@/lib/db";

export function GET(request: Request) {
  return atenderPeticionAuth(auth(), db(), request);
}

export function POST(request: Request) {
  return atenderPeticionAuth(auth(), db(), request);
}
