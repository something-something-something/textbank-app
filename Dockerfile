FROM node:14
USER node
RUN mkdir -p /home/node/app
WORKDIR /home/node/app
COPY ./package.json /home/node/app/package.json
COPY ./package-lock.json /home/node/app/package-lock.json
RUN npm install
COPY --chown=node:node ./ /home/node/app/

#RUN npm run build
CMD npm run build && npm run start