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
        Intimacao: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            siglaTribunal: { type: 'string', nullable: true },
            external_id: { type: 'string', nullable: true },
            numero_processo: { type: 'string', nullable: true },
            nomeOrgao: { type: 'string', nullable: true },
            tipoComunicacao: { type: 'string', nullable: true },
            texto: { type: 'string', nullable: true },
            prazo: { type: 'string', nullable: true },
            data_disponibilizacao: { type: 'string', format: 'date-time', nullable: true },
            created_at: { type: 'string', format: 'date-time', nullable: true },
            updated_at: { type: 'string', format: 'date-time', nullable: true },
            meio: { type: 'string', nullable: true },
            link: { type: 'string', nullable: true },
            tipodocumento: { type: 'string', nullable: true },
            nomeclasse: { type: 'string', nullable: true },
            codigoclasse: { type: 'string', nullable: true },
            numerocomunicacao: { type: 'string', nullable: true },
            ativo: { type: 'boolean', nullable: true },
            hash: { type: 'string', nullable: true },
            status: { type: 'string', nullable: true },
            motivo_cancelamento: { type: 'string', nullable: true },
            data_cancelamento: { type: 'string', format: 'date-time', nullable: true },
            destinatarios: {
              type: 'array',
              items: { type: 'string' },
              nullable: true,
            },
            destinatarios_advogados: {
              type: 'array',
              items: { type: 'string' },
              nullable: true,
            },
            idusuario: { type: 'integer', nullable: true },
            idempresa: { type: 'integer', nullable: true },
            idusuario_leitura: { type: 'integer', nullable: true },
            lida_em: { type: 'string', format: 'date-time', nullable: true },
            nao_lida: { type: 'boolean', nullable: true },
            arquivada: { type: 'boolean', nullable: true },
          },
        },
        IntimacaoOabMonitor: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            uf: { type: 'string' },
            numero: { type: 'string' },
            usuarioId: { type: 'integer', nullable: true },
            usuarioNome: { type: 'string', nullable: true },
            usuarioOabNumero: { type: 'string', nullable: true },
            usuarioOabUf: { type: 'string', nullable: true },
            createdAt: { type: 'string', format: 'date-time', nullable: true },
            updatedAt: { type: 'string', format: 'date-time', nullable: true },
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
      '/api/intimacoes': {
        get: {
          summary: 'Lista as intimações da empresa do usuário autenticado',
          tags: ['Intimacoes'],
          responses: {
            200: {
              description: 'Lista de intimações',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: {
                      $ref: '#/components/schemas/Intimacao',
                    },
                  },
                },
              },
            },
            401: {
              description: 'Token inválido.',
            },
            500: {
              description: 'Erro interno do servidor',
            },
          },
        },
      },
      '/api/intimacoes/{id}/archive': {
        patch: {
          summary: 'Arquiva uma intimação da empresa do usuário autenticado',
          tags: ['Intimacoes'],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'integer' },
            },
          ],
          responses: {
            200: {
              description: 'Intimação arquivada com sucesso',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      id: { type: 'integer' },
                      arquivada: { type: 'boolean' },
                      updated_at: { type: 'string', format: 'date-time' },
                    },
                  },
                },
              },
            },
            400: {
              description: 'Identificador de intimação inválido.',
            },
            401: {
              description: 'Token inválido.',
            },
            404: {
              description: 'Intimação não encontrada.',
            },
            500: {
              description: 'Erro interno do servidor',
            },
          },
        },
      },
      '/api/intimacoes/{id}/read': {
        patch: {
          summary: 'Marca uma intimação como lida para a empresa do usuário autenticado',
          tags: ['Intimacoes'],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'integer' },
            },
          ],
          responses: {
            200: {
              description: 'Intimação marcada como lida com sucesso',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      id: { type: 'integer' },
                      nao_lida: { type: 'boolean' },
                      updated_at: { type: 'string', format: 'date-time' },
                      idusuario_leitura: { type: 'integer', nullable: true },
                      lida_em: { type: 'string', format: 'date-time', nullable: true },
                    },
                  },
                },
              },
            },
            400: {
              description: 'Identificador de intimação inválido.',
            },
            401: {
              description: 'Token inválido.',
            },
            404: {
              description: 'Intimação não encontrada.',
            },
            500: {
              description: 'Erro interno do servidor',
            },
          },
        },
      },
      '/api/intimacoes/oab-monitoradas': {
        get: {
          summary: 'Lista as OABs monitoradas para intimações da empresa do usuário autenticado',
          tags: ['Intimacoes'],
          responses: {
            200: {
              description: 'Lista de OABs monitoradas',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/IntimacaoOabMonitor' },
                  },
                },
              },
            },
            401: { description: 'Token inválido.' },
            500: { description: 'Erro interno do servidor' },
          },
        },
        post: {
          summary: 'Cadastra uma OAB monitorada para intimações',
          tags: ['Intimacoes'],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['uf', 'numero', 'usuarioId'],
                  properties: {
                    uf: { type: 'string' },
                    numero: { type: 'string' },
                    usuarioId: { type: 'integer' },
                  },
                },
              },
            },
          },
          responses: {
            201: {
              description: 'OAB monitorada cadastrada com sucesso',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/IntimacaoOabMonitor' },
                },
              },
            },
            400: { description: 'Dados inválidos para cadastro.' },
            401: { description: 'Token inválido.' },
            500: { description: 'Erro interno do servidor' },
          },
        },
      },
      '/api/intimacoes/oab-monitoradas/{id}': {
        delete: {
          summary: 'Remove uma OAB monitorada para intimações',
          tags: ['Intimacoes'],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'integer' },
            },
          ],
          responses: {
            204: { description: 'OAB monitorada removida com sucesso' },
            400: { description: 'Identificador de monitoramento inválido.' },
            401: { description: 'Token inválido.' },
            404: { description: 'Registro de monitoramento não encontrado.' },
            500: { description: 'Erro interno do servidor' },
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
