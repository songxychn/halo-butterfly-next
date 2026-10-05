FROM docker-mirror.infra.baizhukui.com/halohub/halo:2.26.1@sha256:bfe89bf70c44ea94a7dd33f8ec98e8e59088adfb7a9fb7b6f013f82391c33bee
USER root
RUN apt-get update && apt-get install -y --no-install-recommends python3 openssl && rm -rf /var/lib/apt/lists/*
COPY source/ /opt/demo/source/
COPY bundle/ /opt/demo/bundle/
COPY search.jar /opt/demo/search.jar
WORKDIR /application
ENV JVM_OPTS="-Xms128m -Xmx512m"
EXPOSE 8090
HEALTHCHECK --interval=15s --timeout=10s --start-period=240s --retries=4 CMD python3 /opt/demo/source/site/demo/entrypoint.py health
ENTRYPOINT ["python3", "-B", "/opt/demo/source/site/demo/entrypoint.py"]
