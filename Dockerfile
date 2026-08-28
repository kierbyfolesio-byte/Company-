ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev
RUN npm install --omit=dev


COPY . .
