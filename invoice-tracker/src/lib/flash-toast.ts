export const FLASH_TOAST_MESSAGES = {
  created: "Invoice created",
  voided: "Invoice voided",
} as const;

export type FlashToastKey = keyof typeof FLASH_TOAST_MESSAGES;

export function isFlashToastKey(value: string): value is FlashToastKey {
  return value in FLASH_TOAST_MESSAGES;
}
