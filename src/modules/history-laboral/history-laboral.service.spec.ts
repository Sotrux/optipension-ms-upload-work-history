import { Test, TestingModule } from '@nestjs/testing';
import { HistoryLaboralService } from './history-laboral.service';
import { LoggerService } from '../../common/services/logger.service';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentType } from './dto/upload-request.dto';
import { MockSpacesService } from './services/mock-spaces.service';
import { UploadRepositoryService } from './services/upload-repository.service';
import { PdfProcessingService } from '../pdf-processing/pdf-processing.service';
import * as fs from 'fs';
import * as path from 'path';

// Mock de LoggerService
const mockLoggerService = {
  debug: jest.fn(),
  log: jest.fn(),
  logFileOperation: jest.fn(),
  logError: jest.fn(),
};

// Mock de ConfigService
const mockConfigService = {
  get: jest.fn().mockImplementation((key) => {
    if (key === 'file.maxSize') return 2 * 1024 * 1024; // 2MB
    if (key === 'file.allowedTypes') return ['application/pdf'];
    if (key === 'file.allowedExtensions') return ['.pdf'];
    return null;
  }),
};

// Mock de UploadRepositoryService
const mockUploadRepositoryService = {
  create: jest.fn(),
  findDuplicate: jest.fn(),
  findById: jest.fn(),
  findByUser: jest.fn(),
  getStatistics: jest.fn(),
};

// Mock de PdfProcessingService
const mockPdfProcessingService = {
  enqueueProcessing: jest.fn(),
};

describe('HistoryLaboralService', () => {
  let service: HistoryLaboralService;
  let loggerService: LoggerService;
  let mockSpacesService: MockSpacesService;
  const testUploadDir = path.join(process.cwd(), 'test-uploads');

  beforeEach(async () => {
    // Reset mocks before each test
    jest.clearAllMocks();
    mockUploadRepositoryService.findDuplicate.mockResolvedValue(null);
    mockUploadRepositoryService.create.mockResolvedValue({
      id: 1,
      userId: 'test-user-123',
      documentType: 'CC',
      documentNumber: '12345678',
      originalFilename: 'test.pdf',
      fileSize: 1024,
      spacesKey: 'CC-12345678-HL-20240101.pdf',
      spacesUrl: 'http://localhost:1338/test-uploads/CC-12345678-HL-20240101.pdf',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockPdfProcessingService.enqueueProcessing.mockResolvedValue({ jobId: 'test-job-id' });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HistoryLaboralService,
        { provide: LoggerService, useValue: mockLoggerService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: UploadRepositoryService, useValue: mockUploadRepositoryService },
        { provide: PdfProcessingService, useValue: mockPdfProcessingService },
        MockSpacesService,
      ],
    }).compile();

    service = module.get<HistoryLaboralService>(HistoryLaboralService);
    loggerService = module.get<LoggerService>(LoggerService);
    mockSpacesService = module.get<MockSpacesService>(MockSpacesService);
  });

  afterEach(async () => {
    jest.clearAllMocks();
    // Limpiar archivos de prueba
    await mockSpacesService.cleanup();
  });

  afterAll(async () => {
    // Eliminar directorio de pruebas
    if (fs.existsSync(testUploadDir)) {
      fs.rmSync(testUploadDir, { recursive: true, force: true });
    }
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('uploadFile', () => {
    const mockFile = {
      fieldname: 'file',
      originalname: 'test.pdf',
      encoding: '7bit',
      mimetype: 'application/pdf',
      buffer: Buffer.from('test'),
      size: 1024,
    } as Express.Multer.File;

    const mockDocumentType = DocumentType.CEDULA_CIUDADANIA;
    const mockDocumentNumber = '1234567890';
    const mockUserId = 'test-user-123';

    it('should successfully upload a valid PDF file to mock storage', async () => {
      const result = await service.uploadFile(mockFile, mockDocumentType, mockDocumentNumber, mockUserId);

      expect(result).toEqual({
        success: true,
        message: 'Archivo PDF válido recibido y guardado correctamente',
        data: {
          fileName: mockFile.originalname,
          fileSize: mockFile.size,
          spacesUrl: expect.stringContaining('test-uploads'),
        },
      });

      // Verificar que se llamó al repositorio para crear el registro
      expect(mockUploadRepositoryService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUserId,
          documentType: mockDocumentType,
          documentNumber: mockDocumentNumber,
          originalFilename: mockFile.originalname,
          fileSize: mockFile.size,
        })
      );

      // Verificar que se encoló para procesamiento
      expect(mockPdfProcessingService.enqueueProcessing).toHaveBeenCalledWith(1, expect.any(String));

      // Verificar que el archivo se guardó físicamente
      const expectedFileName = `${mockDocumentType}-${mockDocumentNumber}-HL-${new Date().toISOString().split('T')[0].replace(/-/g, '')}.pdf`;
      const filePath = path.join(testUploadDir, expectedFileName);
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it('should throw BadRequestException when no file is provided', async () => {
      await expect(service.uploadFile(null, mockDocumentType, mockDocumentNumber, mockUserId))
        .rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for invalid MIME type', async () => {
      const invalidFile = {
        ...mockFile,
        mimetype: 'application/jpeg',
      } as Express.Multer.File;

      await expect(service.uploadFile(invalidFile, mockDocumentType, mockDocumentNumber, mockUserId))
        .rejects.toThrow(BadRequestException);
      expect(loggerService.logFileOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'validation',
          status: 'failure',
          failureReason: 'INVALID_MIME_TYPE',
        })
      );
    });

    it('should throw BadRequestException for invalid file extension', async () => {
      const invalidFile = {
        ...mockFile,
        originalname: 'test.jpg',
      } as Express.Multer.File;

      await expect(service.uploadFile(invalidFile, mockDocumentType, mockDocumentNumber, mockUserId))
        .rejects.toThrow(BadRequestException);
      expect(loggerService.logFileOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'validation',
          status: 'failure',
          failureReason: 'INVALID_EXTENSION',
        })
      );
    });

    it('should throw BadRequestException for file exceeding size limit', async () => {
      const largeFile = {
        ...mockFile,
        size: 3 * 1024 * 1024, // 3MB
      } as Express.Multer.File;

      await expect(service.uploadFile(largeFile, mockDocumentType, mockDocumentNumber, mockUserId))
        .rejects.toThrow(BadRequestException);
      expect(loggerService.logFileOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'validation',
          status: 'failure',
          failureReason: 'FILE_TOO_LARGE',
        })
      );
    });
  });
}); 