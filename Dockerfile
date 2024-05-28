FROM node:14

WORKDIR /my-node-app

COPY package*.json ./
COPY package-lock*.json ./

RUN npm install

RUN npm install mqtt

COPY . .

EXPOSE 3000

CMD ["node", "server.js"]
