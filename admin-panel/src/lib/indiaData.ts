export interface StateRow {
  state: string;
  code: string;
  capital: string;
  region: string;
  providers: number;
  buyers: number;
  growth: number;
  topService: string;
  activityScore: number;
  hires: number;
  revenue: number;
}

export interface ServiceDemand {
  service: string;
  demand: number;
  yoy: number;
  trend: "up" | "stable" | "down";
  peak: string;
  topState: string;
  category: string;
}

export const INDIA_STATES: StateRow[] = [
  { state: "Maharashtra", code: "MH", capital: "Mumbai", region: "West", providers: 4821, buyers: 12450, growth: 18, topService: "Electrician", activityScore: 95, hires: 9820, revenue: 482100 },
  { state: "Karnataka", code: "KA", capital: "Bengaluru", region: "South", providers: 3942, buyers: 10230, growth: 22, topService: "Software Dev", activityScore: 91, hires: 8420, revenue: 394200 },
  { state: "Tamil Nadu", code: "TN", capital: "Chennai", region: "South", providers: 3521, buyers: 9180, growth: 15, topService: "Plumber", activityScore: 88, hires: 7350, revenue: 352100 },
  { state: "Delhi", code: "DL", capital: "New Delhi", region: "North", providers: 3280, buyers: 11200, growth: 20, topService: "Home Cleaner", activityScore: 92, hires: 8960, revenue: 328000 },
  { state: "West Bengal", code: "WB", capital: "Kolkata", region: "East", providers: 2870, buyers: 7650, growth: 12, topService: "Tutor", activityScore: 82, hires: 5840, revenue: 287000 },
  { state: "Gujarat", code: "GJ", capital: "Ahmedabad", region: "West", providers: 2650, buyers: 6820, growth: 17, topService: "Carpenter", activityScore: 79, hires: 5210, revenue: 265000 },
  { state: "Telangana", code: "TG", capital: "Hyderabad", region: "South", providers: 2420, buyers: 6340, growth: 25, topService: "Electrician", activityScore: 85, hires: 5980, revenue: 242000 },
  { state: "Rajasthan", code: "RJ", capital: "Jaipur", region: "North", providers: 2180, buyers: 5420, growth: 11, topService: "Painter", activityScore: 72, hires: 4320, revenue: 218000 },
  { state: "Uttar Pradesh", code: "UP", capital: "Lucknow", region: "North", providers: 2050, buyers: 5830, growth: 9, topService: "Plumber", activityScore: 70, hires: 4180, revenue: 205000 },
  { state: "Kerala", code: "KL", capital: "Thiruvananthapuram", region: "South", providers: 1980, buyers: 4920, growth: 19, topService: "Nurse/Caregiver", activityScore: 77, hires: 4560, revenue: 198000 },
  { state: "Punjab", code: "PB", capital: "Chandigarh", region: "North", providers: 1820, buyers: 4210, growth: 14, topService: "Mechanic", activityScore: 73, hires: 3820, revenue: 182000 },
  { state: "Haryana", code: "HR", capital: "Gurugram", region: "North", providers: 1650, buyers: 3980, growth: 16, topService: "Security Guard", activityScore: 71, hires: 3540, revenue: 165000 },
  { state: "Madhya Pradesh", code: "MP", capital: "Bhopal", region: "Central", providers: 1540, buyers: 3720, growth: 10, topService: "Painter", activityScore: 66, hires: 3120, revenue: 154000 },
  { state: "Bihar", code: "BR", capital: "Patna", region: "East", providers: 1320, buyers: 3450, growth: 7, topService: "Tutor", activityScore: 58, hires: 2640, revenue: 132000 },
  { state: "Odisha", code: "OR", capital: "Bhubaneswar", region: "East", providers: 1210, buyers: 2980, growth: 13, topService: "Electrician", activityScore: 62, hires: 2820, revenue: 121000 },
  { state: "Assam", code: "AS", capital: "Guwahati", region: "Northeast", providers: 980, buyers: 2340, growth: 21, topService: "Cook", activityScore: 65, hires: 2180, revenue: 98000 },
  { state: "Jharkhand", code: "JH", capital: "Ranchi", region: "East", providers: 870, buyers: 2120, growth: 9, topService: "Mason", activityScore: 55, hires: 1840, revenue: 87000 },
  { state: "Chhattisgarh", code: "CG", capital: "Raipur", region: "Central", providers: 820, buyers: 1980, growth: 11, topService: "Plumber", activityScore: 54, hires: 1620, revenue: 82000 },
  { state: "Uttarakhand", code: "UK", capital: "Dehradun", region: "North", providers: 760, buyers: 1820, growth: 15, topService: "Driver", activityScore: 56, hires: 1540, revenue: 76000 },
  { state: "Himachal Pradesh", code: "HP", capital: "Shimla", region: "North", providers: 620, buyers: 1450, growth: 12, topService: "Driver", activityScore: 48, hires: 1280, revenue: 62000 },
  { state: "Goa", code: "GA", capital: "Panaji", region: "West", providers: 580, buyers: 1620, growth: 24, topService: "Chef/Cook", activityScore: 72, hires: 1480, revenue: 58000 },
  { state: "Tripura", code: "TR", capital: "Agartala", region: "Northeast", providers: 540, buyers: 1280, growth: 28, topService: "Electrician", activityScore: 60, hires: 1120, revenue: 54000 },
  { state: "Manipur", code: "MN", capital: "Imphal", region: "Northeast", providers: 420, buyers: 980, growth: 18, topService: "Nurse", activityScore: 45, hires: 840, revenue: 42000 },
  { state: "Meghalaya", code: "ML", capital: "Shillong", region: "Northeast", providers: 380, buyers: 890, growth: 16, topService: "Driver", activityScore: 42, hires: 760, revenue: 38000 },
  { state: "Nagaland", code: "NL", capital: "Kohima", region: "Northeast", providers: 290, buyers: 680, growth: 14, topService: "Cook", activityScore: 38, hires: 580, revenue: 29000 },
  { state: "Arunachal Pradesh", code: "AR", capital: "Itanagar", region: "Northeast", providers: 240, buyers: 560, growth: 12, topService: "Plumber", activityScore: 32, hires: 460, revenue: 24000 },
  { state: "Mizoram", code: "MZ", capital: "Aizawl", region: "Northeast", providers: 210, buyers: 490, growth: 11, topService: "Carpenter", activityScore: 30, hires: 390, revenue: 21000 },
  { state: "Sikkim", code: "SK", capital: "Gangtok", region: "Northeast", providers: 180, buyers: 420, growth: 9, topService: "Driver", activityScore: 28, hires: 340, revenue: 18000 },
];

