FROM node:alpine
WORKDIR /app

RUN apk add --no-cache git bash yarn

COPY package.json yarn.lock* ./

RUN yarn install --production

COPY . .

RUN mkdir -p session

EXPOSE 8000
CMD ["npm", "start"]
