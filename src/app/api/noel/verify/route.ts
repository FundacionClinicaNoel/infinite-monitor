import { createVerificationHandler } from "@/lib/noel/verify";

export const runtime = "nodejs";
export const maxDuration = 10;
export const POST = createVerificationHandler();