export const SERVICE_DEMAND: ServiceDemand[] = [
  { service: "Electrician", demand: 8420, yoy: 32, trend: "up", peak: "Monsoon", topState: "Maharashtra", category: "Home Services" },
  { service: "Plumber", demand: 7210, yoy: 28, trend: "up", peak: "Monsoon", topState: "Tamil Nadu", category: "Home Services" },
  { service: "Home Cleaner", demand: 6850, yoy: 41, trend: "up", peak: "Festival Season", topState: "Delhi", category: "Home Services" },
  { service: "Cook / Chef", demand: 5920, yoy: 19, trend: "up", peak: "Festival Season", topState: "Assam", category: "Food & Kitchen" },
  { service: "Carpenter", demand: 4830, yoy: 15, trend: "stable", peak: "Winter", topState: "Gujarat", category: "Construction" },
  { service: "Painter", demand: 4520, yoy: 22, trend: "up", peak: "Pre-Summer", topState: "Rajasthan", category: "Construction" },
  { service: "Driver", demand: 4210, yoy: 18, trend: "up", peak: "Year-round", topState: "Delhi", category: "Transport" },
  { service: "Tutor / Teacher", demand: 3980, yoy: 25, trend: "up", peak: "Exam Season", topState: "West Bengal", category: "Education" },
  { service: "AC Technician", demand: 3650, yoy: 29, trend: "up", peak: "Summer", topState: "Telangana", category: "Electronics" },
  { service: "Nurse / Caregiver", demand: 3420, yoy: 38, trend: "up", peak: "Year-round", topState: "Kerala", category: "Healthcare" },
  { service: "Physiotherapist", demand: 2980, yoy: 45, trend: "up", peak: "Year-round", topState: "Karnataka", category: "Healthcare" },
  { service: "Security Guard", demand: 2840, yoy: 8, trend: "stable", peak: "Festival Season", topState: "Haryana", category: "Security" },
  { service: "Mason / Construction", demand: 2650, yoy: 6, trend: "stable", peak: "Summer", topState: "Jharkhand", category: "Construction" },
  { service: "Delivery Person", demand: 2430, yoy: 52, trend: "up", peak: "Festival Season", topState: "Maharashtra", category: "Transport" },
  { service: "Event Decorator", demand: 1920, yoy: 35, trend: "up", peak: "Wedding/Festival", topState: "Rajasthan", category: "Events" },
  { service: "Gardener", demand: 1650, yoy: 12, trend: "stable", peak: "Monsoon", topState: "Kerala", category: "Home Services" },
  { service: "Welder / Fabricator", demand: 1420, yoy: 6, trend: "down", peak: "Winter", topState: "Gujarat", category: "Construction" },
  { service: "Mechanic", demand: 3650, yoy: 11, trend: "stable", peak: "Summer", topState: "Punjab", category: "Automotive" },
];

