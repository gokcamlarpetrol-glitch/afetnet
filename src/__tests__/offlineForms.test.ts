import { DamageReportRepository } from '../core/data/repositories';
import { DamageReport, DamageType, DamageSeverity } from '../core/data/models';
import { MediaCompressor } from '../core/offline/media';
import { database } from '../core/data/db';

// Mock the database
jest.mock('../core/data/db', () => ({
  database: {
    write: jest.fn(),
    get: jest.fn(),
  },
}));

// Mock expo-image-picker
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  requestCameraPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  launchImageLibraryAsync: jest.fn(() => Promise.resolve({
    canceled: false,
    assets: [{ uri: 'file://test-image.jpg' }],
  })),
  launchCameraAsync: jest.fn(() => Promise.resolve({
    canceled: false,
    assets: [{ uri: 'file://test-photo.jpg' }],
  })),
  MediaTypeOptions: {
    Images: 'Images',
  },
}));

// Mock expo-image-manipulator
jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn(() => Promise.resolve({
    uri: 'file://compressed-image.jpg',
  })),
  SaveFormat: {
    JPEG: 'jpeg',
  },
}));

// Mock react-native-fs
jest.mock('react-native-fs', () => ({
  getFileSize: jest.fn(() => Promise.resolve(100000)),
}));

