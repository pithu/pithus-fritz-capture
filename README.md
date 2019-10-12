pithu's Fritz!Box Capture
==================

# Motivation

Docker image that monitors network data volume per local ip. 

# Usage

```bash
docker build -t pithu/fritz-capture --build-arg FRITZ_USER=$FRITZ_USER --build-arg FRITZ_PWD=$FRITZ_PWD --build-arg DNS_SERVER=DNS_SERVER .
```
```bash
docker run -p 8080:80 pithu/fritz-capture
```

then open localhost:8080/_index.html.
 
# Configuration

Fritz!Box must be accessible under http://fritz.box per basic auth in the local network.

- FRITZ_USER: user
- FRITZ_PWD: password
- DNS_SERVER: ip of dns server that can resolve local ip addresses, 
  typically the ip of your router. It's just required to resolve local host names for local ips.
  Default is '192.168.2.1'
