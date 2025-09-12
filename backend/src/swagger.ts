import { SwaggerOptions } from 'swagger-jsdoc';

const swaggerOptions: SwaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Jus Connect API',
      version: '1.0.0',
    },
  },
  apis: ['./src/routes/*.ts'],
};

export default swaggerOptions;
