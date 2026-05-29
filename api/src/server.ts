import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { app } from "./app.js";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(currentDir, "../../.env") });

const port = Number(process.env.API_PORT ?? 4000);

app.listen(port, () => {
  console.log(`Expense tracker API running on http://localhost:${port}`);
});
