FROM node:latest
USER node
RUN mkdir -p /home/node/app
WORKDIR /home/node/app
COPY ./package.json /home/node/app/package.json
COPY ./package-lock.json /home/node/app/package-lock.json
RUN npm install
COPY ./ /home/node/app/

#RUN npm run build
USER root
RUN chown -R node ./
USER node
CMD npm run build && npm run start