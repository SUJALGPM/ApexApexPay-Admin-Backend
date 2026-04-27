import { Router } from "express";
import { sendOk } from "../utils/http.js";

export const healthRouter = Router();

healthRouter.get("/", (req, res) => {
  sendOk(res, { status: "ok" });
});

