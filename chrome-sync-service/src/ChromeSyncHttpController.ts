import express, { Express, Request, Response } from "express";
import cors from "cors";
import { ChromeSyncServiceHandler } from "./ChromeSyncServiceHandler";
import { ChromeSyncData } from "./globals";
import { log } from "./Util/Logger";

export class ChromeSyncHttpController {
  private exp: Express;
  private readonly port: number;
  private handler: ChromeSyncServiceHandler;

  constructor() {
    this.handler = new ChromeSyncServiceHandler();
    this.exp = express();
    this.port = 3030;
    this.run();
  }

  private isAuthorized(req: Request): boolean {
    return req.headers &&
    req.headers['api-key'] !== undefined &&
    req.headers['api-key'] === process.env.API_KEY;
  }

  private run(): void {
    this.exp.use(cors());
    this.exp.use(express.json());
    this.exp.use(express.urlencoded({ extended: true }));

    this.exp.listen(this.port, () => {
      log.INFO(`ChromeSyncService is runnning on ${this.port}`);
    });

    this.exp.post("/", async (req: Request, res: Response) => {
      log.INFO(`received request ${req.method}, ${req.originalUrl}`, req.body);
      if (this.isAuthorized(req)) {
        if (req.body) {
          const data = req.body as ChromeSyncData;
          try {
            await this.handler.save(data);
            res.status(200).send("OK");
          } catch (error) {
            log.ERROR(null, error);
            res.status(500).send(error);
          }
        } else {
          log.ERROR("invalid request body", req);
          res.status(400).send();
        }
      } else {
        log.WARN("got unauthorized request", req.headers)
        res.status(403).send("Unauthorized")
      }
    });

    this.exp.get("/", async (req: Request, res: Response) => {
      log.INFO(`received request ${req.method}, ${req.originalUrl}`)
      if (this.isAuthorized(req)) {
        try {
          const data = await this.handler.read()
          res.send(data).status(200)
        } catch (error) {
          log.ERROR(null, error)
          res.status(500).send(error);
        }
      } else {
        log.WARN("got unauthorized request", req.headers)
        res.status(403).send("Unauthorized")
      }
    });
  }
}
