# 演示站 H2 容器镜像

该目录用于构建基于嵌入式 H2 数据库的自包含 Halo 演示站镜像，用于本地演练或容器化部署。

## 本地构建与冒烟测试

```sh
bun run build
bun site/demo/bundle.mjs dist/halo-butterfly-next-<version>.zip .runtime/demo-bundle
python3 site/demo/context.py .runtime/demo-bundle .runtime/demo-context
docker build -t halo-butterfly-demo .runtime/demo-context
python3 site/demo/smoke.py halo-butterfly-demo
```

运行时可通过环境变量 `HALO_EXTERNAL_URL` 指定对外访问地址（默认 `http://127.0.0.1:8090`），通过 `JVM_OPTS` 调整 JVM 内存参数。
