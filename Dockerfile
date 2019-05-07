FROM debian:latest

ENV DEBIAN_FRONTEND noninteractive

ARG FRITZ_USER
ARG FRITZ_PWD
ENV FRITZ_USER=$FRITZ_USER
ENV FRITZ_PWD=$FRITZ_PWD

RUN apt-get update && \
    apt-get -y dist-upgrade

RUN apt-get -y install wget curl apache2 tshark

RUN curl -sL https://deb.nodesource.com/setup_10.x | bash -

RUN apt-get -y install nodejs

# Prepare apache
RUN rm /var/www/html/index.html
COPY www /var/www/html/

# Prepare fritz-dump
RUN mkdir -p /opt/fritz-dump
WORKDIR /opt/fritz-dump

COPY compact-tshark-stream.js package.json package-lock.json fritz-capture.sh run.sh /opt/fritz-dump/

RUN npm install

ENTRYPOINT ["/opt/fritz-dump/run.sh"]
