FROM node:0.10.32

RUN npm install -g npm@1.x
RUN npm install -g phantomjs@1.9.11
RUN mkdir -p /workspace
RUN adduser web --home /home/web --shell /bin/bash --disabled-password --gecos ""
RUN chown -R web:web /workspace
ADD . /workspace
WORKDIR /workspace
USER web
RUN npm install
RUN npm run-script bower-install
ADD . /workspace
