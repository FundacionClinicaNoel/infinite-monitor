import { createNoelHandler } from "@/lib/noel/handler";
import { generateProposal } from "@/lib/noel/generate";

export const runtime = "nodejs";
export const maxDuration = 75;
export const POST = createNoelHandler(generateProposal);
