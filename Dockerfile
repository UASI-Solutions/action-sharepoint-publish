FROM node:24-alpine
RUN apk add --no-cache zip
WORKDIR /app
COPY package.json package-lock.json /app/
RUN npm ci --omit=dev
COPY . /app/
ENTRYPOINT ["/app/entrypoint.sh"]
