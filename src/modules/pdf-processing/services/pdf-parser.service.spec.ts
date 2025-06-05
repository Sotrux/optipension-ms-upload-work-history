import { Test, TestingModule } from '@nestjs/testing';
import { PdfParserService } from './pdf-parser.service';
import { PdfLoaderService } from './pdf-loader.service';
import { ColpensionesValidatorService } from './colpensiones-validator.service';
import { AfiliadoExtractorService } from './afiliado-extractor.service';
import { PeriodosExtractorService } from './periodos-extractor.service';
import * as fs from 'fs';
import * as path from 'path';

// Mock de los servicios
const mockPdfLoaderService = {
  load: jest.fn(),
  toFullText: jest.fn()
};

const mockColpensionesValidatorService = {
  isColpensionesFormat: jest.fn()
};

const mockAfiliadoExtractorService = {
  extractDocument: jest.fn(),
  extractFullName: jest.fn(),
  extractTotalWeeks: jest.fn()
};

const mockPeriodosExtractorService = {
  extractAllSummaryPeriods: jest.fn()
};

describe('PdfParserService', () => {
  let service: PdfParserService;
  
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PdfParserService,
        { provide: PdfLoaderService, useValue: mockPdfLoaderService },
        { provide: ColpensionesValidatorService, useValue: mockColpensionesValidatorService },
        { provide: AfiliadoExtractorService, useValue: mockAfiliadoExtractorService },
        { provide: PeriodosExtractorService, useValue: mockPeriodosExtractorService }
      ],
    }).compile();

    service = module.get<PdfParserService>(PdfParserService);
    
    // Resetear los mocks antes de cada test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('extractDataFromPdf', () => {
    it('should return error when file does not exist', async () => {
      // Simular que el archivo no existe
      jest.spyOn(fs, 'existsSync').mockReturnValue(false);
      
      const result = await service.extractDataFromPdf('non-existent-file.pdf');
      
      expect(result.success).toBe(false);
      expect(result.errorMessage).toBe('El archivo no existe');
    });

    it('should return error when PDF is not in Colpensiones format', async () => {
      // Simular que el archivo existe
      jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      jest.spyOn(fs, 'statSync').mockReturnValue({ size: 1024 } as fs.Stats);
      
      // Simular la carga del PDF
      mockPdfLoaderService.load.mockResolvedValue({ /* mock PDF data */ });
      mockPdfLoaderService.toFullText.mockReturnValue('Este no es un PDF de Colpensiones');
      
      // Simular que no es un PDF de Colpensiones
      mockColpensionesValidatorService.isColpensionesFormat.mockReturnValue(false);
      
      const result = await service.extractDataFromPdf('not-colpensiones.pdf');
      
      expect(result.success).toBe(false);
      expect(result.errorMessage).toBe('El archivo no parece ser un PDF de Historia Laboral de Colpensiones');
    });

    it('should extract data successfully from a valid Colpensiones PDF', async () => {
      // Simular que el archivo existe
      jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      jest.spyOn(fs, 'statSync').mockReturnValue({ size: 1024 } as fs.Stats);
      
      // Simular la carga del PDF
      const mockPdfData = { /* mock PDF data */ };
      mockPdfLoaderService.load.mockResolvedValue(mockPdfData);
      mockPdfLoaderService.toFullText.mockReturnValue('COLPENSIONES HISTORIA LABORAL');
      
      // Simular validación exitosa
      mockColpensionesValidatorService.isColpensionesFormat.mockReturnValue(true);
      
      // Simular extracción de datos
      mockAfiliadoExtractorService.extractDocument.mockReturnValue('12345678');
      mockAfiliadoExtractorService.extractFullName.mockReturnValue('JUAN PEREZ');
      mockAfiliadoExtractorService.extractTotalWeeks.mockReturnValue(100.5);
      
      // Simular extracción de períodos
      mockPeriodosExtractorService.extractAllSummaryPeriods.mockReturnValue([
        {
          employerId: '900123456',
          employerName: 'EMPRESA TEST',
          from: '2020-01-01',
          to: '2020-12-31',
          weeks: 52,
          ibc: 1000000
        }
      ]);
      
      const result = await service.extractDataFromPdf('valid-colpensiones.pdf');
      
      // Verificar resultado exitoso
      expect(result.success).toBe(true);
      expect(result.document).toBe('12345678');
      expect(result.fullName).toBe('JUAN PEREZ');
      expect(result.totalWeeks).toBe(100.5);
      expect(result.periods).toHaveLength(1);
      expect(result.periods![0].employerId).toBe('900123456');
    });
  });
}); 