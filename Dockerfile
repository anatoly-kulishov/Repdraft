# Runtime image for small RF VPS.
# Build the app on a machine with enough RAM/disk first:
#   PUBLIC_SITE_URL=https://www.repdraft.ru npm run build
# then:
#   docker compose up -d --build

FROM node:22-bookworm-slim
WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
ENV BODY_SIZE_LIMIT=10M

COPY package.json package-lock.json ./
# Skip prepare (svelte-kit sync / rolldown) - image ships a prebuilt `build/`
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

COPY build ./build

EXPOSE 3000
USER node
CMD ["node", "build"]