export const MONTHLY_TREND = [
  { month: "Jan", registrations: 420, hires: 1820, revenue: 42000, activeUsers: 8200 },
  { month: "Feb", registrations: 480, hires: 1940, revenue: 48000, activeUsers: 8800 },
  { month: "Mar", registrations: 620, hires: 2340, revenue: 62000, activeUsers: 10200 },
  { month: "Apr", registrations: 710, hires: 2650, revenue: 71000, activeUsers: 11400 },
  { month: "May", registrations: 840, hires: 3120, revenue: 84000, activeUsers: 13200 },
  { month: "Jun", registrations: 920, hires: 3480, revenue: 92000, activeUsers: 14800 },
  { month: "Jul", registrations: 1080, hires: 3920, revenue: 108000, activeUsers: 16200 },
  { month: "Aug", registrations: 980, hires: 3640, revenue: 98000, activeUsers: 15400 },
  { month: "Sep", registrations: 860, hires: 3280, revenue: 86000, activeUsers: 14200 },
  { month: "Oct", registrations: 1240, hires: 4820, revenue: 124000, activeUsers: 18600 },
  { month: "Nov", registrations: 1380, hires: 5240, revenue: 138000, activeUsers: 20400 },
  { month: "Dec", registrations: 1120, hires: 4380, revenue: 112000, activeUsers: 17800 },
];

export const QUARTERLY_TREND = [
  { quarter: "Q1 2024", registrations: 1520, hires: 6100, revenue: 152000 },
  { quarter: "Q2 2024", registrations: 2470, hires: 9250, revenue: 247000 },
  { quarter: "Q3 2024", registrations: 2980, hires: 10840, revenue: 298000 },
  { quarter: "Q4 2024", registrations: 3740, hires: 14440, revenue: 374000 },
  { quarter: "Q1 2025", registrations: 4120, hires: 16200, revenue: 412000 },
  { quarter: "Q2 2025", registrations: 5280, hires: 20140, revenue: 528000 },
];

export const SEASONAL_DEMAND = [
  { season: "Summer (Mar–May)", electrician: 85, plumber: 62, cleaner: 70, cook: 55, acTech: 100, painter: 95 },
  { season: "Monsoon (Jun–Sep)", electrician: 100, plumber: 100, cleaner: 65, cook: 68, acTech: 40, painter: 30 },
  { season: "Festival (Oct–Nov)", electrician: 90, plumber: 70, cleaner: 100, cook: 100, acTech: 45, painter: 60 },
  { season: "Winter (Dec–Feb)", electrician: 65, plumber: 55, cleaner: 80, cook: 85, acTech: 20, painter: 55 },
];

export const TOP_CITIES = [
  { city: "Mumbai", state: "MH", providers: 1820, buyers: 4820, hires: 3940, demand: 98 },
  { city: "Bengaluru", state: "KA", providers: 1650, buyers: 4220, hires: 3540, demand: 95 },
  { city: "Delhi NCR", state: "DL", providers: 1580, buyers: 5120, hires: 4280, demand: 97 },
  { city: "Hyderabad", state: "TG", providers: 1340, buyers: 3680, hires: 2980, demand: 89 },
  { city: "Chennai", state: "TN", providers: 1280, buyers: 3420, hires: 2740, demand: 86 },
  { city: "Kolkata", state: "WB", providers: 1120, buyers: 2980, hires: 2340, demand: 82 },
  { city: "Ahmedabad", state: "GJ", providers: 980, buyers: 2640, hires: 2080, demand: 78 },
  { city: "Pune", state: "MH", providers: 920, buyers: 2420, hires: 1920, demand: 76 },
  { city: "Jaipur", state: "RJ", providers: 820, buyers: 2120, hires: 1640, demand: 71 },
  { city: "Kochi", state: "KL", providers: 760, buyers: 1980, hires: 1540, demand: 69 },
  { city: "Lucknow", state: "UP", providers: 720, buyers: 1840, hires: 1420, demand: 66 },
  { city: "Bhopal", state: "MP", providers: 640, buyers: 1620, hires: 1240, demand: 62 },
  { city: "Guwahati", state: "AS", providers: 560, buyers: 1380, hires: 1080, demand: 60 },
  { city: "Patna", state: "BR", providers: 520, buyers: 1280, hires: 980, demand: 55 },
  { city: "Agartala", state: "TR", providers: 480, buyers: 1120, hires: 920, demand: 58 },
];

