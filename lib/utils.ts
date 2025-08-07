import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}


export const DEFAULT_BASE_URLS = [
  'https://api.routstr.com/',
  'https://privateprovider.xyz/',
  'https://ai.redsh1ft.com/',
  'https://routstr.otrta.me/'
];
export const DEFAULT_BASE_URL = DEFAULT_BASE_URLS[0]; // For backward compatibility
export const DEFAULT_MINT_URL = 'https://mint.minibits.cash/Bitcoin';
