import path from 'path';

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Quantum JUD API',
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
      schemas: {
        SistemaCnj: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
            },
            nome: {
              type: 'string',
            },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
    paths: {
      '/api/sistemas-cnj': {
        get: {
          summary: 'Lista os sistemas CNJ',
          tags: ['SistemaCNJ'],
          responses: {
            200: {
              description: 'Lista de sistemas CNJ',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: {
                      $ref: '#/components/schemas/SistemaCnj',
                    },
                  },
                },
              },
            },
            500: {
              description: 'Erro interno do servidor',
            },
          },
        },
      },
    },
  },
  apis: [
    path.join(__dirname, 'routes/*.{ts,js}'),
    path.join(__dirname, 'index.{ts,js}')
  ],
};

export default swaggerOptions;
