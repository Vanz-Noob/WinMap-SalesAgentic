export interface Stage {
  id: string;
  name: string;
  order: number;
  probability: number;
  is_closed: boolean;
  is_won: boolean;
}

export interface Opportunity {
  id: string;
  account_id: string | null;
  name: string;
  stage_id: string | null;
  value: number;
  currency: string;
  close_date: string | null;
  win_probability: number;
  owner_id: string | null;
  presales_id: string | null;
  presales_name: string | null;
  source: string | null;
  ai_metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface Account {
  id: string;
  name: string;
  industry: string | null;
  website: string | null;
  size: string | null;
  region: string | null;
  created_at: string;
}

export interface Contact {
  id: string;
  account_id: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  created_at: string;
}

export interface Activity {
  id: string;
  opp_id: string;
  type: string;
  description: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Task {
  id: string;
  opp_id: string;
  title: string;
  due_date: string | null;
  status: string;
  assigned_to: string | null;
  created_at: string;
}

export interface DashboardSummary {
  stage_name: string;
  stage_order: number;
  deal_count: number;
  total_value: number;
  avg_probability: number;
}

export interface AgentLog {
  id: string;
  agent_type: string;
  action: string;
  input: Record<string, unknown> | null;
  output: Record<string, unknown> | null;
  token_usage: number;
  status: string;
  timestamp: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  quota: number;
  created_at: string;
}

export interface SalesOfTheMonthWinner {
  rep_id: string;
  rep_name: string;
  email: string;
  quota: number;
  total_deals: number;
  won_deals: number;
  lost_deals: number;
  open_deals: number;
  won_revenue: number;
  pipeline_value: number;
  win_rate: number;
  activity_count: number;
  quota_attainment: number;
  composite_score: number;
  rank: number;
}

export interface SalesOfTheMonth {
  month: string;
  winner: SalesOfTheMonthWinner | null;
  ranking: SalesOfTheMonthWinner[];
}

// Target Tracking
export interface IndividualTarget {
  rep_id: string;
  rep_name: string;
  email: string;
  target: number;
  achieved: number;
  pipeline: number;
  percentage: number;
  deal_count: number;
  won_count: number;
}

export interface TeamTarget {
  team_name: string;
  member_count: number;
  target: number;
  achieved: number;
  pipeline: number;
  percentage: number;
  members: IndividualTarget[];
}

export interface CompanyTarget {
  target: number;
  achieved: number;
  pipeline: number;
  percentage: number;
  rep_count: number;
}

export interface TargetTracking {
  company: CompanyTarget;
  teams: TeamTarget[];
  individuals: IndividualTarget[];
}

// Pipeline Insight
export interface AtRiskDeal {
  id: string;
  name: string;
  value: number;
  win_probability: number;
  close_date: string;
  days_to_close: number;
}

export interface StageInsight {
  stage_id: string;
  stage_name: string;
  stage_order: number;
  is_closed: boolean;
  is_won: boolean;
  deal_count: number;
  total_value: number;
  avg_probability: number;
  weighted_value: number;
  at_risk_deals: AtRiskDeal[];
  at_risk_count: number;
}

export interface PipelineInsightSummary {
  total_pipeline_value: number;
  weighted_pipeline: number;
  total_won_revenue: number;
  total_lost_value: number;
  open_deals: number;
  won_deals: number;
  lost_deals: number;
  win_conversion_rate: number;
  avg_deal_size: number;
  deals_closing_this_month: number;
  at_risk_count: number;
}

export interface ClosingSoonDeal {
  id: string;
  name: string;
  value: number;
  win_probability: number;
  close_date: string;
  days_to_close: number;
}

export interface PipelineInsight {
  summary: PipelineInsightSummary;
  stage_insights: StageInsight[];
  closing_soon: ClosingSoonDeal[];
}

// ── Analytics ──
export interface RevenueTrendItem {
  month: string;
  revenue: number;
  deal_count: number;
}

export interface FunnelStageItem {
  name: string;
  order: number;
  deal_count: number;
  total_value: number;
  conversion_rate: number;
}

export interface ConversionFunnel {
  stages: FunnelStageItem[];
  overall_conversion_rate: number;
}

export interface VelocityByStage {
  stage_name: string;
  avg_days: number;
  deal_count: number;
}

export interface DealVelocity {
  avg_days_to_close: number;
  avg_open_deal_age: number;
  by_stage: VelocityByStage[];
}

export interface WinLossMonth {
  month: string;
  won: number;
  lost: number;
}

export interface WinLossSource {
  source: string;
  won: number;
  lost: number;
  open: number;
  win_rate: number;
  total_value: number;
}

export interface WinLossAnalysis {
  total_won: number;
  total_lost: number;
  win_rate: number;
  won_revenue: number;
  lost_revenue: number;
  by_month: WinLossMonth[];
  by_source: WinLossSource[];
}

export interface RepLeaderboardItem {
  rep_id: string;
  rep_name: string;
  total_deals: number;
  won_deals: number;
  lost_deals: number;
  open_deals: number;
  won_revenue: number;
  win_rate: number;
  avg_deal_size: number;
  quota_attainment: number;
  pipeline_value: number;
  score: number;
}

export interface DealSizeBucket {
  range: string;
  count: number;
  total_value: number;
}

export interface SourcePerformanceItem {
  count: number;
  value: number;
  won: number;
  win_rate: number;
  avg_value: number;
}

export interface SourcePerformance {
  ai: SourcePerformanceItem;
  manual: SourcePerformanceItem;
}

export interface IndustryItem {
  industry: string;
  deal_count: number;
  total_value: number;
  won_value: number;
}

export interface AgingBucket {
  bucket: string;
  count: number;
  total_value: number;
}

export interface HealthFactor {
  label: string;
  value: string;
  status: string;
}

export interface PipelineHealth {
  score: number;
  factors: HealthFactor[];
}

export interface AnalyticsData {
  revenue_trend: RevenueTrendItem[];
  conversion_funnel: ConversionFunnel;
  deal_velocity: DealVelocity;
  win_loss: WinLossAnalysis;
  rep_leaderboard: RepLeaderboardItem[];
  deal_size_distribution: DealSizeBucket[];
  source_performance: SourcePerformance;
  industry_breakdown: IndustryItem[];
  aging_analysis: AgingBucket[];
  pipeline_health: PipelineHealth;
}

// ---- Presales KPI Tracking ----
export interface PresalesKpiCategory {
  key: string;
  label: string;
  description: string;
  icon: string;
  color: string;
}

export interface PresalesKpiItem {
  id: string;
  user_id: string | null;
  user_name: string | null;
  category: string;
  item_name: string;
  description: string | null;
  target: number;
  actual: number;
  unit: string;
  quarter: string;
  year: number;
  status: string;
  notes: string | null;
  progress: number;
  created_at: string | null;
  updated_at: string | null;
}

export interface PresalesKpiCategorySummary extends PresalesKpiCategory {
  total_items: number;
  achieved_items: number;
  in_progress_items: number;
  overdue_items: number;
  avg_progress: number;
  items: PresalesKpiItem[];
}

export interface PresalesKpiSummary {
  categories: PresalesKpiCategorySummary[];
  overall_score: number;
  total_items: number;
  total_achieved: number;
  total_in_progress: number;
  total_overdue: number;
  quarter: string;
  year: number | string;
}
