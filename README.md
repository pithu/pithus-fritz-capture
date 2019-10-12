pithu's Fritz!Box Capture
==================

Docker image that monitors network data volume per local ip. 

```bash
docker build -t pithu/fritz-capture --build-arg FRITZ_USER=$FRITZ_USER --build-arg FRITZ_PWD=$FRITZ_PWD .
```
```bash
docker run -p 8080:80 pithu/fritz-capture
```

then open localhost:8080/_index.html.

Fritzbox must be accessible under http://fritz.box per basic auth in the local network.
