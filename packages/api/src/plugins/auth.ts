import fp from 'fastify-plugin';
import { FastifyRequest, FastifyReply } from 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    user: {
      id: string;
      role: 'admin' | 'reseller' | 'user';
      username: string;
    };
  }
}

export const authPlugin = fp(async (fastify) => {
  fastify.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.code(401).send({ error: 'Unauthorized' });
    }
  });

  fastify.decorate('requireRole', (roles: string[]) => {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        await request.jwtVerify();
        if (!roles.includes(request.user.role)) {
          reply.code(403).send({ error: 'Forbidden: Insufficient role' });
        }
      } catch (err) {
        reply.code(401).send({ error: 'Unauthorized' });
      }
    };
  });
});
