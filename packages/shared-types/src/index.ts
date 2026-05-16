// Shared types between web, api, and other apps.
// Add types here that are used in multiple apps.

export type Role = 'SUPER_ADMIN' | 'OWNER' | 'MANAGER' | 'EMPLOYEE';

export type EmployeeRole = 'SERVER' | 'BARTENDER' | 'BUSSER' | 'HOST' | 'COOK' | 'CHEF';

export type DistributionMode = 'RULES_ONLY' | 'ML_ASSISTED' | 'ML_FULL';

export type ShiftStatus = 'PLANNED' | 'IN_PROGRESS' | 'CLOSED' | 'CANCELLED';
