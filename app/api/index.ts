import { createApp } from "../server/index.js";
const app = createApp();
export default async function handler(req: any, res: any) {
  return (await app)(req, res);
}
