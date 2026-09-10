# Mobile App Web Build (Expo Web static export) — serves app.stockwhisk.com
# Multi-stage: build static bundle, then serve with lightweight static server.

FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json ./
RUN npm install --legacy-peer-deps
COPY . .
ENV EXPO_PUBLIC_API_BASE=https://stockwhisk.com/api
ENV CI=1
RUN npx expo export --platform web --output-dir /dist

FROM node:20-alpine
WORKDIR /app
RUN npm install --global serve@14 --silent
COPY --from=builder /dist /app/dist
ENV EXPO_PUBLIC_API_BASE=https://stockwhisk.com/api
EXPOSE 3000
CMD ["serve", "-s", "-l", "3000", "/app/dist"]
