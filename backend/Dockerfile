FROM node:20

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Важно: Prisma Client должен быть сгенерен внутри image,
# иначе PrismaService не будет иметь новые модели (rolePermission/userPermission).
RUN npx prisma generate

EXPOSE 3000

CMD ["npm", "run", "start:dev"]
