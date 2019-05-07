FROM debian:latest

ENV DEBIAN_FRONTEND noninteractive

ARG FRITZ_USER
ARG FRITZ_PWD
ENV FRITZ_USER=$FRITZ_USER
ENV FRITZ_PWD=$FRITZ_PWD

RUN apt-get update && \
    apt-get -y dist-upgrade

RUN apt-get -y install locales wget curl apache2 tshark

RUN curl -sL https://deb.nodesource.com/setup_10.x | bash -

RUN apt-get -y install nodejs

RUN dpkg-reconfigure -f noninteractive locales
RUN sed --in-place '/de_DE.UTF-8/s/^#//' /etc/locale.gen
RUN locale-gen de_DE.UTF-8
ENV LANG de_DE.UTF-8
ENV LANGUAGE de_DE:de
ENV LC_ALL de_DE.UTF-8

# RUN echo "Europe/Berlin" > /etc/timezone && \
#    dpkg-reconfigure -f noninteractive tzdata

# Prepare apache
RUN rm /var/www/html/index.html
COPY www /var/www/html/

# Prepare fritz-dump
RUN mkdir -p /opt/fritz-dump
WORKDIR /opt/fritz-dump

COPY compact-tshark-stream.js package.json package-lock.json fritz-capture.sh run.sh /opt/fritz-dump/

RUN npm install

ENTRYPOINT ["/opt/fritz-dump/run.sh"]
