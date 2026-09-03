import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Standard shadcn class merger (clsx + tailwind-merge). Future shadcn components
// import this from "@/lib/utils".
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
