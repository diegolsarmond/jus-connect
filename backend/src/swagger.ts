import path from 'path';

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Jus Connect API',
      version: '1.0.0',
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: [
    path.join(__dirname, 'routes/*.{ts,js}'),
    path.join(__dirname, 'index.{ts,js}')
  ],
};

export default swaggerOptions;
