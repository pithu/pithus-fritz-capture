FROM debian:8.11

ENV DEBIAN_FRONTEND noninteractive

RUN apt-get update && \
    apt-get -y dist-upgrade

RUN apt-get -y install locales psmisc supervisor cron rsyslog wget curl tshark nginx

RUN curl -sL https://deb.nodesource.com/setup_10.x | bash -
RUN apt-get -y install nodejs

# set env vars
ARG FRITZ_USER
ARG FRITZ_PWD
ARG DNS_SERVER
ENV FRITZ_USER=$FRITZ_USER
ENV FRITZ_PWD=$FRITZ_PWD
ENV DNS_SERVER=$DNS_SERVER

# Prepare nginx
# configure nginx according to that in nginx-sites-available-default.conf
ENV WWW_ROOT=/opt/fritz-dump/www
RUN mkdir -p $WWW_ROOT/data # here is that capture data stored

COPY www $WWW_ROOT
COPY nginx-sites-available-default.conf /etc/nginx/sites-available/default
EXPOSE 80

# Prepare work directory
ENV WORK_DIR=/opt/fritz-dump
RUN mkdir -p $WORK_DIR
WORKDIR $WORK_DIR

COPY tshark-stream-add-timestamp.js tshark-stream-compact.js package.json package-lock.json fritz-capture.sh run.sh $WORK_DIR/
RUN npm install

ENTRYPOINT ["/opt/fritz-dump/run.sh"]
