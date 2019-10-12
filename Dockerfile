FROM debian:8.11

ENV DEBIAN_FRONTEND noninteractive

ARG FRITZ_USER
ARG FRITZ_PWD
ENV FRITZ_USER=$FRITZ_USER
ENV FRITZ_PWD=$FRITZ_PWD

ENV WWW_ROOT=/var/www/html

RUN apt-get update && \
    apt-get -y dist-upgrade

RUN apt-get -y install locales psmisc supervisor cron rsyslog wget curl tshark nginx

RUN curl -sL https://deb.nodesource.com/setup_10.x | bash -
RUN apt-get -y install nodejs

# Prepare fritz-dump
RUN mkdir -p /opt/fritz-dump
WORKDIR /opt/fritz-dump

# Prepare nginx
COPY www $WWW_ROOT
COPY nginx-sites-available-default.conf /etc/nginx/sites-available/default
EXPOSE 80

# Prepare code
COPY compact-tshark-stream.js package.json package-lock.json fritz-capture.sh run.sh /opt/fritz-dump/
RUN npm install

ENTRYPOINT ["/opt/fritz-dump/run.sh"]
