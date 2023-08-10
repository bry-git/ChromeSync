import { ChromeSyncServiceDAO } from "./ChromeSyncServiceDAO";
import { ChromeSyncData } from "./globals";

export class ChromeSyncServiceHandler {
  private DAO: ChromeSyncServiceDAO;

  constructor() {
    this.DAO = new ChromeSyncServiceDAO();
  }

  // TODO: make this check which data is most current remote or client
  async save(chromeSyncData: ChromeSyncData): Promise<ChromeSyncData> {
    await this.DAO.save(chromeSyncData);
    return chromeSyncData;
  }

  async read(): Promise<ChromeSyncData> {
    return await this.DAO.read()
  }
}
