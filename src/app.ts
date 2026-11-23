import express, { type Express } from "express";
import cors from "cors";
import authRouter from "./routes/auth.routes";
import usersRouter from "./routes/users.routes";
import artworksRouter from "./routes/artworks.routes";
import recommendationsRouter from "./routes/recommendations.routes";
import sponsorshipsRouter from "./routes/sponsorships.routes";
import notFound from "./middleware/notFound.middleware";
import errorHandler from "./middleware/error.middleware";

export function allowedOrigins(): string[] {
  return (process.env.CLIENT_URL ?? "http://localhost:5173,http://127.0.0.1:5173")
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value && value !== "*");
}

export default function createApp(): Express {
  const app = express();
  // Render는 프록시 뒤에서 동작하므로 실제 접속 IP를 쓰려면 프록시 1단계를 신뢰한다.
  app.set("trust proxy", 1);
  app.use(
    cors({
      origin: allowedOrigins(),
      allowedHeaders: ["Content-Type", "Authorization"],
      credentials: false,
    }),
  );
  app.use(express.json({ limit: "100kb" }));
  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });
  app.use("/api/auth", authRouter);
  app.use("/api/users", usersRouter);
  app.use("/api/artworks", artworksRouter);
  app.use("/api/recommendations", recommendationsRouter);
  app.use("/api/sponsorships", sponsorshipsRouter);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
