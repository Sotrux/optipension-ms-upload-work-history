export class UploadPdfResponseDto {
  success: boolean;
  message?: string;
  errorMessage?: string;
  userId: string;
  userName: string;
  document?: string;
  fullName?: string;
  totalWeeks?: number;
  fileName: string;
  jobId?: string;
} 