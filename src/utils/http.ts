import type { Response } from "express";

export function sendOk(res: Response, data: unknown): void {
  res.status(200).json({ ok: true, data });
}

export function sendError(
  res: Response,
  status: number,
  code: string,
  message: string
): void {
  res.status(status).json({ ok: false, error: { code, message } });
}