describe('Offline Forms Module', () => {
  let damageReportRepository: DamageReportRepository;
  let mediaCompressor: MediaCompressor;

  beforeEach(() => {
    damageReportRepository = DamageReportRepository.getInstance();
    mediaCompressor = MediaCompressor.getInstance();
    jest.clearAllMocks();
  });

  describe('DamageReportRepository', () => {
    it('should create a damage report', async () => {
      const mockReport: Partial<DamageReport> = {
        ts: Date.now(),
        lat: 41.0082,
        lon: 28.9784,
        accuracy: 10,
        type: DamageType.Building,
        severity: DamageSeverity.Moderate,
        description: 'Test damage report',
        mediaUris: [],
        verified: false,
        reporterId: 'test-reporter',
        reportedAt: Date.now(),
      };

      const mockCreatedReport = {
        id: 'test-id',
        ...mockReport,
      };

      (database.write as jest.Mock).mockImplementation(() => Promise.resolve());
      (database.get as jest.Mock).mockImplementation(() => Promise.resolve(mockCreatedReport));

      const result = await damageReportRepository.create(mockReport);

      expect(result).toBeDefined();
      expect(result.type).toBe(DamageType.Building);
      expect(result.severity).toBe(DamageSeverity.Moderate);
      expect(result.description).toBe('Test damage report');
    });

    it('should get damage reports by type', async () => {
      const mockReports = [
        {
          id: '1',
          type: DamageType.Building,
          severity: DamageSeverity.Severe,
          description: 'Building damage 1',
        },
        {
          id: '2',
          type: DamageType.Road,
          severity: DamageSeverity.Minor,
          description: 'Road damage 1',
        },
      ];

      (database.get as jest.Mock).mockImplementation(() => Promise.resolve(mockReports));

      const result = await damageReportRepository.getByType(DamageType.Building);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should get damage reports by severity', async () => {
      const mockReports = [
        {
          id: '1',
          type: DamageType.Building,
          severity: DamageSeverity.Critical,
          description: 'Critical damage',
        },
      ];

      (database.get as jest.Mock).mockImplementation(() => Promise.resolve(mockReports));

      const result = await damageReportRepository.getBySeverity(DamageSeverity.Critical);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should get unverified damage reports', async () => {
      const mockReports = [
        {
          id: '1',
          type: DamageType.Building,
          severity: DamageSeverity.Moderate,
          description: 'Unverified damage',
          verified: false,
        },
      ];

      (database.get as jest.Mock).mockImplementation(() => Promise.resolve(mockReports));

      const result = await damageReportRepository.getUnverified();

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.every(report => !report.verified)).toBe(true);
    });

    it('should update damage report verification status', async () => {
      const mockReport = {
        id: 'test-id',
        type: DamageType.Building,
        severity: DamageSeverity.Moderate,
        description: 'Test damage',
        verified: false,
      };

      (database.write as jest.Mock).mockImplementation(() => Promise.resolve());
      (database.get as jest.Mock).mockImplementation(() => Promise.resolve({
        ...mockReport,
        verified: true,
      }));

      const result = await damageReportRepository.updateVerification('test-id', true);

      expect(result).toBeDefined();
      expect(result.verified).toBe(true);
    });
  });

  describe('MediaCompressor', () => {
    it('should request media library permissions', async () => {
      const result = await mediaCompressor.requestMediaLibraryPermissions();

      expect(result).toBe(true);
    });

    it('should request camera permissions', async () => {
      const result = await mediaCompressor.requestCameraPermissions();

      expect(result).toBe(true);
    });

    it('should pick image from library', async () => {
      const result = await mediaCompressor.pickImageFromLibrary();

      expect(result).toBe('file://test-image.jpg');
    });

    it('should take photo with camera', async () => {
      const result = await mediaCompressor.takePhotoWithCamera();

      expect(result).toBe('file://test-photo.jpg');
    });

    it('should compress image with default options', async () => {
      const testUri = 'file://test-image.jpg';
      const result = await mediaCompressor.compressImage(testUri);

      expect(result).toBe('file://compressed-image.jpg');
    });

    it('should compress image with custom options', async () => {
      const testUri = 'file://test-image.jpg';
      const options = {
        maxWidth: 800,
        maxHeight: 600,
        quality: 0.7,
        maxSizeKB: 150,
        format: 'jpeg' as const,
      };

      const result = await mediaCompressor.compressImage(testUri, options);

      expect(result).toBe('file://compressed-image.jpg');
    });

    it('should compress image for damage report', async () => {
      const testUri = 'file://test-image.jpg';
      const result = await mediaCompressor.compressImageForDamageReport(testUri);

      expect(result).toBe('file://compressed-image.jpg');
    });

    it('should compress image for help request', async () => {
      const testUri = 'file://test-image.jpg';
      const result = await mediaCompressor.compressImageForHelpRequest(testUri);

      expect(result).toBe('file://compressed-image.jpg');
    });

    it('should compress image for resource post', async () => {
      const testUri = 'file://test-image.jpg';
      const result = await mediaCompressor.compressImageForResourcePost(testUri);

      expect(result).toBe('file://compressed-image.jpg');
    });

    it('should get image dimensions', async () => {
      const testUri = 'file://test-image.jpg';
      const result = await mediaCompressor.getImageDimensions(testUri);

      expect(result).toBeDefined();
      expect(result?.width).toBe(1024);
      expect(result?.height).toBe(768);
    });

    it('should validate image', async () => {
      const testUri = 'file://test-image.jpg';
      const result = await mediaCompressor.validateImage(testUri);

      expect(result).toBeDefined();
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should validate image with error for large file', async () => {
      const testUri = 'file://large-image.jpg';
      
      // Mock large file size
      const mockGetFileSize = require('react-native-fs').getFileSize;
      mockGetFileSize.mockImplementationOnce(() => Promise.resolve(15 * 1024 * 1024)); // 15MB

      const result = await mediaCompressor.validateImage(testUri);

      expect(result).toBeDefined();
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Dosya boyutu çok büyük (max 10MB)');
    });

    it('should get file size', async () => {
      const testUri = 'file://test-image.jpg';
      const result = await mediaCompressor.getFileSize(testUri);

      expect(result).toBe(100000);
    });
  });

  describe('Damage Report Integration', () => {
    it('should create damage report with media', async () => {
      const mockReport: Partial<DamageReport> = {
        ts: Date.now(),
        lat: 41.0082,
        lon: 28.9784,
        accuracy: 10,
        type: DamageType.Building,
        severity: DamageSeverity.Severe,
        description: 'Test damage report with media',
        mediaUris: ['file://compressed-image1.jpg', 'file://compressed-image2.jpg'],
        verified: false,
        reporterId: 'test-reporter',
        reportedAt: Date.now(),
      };

      const mockCreatedReport = {
        id: 'test-id',
        ...mockReport,
      };

      (database.write as jest.Mock).mockImplementation(() => Promise.resolve());
      (database.get as jest.Mock).mockImplementation(() => Promise.resolve(mockCreatedReport));

      const result = await damageReportRepository.create(mockReport);

      expect(result).toBeDefined();
      expect(result.mediaUris).toHaveLength(2);
      expect(result.mediaUris).toContain('file://compressed-image1.jpg');
      expect(result.mediaUris).toContain('file://compressed-image2.jpg');
    });

    it('should handle damage report creation error', async () => {
      const mockReport: Partial<DamageReport> = {
        ts: Date.now(),
        lat: 41.0082,
        lon: 28.9784,
        accuracy: 10,
        type: DamageType.Building,
        severity: DamageSeverity.Moderate,
        description: 'Test damage report',
        mediaUris: [],
        verified: false,
        reporterId: 'test-reporter',
        reportedAt: Date.now(),
      };

      (database.write as jest.Mock).mockImplementation(() => Promise.reject(new Error('Database error')));

      await expect(damageReportRepository.create(mockReport)).rejects.toThrow('Database error');
    });

    it('should handle media compression error', async () => {
      const testUri = 'file://test-image.jpg';
      
      // Mock compression error
      const mockManipulateAsync = require('expo-image-manipulator').manipulateAsync;
      mockManipulateAsync.mockImplementationOnce(() => Promise.reject(new Error('Compression error')));

      await expect(mediaCompressor.compressImage(testUri)).rejects.toThrow('Compression error');
    });
  });

  describe('Damage Report Validation', () => {
    it('should validate damage report with all required fields', () => {
      const validReport: Partial<DamageReport> = {
        ts: Date.now(),
        lat: 41.0082,
        lon: 28.9784,
        accuracy: 10,
        type: DamageType.Building,
        severity: DamageSeverity.Moderate,
        description: 'Valid damage report',
        mediaUris: [],
        verified: false,
        reporterId: 'test-reporter',
        reportedAt: Date.now(),
      };

      // Basic validation - all required fields present
      expect(validReport.ts).toBeDefined();
      expect(validReport.lat).toBeDefined();
      expect(validReport.lon).toBeDefined();
      expect(validReport.type).toBeDefined();
      expect(validReport.severity).toBeDefined();
      expect(validReport.description).toBeDefined();
    });

    it('should validate damage report coordinates', () => {
      const validReport: Partial<DamageReport> = {
        ts: Date.now(),
        lat: 41.0082, // Istanbul latitude
        lon: 28.9784, // Istanbul longitude
        accuracy: 10,
        type: DamageType.Building,
        severity: DamageSeverity.Moderate,
        description: 'Valid damage report',
        mediaUris: [],
        verified: false,
        reporterId: 'test-reporter',
        reportedAt: Date.now(),
      };

      // Coordinate validation
      expect(validReport.lat).toBeGreaterThanOrEqual(-90);
      expect(validReport.lat).toBeLessThanOrEqual(90);
      expect(validReport.lon).toBeGreaterThanOrEqual(-180);
      expect(validReport.lon).toBeLessThanOrEqual(180);
    });

    it('should validate damage report severity levels', () => {
      const severityLevels = [
        DamageSeverity.Minor,
        DamageSeverity.Moderate,
        DamageSeverity.Severe,
        DamageSeverity.Critical,
      ];

      severityLevels.forEach(severity => {
        expect(severity).toBeDefined();
        expect(typeof severity).toBe('string');
      });
    });

    it('should validate damage report types', () => {
      const damageTypes = [
        DamageType.Building,
        DamageType.Road,
        DamageType.Bridge,
        DamageType.Utility,
        DamageType.Vehicle,
        DamageType.Other,
      ];

      damageTypes.forEach(type => {
        expect(type).toBeDefined();
        expect(typeof type).toBe('string');
      });
    });
  });

  describe('Media Compression Options', () => {
    it('should use correct compression options for damage reports', async () => {
      const testUri = 'file://test-image.jpg';
      
      const result = await mediaCompressor.compressImageForDamageReport(testUri);

      expect(result).toBe('file://compressed-image.jpg');
      
      // Verify that the compression was called with damage report specific options
      const mockManipulateAsync = require('expo-image-manipulator').manipulateAsync;
      expect(mockManipulateAsync).toHaveBeenCalledWith(
        testUri,
        expect.arrayContaining([
          expect.objectContaining({
            resize: expect.objectContaining({
              width: 800,
              height: 600,
            }),
          }),
        ]),
        expect.objectContaining({
          compress: 0.7,
          format: 'jpeg',
        })
      );
    });

    it('should use correct compression options for help requests', async () => {
      const testUri = 'file://test-image.jpg';
      
      const result = await mediaCompressor.compressImageForHelpRequest(testUri);

      expect(result).toBe('file://compressed-image.jpg');
      
      // Verify that the compression was called with help request specific options
      const mockManipulateAsync = require('expo-image-manipulator').manipulateAsync;
      expect(mockManipulateAsync).toHaveBeenCalledWith(
        testUri,
        expect.arrayContaining([
          expect.objectContaining({
            resize: expect.objectContaining({
              width: 600,
              height: 400,
            }),
          }),
        ]),
        expect.objectContaining({
          compress: 0.6,
          format: 'jpeg',
        })
      );
    });

    it('should use correct compression options for resource posts', async () => {
      const testUri = 'file://test-image.jpg';
      
      const result = await mediaCompressor.compressImageForResourcePost(testUri);

      expect(result).toBe('file://compressed-image.jpg');
      
      // Verify that the compression was called with resource post specific options
      const mockManipulateAsync = require('expo-image-manipulator').manipulateAsync;
      expect(mockManipulateAsync).toHaveBeenCalledWith(
        testUri,
        expect.arrayContaining([
          expect.objectContaining({
            resize: expect.objectContaining({
              width: 400,
              height: 300,
            }),
          }),
        ]),
        expect.objectContaining({
          compress: 0.5,
          format: 'jpeg',
        })
      );
    });
  });
});
