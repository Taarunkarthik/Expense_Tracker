import cors from "cors";
import express from "express";
import { authRouter } from "./routes/auth.js";
import { budgetsRouter } from "./routes/budgets.js";
import { categoriesRouter } from "./routes/categories.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { expensesRouter } from "./routes/expenses.js";
import { recurringRouter } from "./routes/recurring.js";

export const app = express();

app.use(cors({
  origin: ["http://localhost:5173"],
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/auth", authRouter);
app.use("/categories", categoriesRouter);
app.use("/expenses", expensesRouter);
app.use("/budgets", budgetsRouter);
app.use("/recurring", recurringRouter);
app.use("/dashboard", dashboardRouter);
