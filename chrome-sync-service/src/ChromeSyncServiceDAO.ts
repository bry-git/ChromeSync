import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";
import { ChromeSyncData } from "./globals";
import fs from "fs";
import { log } from "./Util/Logger";

export class ChromeSyncServiceDAO {
  private db: Low;
  private readonly dbFile: string

  constructor() {
    this.dbFile = "db.json";
    const adapter = new JSONFile(this.dbFile);
    const dbData = this.openOrCreateDb();
    this.db = new Low(adapter, dbData);
  }

  async openOrCreateDb(): Promise<ChromeSyncData> {
    if (!fs.existsSync(this.dbFile)) {
      fs.open(this.dbFile, "w", (err) => {
        if (err) {
          log.ERROR("error creating DB", err);
          throw Error(err.message);
        }
      });
      return {
        timestamp: -1,
        groups: new Map(),
        orphanTabs: [],
        bookmarkTree: []
      } as ChromeSyncData
    } else {
      const data =  await new Promise((resolve, reject) => {
        fs.readFile(this.dbFile, (err, data) => {
          try {
            resolve(JSON.parse(data.toString()))
          } catch (error) {
            log.ERROR('a db.json file was found but the data was not parseable')
            reject(error)
          }

        })
      })
      return data as ChromeSyncData
    }
  };

  async save(chromeSyncData: ChromeSyncData): Promise<ChromeSyncData> {
    // @ts-ignore Low.data: unknown
    this.db.data = chromeSyncData
    await this.db.write();
    return chromeSyncData;
  }

  async read(): Promise<ChromeSyncData> {
    await this.db.read()
    return <ChromeSyncData>this.db.data
  }
}
