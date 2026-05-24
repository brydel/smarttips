import { cn } from '../../lib/cn';
import type { EmployeeRole } from '../../types/employee';

const ROLE_COLORS: Record<EmployeeRole, string> = {
  BARTENDER: 'bg-st-indigo text-white',
  SERVER: 'bg-st-emerald text-white',
  HOST: 'bg-st-gold text-white',
  COOK: 'bg-st-warn text-white',
  BUSSER: 'bg-st-muted text-st-hi',
};

interface EmployeeAvatarProps {
  firstName: string;
  lastName: string;
  role: EmployeeRole;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizes = {
  sm: { container: 'w-7 h-7 text-[10px]', ring: 'ring-1' },
  md: { container: 'w-9 h-9 text-xs', ring: 'ring-2' },
  lg: { container: 'w-11 h-11 text-sm', ring: 'ring-2' },
  xl: { container: 'w-14 h-14 text-base', ring: 'ring-2' },
};

export function EmployeeAvatar({
  firstName,
  lastName,
  role,
  size = 'md',
  className,
}: EmployeeAvatarProps) {
  const initials = `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase();
  const s = sizes[size];

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-full font-semibold font-sans',
        'ring-st-bg',
        ROLE_COLORS[role],
        s.container,
        s.ring,
        className,
      )}
      aria-label={`${firstName} ${lastName}`}
      title={`${firstName} ${lastName} — ${role}`}
    >
      {initials}
    </span>
  );
}
