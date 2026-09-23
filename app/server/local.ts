import { createApp } from "./index";
const app = await createApp();
app.listen(Number(process.env.PORT || 5001), "127.0.0.1", () => console.log("Boats and Notes production server ready"));
