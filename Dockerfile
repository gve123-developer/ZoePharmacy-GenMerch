# Stage 1: Build React Frontend
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Serve React frontend and PHP API using PHP-Apache
FROM php:8.2-apache

# Install mysqli extension required for database connection
RUN docker-php-ext-install mysqli && docker-php-ext-enable mysqli

# Copy built React static assets to Apache web root
COPY --from=build /app/dist /var/www/html

# Copy PHP APIs and includes files
COPY --from=build /app/api /var/www/html/api
COPY --from=build /app/includes /var/www/html/includes

EXPOSE 80
