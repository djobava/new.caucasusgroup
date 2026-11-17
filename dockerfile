# Keep the legacy lowercase Dockerfile in sync with Railway's canonical Dockerfile.
FROM node:20-bookworm-slim AS frontend-build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

FROM node:20-bookworm-slim AS production
ENV NODE_ENV=production
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci --omit=dev
COPY server/ ./
COPY --from=frontend-build /app/client/dist /app/client/dist

EXPOSE 5000
CMD ["npm", "start"]
