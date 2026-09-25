# ---- frontend build -------------------------------------------------------
FROM node:24-alpine AS web
WORKDIR /src/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install
COPY frontend/ ./
ARG VITE_API_BASE=""
ENV VITE_API_BASE=$VITE_API_BASE
RUN npm run build

# ---- backend build --------------------------------------------------------
FROM golang:1.26-alpine AS api
WORKDIR /src/backend
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend/ ./
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/server ./cmd/server

# ---- runtime --------------------------------------------------------------
FROM alpine:3.22
RUN apk add --no-cache ca-certificates tzdata curl \
    && adduser -D -u 10001 taskflow
WORKDIR /app
COPY --from=api /out/server /app/server
COPY --from=web /src/frontend/dist /app/frontend
COPY docker/healthcheck.sh /app/healthcheck
RUN chmod +x /app/healthcheck && chown -R taskflow:taskflow /app
USER taskflow
EXPOSE 8080
ENTRYPOINT ["/app/server"]
