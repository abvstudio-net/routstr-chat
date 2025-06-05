import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}


export const DEFAULT_BASE_URL = 'https://api.routstr.com/';
export const DEFAULT_MINT_URL = 'https://mint.minibits.cash/Bitcoin';