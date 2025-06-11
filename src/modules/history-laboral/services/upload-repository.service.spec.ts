import { Test, TestingModule } from '@nestjs/testing';
import { UploadRepositoryService, CreateUploadData } from './upload-repository.service';
import { PrismaService } from '../../../common/services/prisma.service';
import { DocumentType } from '../dto/upload-request.dto';

describe('UploadRepositoryService', () => {
  let service: UploadRepositoryService;

  const mockPrismaService = {
    hlHistoryLaboralUpload: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UploadRepositoryService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<UploadRepositoryService>(UploadRepositoryService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new upload record', async () => {
      const uploadData: CreateUploadData = {
        userId: 'test-user-id',
        documentType: DocumentType.CEDULA_CIUDADANIA,
        documentNumber: '12345678',
        originalFilename: 'test.pdf',
        fileSize: 1024,
        spacesKey: 'CC-12345678-HL-20240101.pdf',
        spacesUrl: 'https://example.com/test.pdf',
        createdBy: 'test-user-id',
      };

      const expectedUpload = {
        id: 1,
        uu: 'test-uuid',
        ...uploadData,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.hlHistoryLaboralUpload.create.mockResolvedValue(expectedUpload);

      const result = await service.create(uploadData);

      expect(mockPrismaService.hlHistoryLaboralUpload.create).toHaveBeenCalledWith({
        data: {
          userId: uploadData.userId,
          documentType: uploadData.documentType,
          documentNumber: uploadData.documentNumber,
          originalFilename: uploadData.originalFilename,
          fileSize: uploadData.fileSize,
          spacesKey: uploadData.spacesKey,
          spacesUrl: uploadData.spacesUrl,
          createdBy: uploadData.createdBy,
          updatedBy: uploadData.createdBy,
        },
      });
      expect(result).toEqual(expectedUpload);
    });

    it('should throw error when create fails', async () => {
      const uploadData: CreateUploadData = {
        userId: 'test-user-id',
        documentType: DocumentType.CEDULA_CIUDADANIA,
        documentNumber: '12345678',
        originalFilename: 'test.pdf',
        fileSize: 1024,
        spacesKey: 'CC-12345678-HL-20240101.pdf',
        spacesUrl: 'https://example.com/test.pdf',
      };

      mockPrismaService.hlHistoryLaboralUpload.create.mockRejectedValue(
        new Error('Database error')
      );

      await expect(service.create(uploadData)).rejects.toThrow(
        'Error al guardar el archivo en la base de datos: Database error'
      );
    });
  });

  describe('findById', () => {
    it('should find upload by id', async () => {
      const uploadId = 1;
      const expectedUpload = {
        id: uploadId,
        userId: 'test-user-id',
        isActive: true,
      };

      mockPrismaService.hlHistoryLaboralUpload.findUnique.mockResolvedValue(expectedUpload);

      const result = await service.findById(uploadId);

      expect(mockPrismaService.hlHistoryLaboralUpload.findUnique).toHaveBeenCalledWith({
        where: { id: uploadId, isActive: true },
      });
      expect(result).toEqual(expectedUpload);
    });

    it('should return null when upload not found', async () => {
      const uploadId = 999;

      mockPrismaService.hlHistoryLaboralUpload.findUnique.mockResolvedValue(null);

      const result = await service.findById(uploadId);

      expect(result).toBeNull();
    });
  });

  describe('findByUser', () => {
    it('should find uploads by user', async () => {
      const userId = 'test-user-id';
      const expectedUploads = [
        { id: 1, userId, isActive: true },
        { id: 2, userId, isActive: true },
      ];

      mockPrismaService.hlHistoryLaboralUpload.findMany.mockResolvedValue(expectedUploads);

      const result = await service.findByUser(userId);

      expect(mockPrismaService.hlHistoryLaboralUpload.findMany).toHaveBeenCalledWith({
        where: { userId, isActive: true },
        orderBy: { createdAt: 'desc' },
        take: undefined,
        skip: undefined,
      });
      expect(result).toEqual(expectedUploads);
    });

    it('should find uploads by user with options', async () => {
      const userId = 'test-user-id';
      const options = {
        limit: 10,
        offset: 0,
        documentType: DocumentType.CEDULA_CIUDADANIA,
        documentNumber: '12345678',
      };

      mockPrismaService.hlHistoryLaboralUpload.findMany.mockResolvedValue([]);

      await service.findByUser(userId, options);

      expect(mockPrismaService.hlHistoryLaboralUpload.findMany).toHaveBeenCalledWith({
        where: {
          userId,
          isActive: true,
          documentType: options.documentType,
          documentNumber: options.documentNumber,
        },
        orderBy: { createdAt: 'desc' },
        take: options.limit,
        skip: options.offset,
      });
    });
  });

  describe('findDuplicate', () => {
    it('should find duplicate upload', async () => {
      const userId = 'test-user-id';
      const documentType = DocumentType.CEDULA_CIUDADANIA;
      const documentNumber = '12345678';
      const filename = 'test.pdf';
      const expectedUpload = { id: 1, userId, documentType, documentNumber, originalFilename: filename };

      mockPrismaService.hlHistoryLaboralUpload.findFirst.mockResolvedValue(expectedUpload);

      const result = await service.findDuplicate(userId, documentType, documentNumber, filename);

      expect(mockPrismaService.hlHistoryLaboralUpload.findFirst).toHaveBeenCalledWith({
        where: {
          userId,
          documentType,
          documentNumber,
          originalFilename: filename,
          isActive: true,
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual(expectedUpload);
    });

    it('should return null when no duplicate found', async () => {
      mockPrismaService.hlHistoryLaboralUpload.findFirst.mockResolvedValue(null);

      const result = await service.findDuplicate(
        'test-user-id',
        DocumentType.CEDULA_CIUDADANIA,
        '12345678',
        'test.pdf'
      );

      expect(result).toBeNull();
    });
  });

  describe('getStatistics', () => {
    it('should return upload statistics', async () => {
      const mockStats = {
        totalUploads: 100,
        totalActiveUploads: 90,
        totalFileSize: { _sum: { fileSize: 1000000 } },
        uploadsToday: 5,
      };

      mockPrismaService.hlHistoryLaboralUpload.count
        .mockResolvedValueOnce(mockStats.totalUploads) // total
        .mockResolvedValueOnce(mockStats.totalActiveUploads) // active
        .mockResolvedValueOnce(mockStats.uploadsToday); // today

      mockPrismaService.hlHistoryLaboralUpload.aggregate.mockResolvedValue(mockStats.totalFileSize);

      const result = await service.getStatistics();

      expect(result).toEqual({
        totalUploads: 100,
        totalActiveUploads: 90,
        totalFileSize: BigInt(1000000),
        uploadsToday: 5,
      });
    });
  });
}); 