export const AI_INSIGHTS = [
  { icon: "⚡", color: "#F59E0B", title: "Electrician demand up 32% in Kolkata", detail: "Monsoon season driving surge in electrical repair requests. Highest in last 18 months.", urgency: "high" },
  { icon: "🍳", color: "#10B981", title: "Cook services trending in metro cities", detail: "Post-pandemic dining shifts have increased demand for home cooks near Mumbai, Delhi, and Bengaluru by 41%.", urgency: "medium" },
  { icon: "🏠", color: "#3B82F6", title: "Home cleaning peaks during Diwali season", detail: "October–November sees 2.4× average demand for home cleaners across all major cities.", urgency: "medium" },
  { icon: "💊", color: "#8B5CF6", title: "Physiotherapist demand rising in metros", detail: "45% YoY growth — highest demand in Bengaluru, Delhi, and Hyderabad. Low supply in Tier-2 cities.", urgency: "high" },
  { icon: "❄️", color: "#06B6D4", title: "AC technician demand peaks in summer", detail: "April–June sees 100% demand index. Northeast India shows emerging demand with 68% supply gap.", urgency: "medium" },
  { icon: "🌧️", color: "#6366F1", title: "Plumber demand spikes during monsoon", detail: "July–September sees highest plumbing demand. Bihar, Odisha, and Assam show highest unmet demand.", urgency: "high" },
  { icon: "🎓", color: "#EC4899", title: "Tutor demand growing in Tier-2 cities", detail: "Education services growing 25% YoY. Lucknow, Patna, and Bhubaneswar show emerging demand.", urgency: "low" },
  { icon: "🚗", color: "#FF6B35", title: "Delivery services growing fastest overall", detail: "52% YoY growth — highest category. Festival seasons drive 3× spikes.", urgency: "high" },
];

export const BEHAVIOR_STATS = {
  mostSearched: [
    { service: "Electrician", searches: 28420, icon: "⚡" },
    { service: "Plumber", searches: 24180, icon: "🔧" },
    { service: "Home Cleaner", searches: 21640, icon: "🧹" },
    { service: "Cook / Chef", searches: 18920, icon: "🍳" },
    { service: "Tutor", searches: 16480, icon: "📚" },
    { service: "AC Technician", searches: 14320, icon: "❄️" },
    { service: "Painter", searches: 12840, icon: "🖌️" },
    { service: "Driver", searches: 11640, icon: "🚗" },
  ],
  mostContacted: [
    { service: "Electrician", contacts: 12840, responseRate: 94 },
    { service: "Plumber", contacts: 10920, responseRate: 91 },
    { service: "Home Cleaner", contacts: 9480, responseRate: 88 },
    { service: "Cook / Chef", contacts: 8240, responseRate: 85 },
    { service: "Driver", contacts: 7820, responseRate: 96 },
  ],
  peakHours: [
    { hour: "6–9 AM", activity: 42 },
    { hour: "9–12 PM", activity: 78 },
    { hour: "12–3 PM", activity: 65 },
    { hour: "3–6 PM", activity: 85 },
    { hour: "6–9 PM", activity: 100 },
    { hour: "9–12 AM", activity: 48 },
  ],
  completionRate: 87,
  avgResponseTime: "14 min",
  repeatHireRate: 64,
};

export const REVENUE_STATS = {
  byPlan: [
    { plan: "Basic", subscribers: 4820, monthly: 48200, color: "#94A3B8" },
    { plan: "Standard", subscribers: 2640, monthly: 79200, color: "#3B82F6" },
    { plan: "Premium", subscribers: 980, monthly: 58800, color: "#FF6B35" },
  ],
  byRegion: [
    { region: "West (MH, GJ, GA)", revenue: 805100, growth: 18 },
    { region: "South (KA, TN, TG, KL)", revenue: 1186300, growth: 22 },
    { region: "North (DL, UP, RJ, PB, HR)", revenue: 898000, growth: 16 },
    { region: "East (WB, OR, BR, JH)", revenue: 627000, growth: 10 },
    { region: "Central (MP, CG)", revenue: 236000, growth: 11 },
    { region: "Northeast (AS, TR, MN, others)", revenue: 281000, growth: 19 },
  ],
  adRevenue: [
    { month: "Jan", revenue: 12400 },
    { month: "Feb", revenue: 13800 },
    { month: "Mar", revenue: 16200 },
    { month: "Apr", revenue: 18400 },
    { month: "May", revenue: 21600 },
    { month: "Jun", revenue: 24200 },
    { month: "Jul", revenue: 28400 },
    { month: "Aug", revenue: 26800 },
    { month: "Sep", revenue: 24600 },
    { month: "Oct", revenue: 34800 },
    { month: "Nov", revenue: 38400 },
    { month: "Dec", revenue: 31200 },
  ],
};

export const REGIONS = ["All India", "North", "South", "East", "West", "Central", "Northeast"];
export const TIME_RANGES = ["Last 7 Days", "Last 30 Days", "Last 3 Months", "Last 6 Months", "This Year", "Last Year"];
export const ALL_CATEGORIES = [
  "All Categories", "Home Services", "Construction", "Healthcare", "Education",
  "Transport", "Food & Kitchen", "Electronics", "Security", "Events", "Automotive",
];
