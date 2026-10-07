#stage 1 
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json .
RUN npm install 

COPY . .
RUN npm run build
 
#stage 2 
FROM nginx:alpine
COPY nginx.conf /etc/nginx/nginx.conf
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
