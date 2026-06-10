import { apiClient } from '../../../lib/api-client';

export type DateRangeReportParams = {
  from: string;
  to: string;
};

export async function downloadPayrollCsv(params: DateRangeReportParams): Promise<Blob> {
  const { data } = await apiClient.get<Blob>('/reports/payroll', {
    params,
    responseType: 'blob',
  });
  return data;
}

export async function downloadAuditCsv(params: DateRangeReportParams): Promise<Blob> {
  const { data } = await apiClient.get<Blob>('/reports/audit', {
    params,
    responseType: 'blob',
  });
  return data;
}

export async function downloadTipPoolPdf(shiftId: string): Promise<Blob> {
  const { data } = await apiClient.get<Blob>('/reports/tip-pool', {
    params: { shiftId },
    responseType: 'blob',
  });
  return data;
}

export function saveReportBlob(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
