import { Test, TestingModule } from '@nestjs/testing';
import { HistoryLaboralService } from './history-laboral.service';
import { LoggerService } from '../../common/services/logger.service';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentType } from './dto/upload-request.dto';
import { MockSpacesService } from './services/mock-spaces.service';
import * as fs from 'fs';
import * as path from 'path';

// Mock de LoggerService
const mockLoggerService = {
  debug: jest.fn(),
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

describe('HistoryLaboralService', () => {
  let service: HistoryLaboralService;
  let loggerService: LoggerService;
  let mockSpacesService: MockSpacesService;
  const testUploadDir = path.join(process.cwd(), 'test-uploads');

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HistoryLaboralService,
        { provide: LoggerService, useValue: mockLoggerService },
        { provide: ConfigService, useValue: mockConfigService },
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

    it('should successfully upload a valid PDF file to mock storage', async () => {
      const result = await service.uploadFile(mockFile, mockDocumentType, mockDocumentNumber);

      expect(result).toEqual({
        success: true,
        message: 'Archivo PDF válido recibido correctamente',
        data: {
          fileName: mockFile.originalname,
          fileSize: mockFile.size,
          spacesUrl: expect.stringContaining('test-uploads'),
        },
      });

      // Verificar que el archivo se guardó físicamente
      const expectedFileName = `${mockDocumentType}-${mockDocumentNumber}-HL-${new Date().toISOString().split('T')[0].replace(/-/g, '')}.pdf`;
      const filePath = path.join(testUploadDir, expectedFileName);
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it('should throw BadRequestException when no file is provided', async () => {
      await expect(service.uploadFile(null, mockDocumentType, mockDocumentNumber))
        .rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for invalid MIME type', async () => {
      const invalidFile = {
        ...mockFile,
        mimetype: 'application/jpeg',
      } as Express.Multer.File;

      await expect(service.uploadFile(invalidFile, mockDocumentType, mockDocumentNumber))
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

      await expect(service.uploadFile(invalidFile, mockDocumentType, mockDocumentNumber))
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

      await expect(service.uploadFile(largeFile, mockDocumentType, mockDocumentNumber))
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