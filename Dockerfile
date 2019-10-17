FROM debian:8.11

ENV DEBIAN_FRONTEND noninteractive

RUN apt-get update && \
    apt-get -y dist-upgrade

RUN apt-get -y install locales psmisc supervisor cron rsyslog wget curl tshark nginx

RUN curl -sL https://deb.nodesource.com/setup_10.x | bash -
RUN apt-get -y install nodejs

# set env vars
ARG FRITZ_USER=admin
ARG FRITZ_PWD
ARG DNS_SERVER=192.168.2.1
ARG FRITZ_URI=http://fritz.box
ARG FRITZ_IFACE=2-0
ENV FRITZ_USER=$FRITZ_USER
ENV FRITZ_PWD=$FRITZ_PWD
ENV DNS_SERVER=$DNS_SERVER
ENV FRITZ_URI=$FRITZ_URI
ENV FRITZ_IFACE=$FRITZ_IFACE

# Prepare nginx
# configure nginx according to that in nginx-sites-available-default.conf
ENV WWW_ROOT=/opt/pithu-fritz-capture/www
RUN mkdir -p $WWW_ROOT/data # here is that capture data stored

COPY www $WWW_ROOT
COPY nginx-sites-available-default.conf /etc/nginx/sites-available/default
EXPOSE 80

# Prepare work directory
ENV WORK_DIR=/opt/pithu-fritz-capture
RUN mkdir -p $WORK_DIR
WORKDIR $WORK_DIR

COPY src/*.js package*.json fritz-capture.sh run.sh $WORK_DIR/
RUN npm install

ENTRYPOINT ["/opt/pithu-fritz-capture/run.sh"]
