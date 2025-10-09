import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'AfetNet Backend API',
      version: '1.0.0',
      description: 'Professional disaster management and emergency communication API',
      contact: {
        name: 'AfetNet Team',
        email: 'support@afetnet.app',
      },
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
      {
        url: 'https://api.afetnet.app',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            afnId: { type: 'string', pattern: '^AFN-[0-9A-Z]{8}$' },
            name: { type: 'string' },
            email: { type: 'string', format: 'email' },
            phone: { type: 'string' },
            isPremium: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        SosAlert: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            userId: { type: 'string', format: 'uuid' },
            latitude: { type: 'number', minimum: -90, maximum: 90 },
            longitude: { type: 'number', minimum: -180, maximum: 180 },
            message: { type: 'string' },
            status: { type: 'string', enum: ['active', 'resolved', 'false_alarm'] },
            priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Message: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            senderId: { type: 'string', format: 'uuid' },
            receiverId: { type: 'string', format: 'uuid' },
            content: { type: 'string' },
            type: { type: 'string', enum: ['text', 'sos', 'location', 'image'] },
            isEncrypted: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Earthquake: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            magnitude: { type: 'number' },
            depth: { type: 'number' },
            latitude: { type: 'number' },
            longitude: { type: 'number' },
            place: { type: 'string' },
            source: { type: 'string', enum: ['AFAD', 'USGS', 'KANDILLI'] },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
            statusCode: { type: 'number' },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ['./src/routes/*.ts'], // Path to API routes
};

export const swaggerSpec = swaggerJsdoc(options);

