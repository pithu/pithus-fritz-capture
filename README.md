```bash
docker build -t fritz-capture --build-arg FRITZ_USER=$FRITZ_USER --build-arg FRITZ_PWD=$FRITZ_PWD .
```

```bash
docker run -p 8080:80 fritz-capture
```
