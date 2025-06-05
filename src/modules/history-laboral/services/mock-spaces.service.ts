import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MockSpacesService {
  private readonly uploadDir: string;

  constructor(private readonly configService: ConfigService) {
    // Usar un directorio temporal para las pruebas
    this.uploadDir = path.join(process.cwd(), 'test-uploads');
    this.ensureUploadDir();
  }

  private ensureUploadDir(): void {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async uploadFile(
    file: Express.Multer.File,
    documentType: string,
    documentNumber: string
  ): Promise<{ key: string; url: string }> {
    const fileName = this.generateFileName(documentType, documentNumber);
    const filePath = path.join(this.uploadDir, fileName);

    // Guardar el archivo
    await fs.promises.writeFile(filePath, file.buffer);

    // Simular una URL de Spaces
    const url = `http://localhost:1338/test-uploads/${fileName}`;

    return {
      key: fileName,
      url
    };
  }

  private generateFileName(documentType: string, documentNumber: string): string {
    const date = new Date();
    const formattedDate = date.toISOString().split('T')[0].replace(/-/g, '');
    return `${documentType}-${documentNumber}-HL-${formattedDate}.pdf`;
  }

  async deleteFile(key: string): Promise<void> {
    const filePath = path.join(this.uploadDir, key);
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
    }
  }

  // Método para limpiar el directorio de pruebas
  async cleanup(): Promise<void> {
    if (fs.existsSync(this.uploadDir)) {
      const files = await fs.promises.readdir(this.uploadDir);
      await Promise.all(
        files.map(file => 
          fs.promises.unlink(path.join(this.uploadDir, file))
        )
      );
    }
  }
} 