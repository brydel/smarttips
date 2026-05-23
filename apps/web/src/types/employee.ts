export const EMPLOYEE_ROLES = ['SERVER', 'BUSSER', 'BARTENDER', 'COOK', 'HOST'] as const;
export type EmployeeRole = (typeof EMPLOYEE_ROLES)[number];

/** Shape returned by GET /employees and GET /employees/:id */
export interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  role: EmployeeRole;
  hireDate: string | null;
  hourlyWage: number;
  coefficient: number;
  notes: string | null;
  active: boolean;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * POST /employees — mirrors CreateEmployeeDto exactly.
 * All fields listed here; no extras (API has forbidNonWhitelisted: true).
 */
export interface CreateEmployeePayload {
  firstName: string;
  lastName: string;
  email: string; // required (@IsNotEmpty @IsEmail)
  role: EmployeeRole;
  hourlyWage: number;
  coefficient?: number; // optional, defaults to 1.0 in service
  hireDate: string; // required (@IsNotEmpty @IsDateString strict ISO)
}

/**
 * PATCH /employees/:id — mirrors UpdateEmployeeDto exactly.
 * = PartialType(OmitType(CreateEmployeeDto, ['hireDate']))
 * → hireDate is omitted, everything else is optional.
 * No `active` or `notes` — those are not in the DTO.
 */
export type UpdateEmployeePayload = Partial<Omit<CreateEmployeePayload, 'hireDate'>>;

export interface EmployeeFilters {
  role?: EmployeeRole;
  active?: boolean;
}
