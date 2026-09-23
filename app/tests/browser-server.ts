// Local QA only. Not imported by api/index.ts or the production entry.
import { createApp } from "../server/index";
if (process.env.VERCEL || new URL(process.env.DATABASE_URL || "").hostname !== "127.0.0.1" ||
  new URL(process.env.DATABASE_URL || "").pathname !== "/boats_notes_qa") throw Error("Local disposable QA only");
const app = await createApp((req, res, next) => {
  if (req.get("Authorization") !== "Bearer disposable-test-token")
    return res.status(401).json({ error: "QA authentication required" });
  res.locals.owner = "77228746-e36f-4d72-84fd-d9c74aa532dc"; next();
});
app.listen(5002, "127.0.0.1", () => console.log("Disposable browser QA ready"));
