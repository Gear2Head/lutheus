FROM node:20
USER node
WORKDIR /home/node/app
COPY --chown=node:node package*.json ./
RUN npm install
COPY --chown=node:node . .
ENV PORT=7860
EXPOSE 7860
CMD ["node", "bot-entry.js"]
