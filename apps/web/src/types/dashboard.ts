/**
 * Dashboard stats — shapes returned by GET /dashboard/stats?period=...
 * Mirror of DashboardService return type (backend).
 */

export type StatsPeriod = 'today' | 'week' | 'month';

export interface HourlySale {
  hour: string; // "18:00"
  total: number;
}

export interface DailyTip {
  date: string; // "2026-05-20"
  total: number;
}

export interface TopEmployee {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
  salesGenerated: number;
  tipsEstimated: number;
  ordersCount: number;
  hoursWorked: number;
  fairnessScore: number | null;
}

export interface RoleBreakdown {
  role: string;
  label: string;
  color: string;
  total: number;
  share: number; // 0–1
}

export type AlertType = 'NO_TIP_POOL' | 'NO_HOURS';
export type AlertSeverity = 'warn' | 'error';

export interface DashboardAlert {
  type: AlertType;
  message: string;
  shiftId?: string;
  employeeId?: string;
  severity: AlertSeverity;
}

export interface LiveShiftTeamMember {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
}

export interface LiveShift {
  id: string;
  type: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  liveOrdersCount: number;
  liveOrdersTotal: number;
  tipsEstimated: number;
  teamCount: number;
  team: LiveShiftTeamMember[];
  progressPct: number;
}

export interface TomorrowShift {
  id: string;
  type: string;
  date: string;
  startTime: string;
  endTime: string;
  notes: string | null;
  staffCount: number;
  isUnderstaffed: boolean;
}

export interface DashboardStats {
  period: StatsPeriod;
  tipsTotal: number;
  tipsCount: number;
  prevTipsTotal: number;
  ticketMoyen: number;
  activeEmployeesCount: number;
  fairnessScore: number | null;
  hourlySales: HourlySale[];
  dailyTips: DailyTip[];
  topEmployees: TopEmployee[];
  roleBreakdown: RoleBreakdown[];
  alerts: DashboardAlert[];
  liveShift: LiveShift | null;
  tomorrowShifts: TomorrowShift[];
}
