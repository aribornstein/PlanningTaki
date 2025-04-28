FROM mcr.microsoft.com/devcontainers/javascript-node:20
WORKDIR /app
COPY . .
RUN npm install && npm run build
EXPOSE 3000
CMD ["node","server/server.js"]


