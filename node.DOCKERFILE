FROM node:latest
USER node
RUN mkdir -p /home/node/app
WORKDIR /home/node/app
# COPY ./package.json /home/node/app/package.json
# COPY ./package-lock.json /home/node/app/package-lock.json
# RUN npm install
CMD npm install && npm run start:dev