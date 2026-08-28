FROM node:20-slim

# Install system fonts + emoji font support
RUN apt-get update && apt-get install -y fonts-dejavu-core fonts-noto-color-emoji && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

ENV NODE_ENV=production

COPY package*.json ./

RUN npm install --omit=dev

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
