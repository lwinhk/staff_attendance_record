FROM node:26-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /workspace

FROM base AS development
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/database/package.json packages/database/package.json
RUN pnpm install --frozen-lockfile
COPY . .
EXPOSE 3000
CMD ["pnpm", "--filter", "@attendance/api", "dev"]

FROM development AS build
RUN pnpm --filter @attendance/api... build
RUN pnpm deploy --filter @attendance/api --prod /release

FROM node:26-alpine AS production
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /release ./
COPY --from=build /workspace/apps/api/dist ./dist
USER node
EXPOSE 3000
CMD ["sh", "-c", "node dist/scripts/migrate.js && node dist/server.js"]
