import { Test, TestingModule } from '@nestjs/testing';
import { HistoryLaboralController } from './history-laboral.controller';
import { HistoryLaboralService } from './history-laboral.service';
import { LoggerService } from '../../common/services/logger.service';
import { BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { AuthGuard } from '../../common/guards/auth.guard';
import { ConfigService } from '@nestjs/config';
import { DocumentType } from './dto/upload-request.dto';

// Mock del HistoryLaboralService
const mockHistoryLaboralService = {
  uploadFile: jest.fn(),
};

// Mock del LoggerService
const mockLoggerService = {
  debug: jest.fn(),
  error: jest.fn(),
  logError: jest.fn(),
  logFileOperation: jest.fn(),
};

// Mock del AuthGuard
const mockAuthGuard = {
  canActivate: jest.fn().mockReturnValue(true),
};

// Mock del ConfigService
const mockConfigService = {
  get: jest.fn().mockReturnValue('mock-value'),
};

describe('HistoryLaboralController', () => {
  let controller: HistoryLaboralController;
  let service: HistoryLaboralService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HistoryLaboralController],
      providers: [
        { provide: HistoryLaboralService, useValue: mockHistoryLaboralService },
        { provide: LoggerService, useValue: mockLoggerService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    })
    .overrideGuard(AuthGuard)
    .useValue(mockAuthGuard)
    .compile();

    controller = module.get<HistoryLaboralController>(HistoryLaboralController);
    service = module.get<HistoryLaboralService>(HistoryLaboralService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
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

    const mockUploadRequestDto = {
      documentType: DocumentType.CEDULA_CIUDADANIA,
      documentNumber: '1234567890'
    };

    const mockUser = {
      sub: 'test-user-123',
      name: 'Test User',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
      aud: 'api:optipension',
      iss: 'https://optipension-test.com'
    };

    it('should successfully upload a valid PDF file', async () => {
      const expectedResponse = {
        success: true,
        message: 'Archivo PDF válido recibido correctamente',
        data: {
          fileName: mockFile.originalname,
          fileSize: mockFile.size,
          spacesUrl: 'https://example.com/test.pdf',
        },
      };

      mockHistoryLaboralService.uploadFile.mockResolvedValue(expectedResponse);

      const result = await controller.uploadFile(mockFile, mockUploadRequestDto, mockUser);

      expect(result).toEqual(expectedResponse);
      expect(service.uploadFile).toHaveBeenCalledWith(mockFile, mockUploadRequestDto.documentType, mockUploadRequestDto.documentNumber, mockUser.sub);
      expect(mockLoggerService.debug).toHaveBeenCalled();
    });

    it('should throw BadRequestException when no file is provided', async () => {
      await expect(controller.uploadFile(null, mockUploadRequestDto, mockUser)).rejects.toThrow();
      expect(service.uploadFile).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for invalid file type', async () => {
      const invalidFile = {
        ...mockFile,
        mimetype: 'application/jpeg',
      } as Express.Multer.File;

      mockHistoryLaboralService.uploadFile.mockRejectedValue(
        new Error('Invalid file type')
      );

      await expect(controller.uploadFile(invalidFile, mockUploadRequestDto, mockUser)).rejects.toThrow();
      expect(service.uploadFile).toHaveBeenCalledWith(invalidFile, mockUploadRequestDto.documentType, mockUploadRequestDto.documentNumber, mockUser.sub);
    });

    it('should throw BadRequestException for file exceeding size limit', async () => {
      const largeFile = {
        ...mockFile,
        size: 3 * 1024 * 1024, // 3MB
      } as Express.Multer.File;

      mockHistoryLaboralService.uploadFile.mockRejectedValue(
        new Error('File too large')
      );

      await expect(controller.uploadFile(largeFile, mockUploadRequestDto, mockUser)).rejects.toThrow();
      expect(service.uploadFile).toHaveBeenCalledWith(largeFile, mockUploadRequestDto.documentType, mockUploadRequestDto.documentNumber, mockUser.sub);
    });

    it('should propagate BadRequestException from service', async () => {
      const mockFile = {
        originalname: 'test.txt',
        size: 1024,
        mimetype: 'text/plain',
      } as Express.Multer.File;

      const expectedError = new BadRequestException('Formato de archivo inválido');
      mockHistoryLaboralService.uploadFile.mockRejectedValue(expectedError);

      await expect(controller.uploadFile(mockFile, mockUploadRequestDto, mockUser)).rejects.toThrow(BadRequestException);
      expect(mockHistoryLaboralService.uploadFile).toHaveBeenCalledWith(mockFile, mockUploadRequestDto.documentType, mockUploadRequestDto.documentNumber, mockUser.sub);
      expect(mockLoggerService.error).toHaveBeenCalled();
    });

    it('should throw InternalServerErrorException for unhandled errors', async () => {
      const mockFile = {
        originalname: 'test.pdf',
        size: 1024 * 1024,
        mimetype: 'application/pdf',
      } as Express.Multer.File;

      const unexpectedError = new Error('Error inesperado');
      mockHistoryLaboralService.uploadFile.mockRejectedValue(unexpectedError);

      await expect(controller.uploadFile(mockFile, mockUploadRequestDto, mockUser)).rejects.toThrow(InternalServerErrorException);
      expect(mockHistoryLaboralService.uploadFile).toHaveBeenCalledWith(mockFile, mockUploadRequestDto.documentType, mockUploadRequestDto.documentNumber, mockUser.sub);
      expect(mockLoggerService.error).toHaveBeenCalled();
    });
  });
}); 