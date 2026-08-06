import { Router, type IRouter } from "express";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import {
  getCachedJsonFileClone,
  JSON_FILE_KEYS,
  setCachedJsonFile,
} from "../lib/ttlCache.js";

const router: IRouter = Router();

export interface PlanConfig {
  key: string;
  label: string;
  price: number;
  billedAs: string;
  badge?: string;
  badgeColor?: string;
}

const DEFAULT_PLANS: PlanConfig[] = [
  {
    key: "monthly",
    label: "Monthly",
    price: 10,
    billedAs: "Billed every month",
  },
  {
    key: "quarterly",
    label: "Quarterly",
    price: 30,
    billedAs: "Billed every 3 months",
    badge: "Popular",
    badgeColor: "#FF6B35",
  },
  {
    key: "halfYearly",
    label: "Half Yearly",
    price: 50,
    billedAs: "Billed every 6 months",
    badge: "Best Value",
    badgeColor: "#10B981",
  },
  {
    key: "yearly",
    label: "Yearly",
    price: 100,
    billedAs: "Billed once a year",
  },
];

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_FILE = resolve(__dirname, "../data/plans.json");

function readPlans(): PlanConfig[] {
  const cached = getCachedJsonFileClone<PlanConfig[]>(JSON_FILE_KEYS.PLANS);
  if (cached !== undefined) return cached;
  try {
    if (existsSync(DATA_FILE)) {
      const raw = readFileSync(DATA_FILE, "utf-8");
      const plans = JSON.parse(raw) as PlanConfig[];
      setCachedJsonFile(JSON_FILE_KEYS.PLANS, plans);
      return JSON.parse(JSON.stringify(plans)) as PlanConfig[];
    }
  } catch {
    // fall through
  }
  return DEFAULT_PLANS;
}

function writePlans(plans: PlanConfig[]): void {
  writeFileSync(DATA_FILE, JSON.stringify(plans, null, 2), "utf-8");
  setCachedJsonFile(JSON_FILE_KEYS.PLANS, plans);
}

// GET /api/plans — public
router.get("/plans", (_req, res) => {
  const plans = readPlans();
  res.json({ plans });
});

// PUT /api/admin/plans — protected
router.put("/admin/plans", (req, res) => {
  const adminKey = process.env["ADMIN_KEY"] ?? "skillad-admin";
  const provided = req.headers["x-admin-key"];

  if (provided !== adminKey) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { plans } = req.body as { plans?: PlanConfig[] };
  if (!Array.isArray(plans) || plans.length === 0) {
    res.status(400).json({ error: "plans array required" });
    return;
  }

  for (const p of plans) {
    if (typeof p.key !== "string" || typeof p.price !== "number" || p.price < 0) {
      res.status(400).json({ error: "Invalid plan data" });
      return;
    }
  }

  writePlans(plans);
  res.json({ success: true, plans });
});

export default router;
