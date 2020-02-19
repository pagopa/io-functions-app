FROM node:10.14.2-alpine

WORKDIR /opt/cosmosdb

RUN npm install -g @zeit/cosmosdb-server ts-node

ENV NODE_TLS_REJECT_UNAUTHORIZED=0

CMD ["sh", "-c", "cosmosdb-server -p 3000"]
