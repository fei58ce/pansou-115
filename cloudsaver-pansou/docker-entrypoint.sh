#!/bin/sh

# 如果配置目录下没有 env 文件，则复制示例文件
if [ ! -f /app/config/env ]; then
    cp /app/.env.example /app/config/env
    echo "已创建默认配置文件 /app/config/env，请根据需要修改配置"
fi

# 创建配置文件软链接
ln -sf /app/config/env /app/.env

# nginx 和后端都放后台：docker stop 的停止信号转给两边；任一个自己退出就整体以非 0 退出，交给 Docker 的重启策略
nginx -g 'daemon off;' &
nginx_pid=$!
node dist/app.js &
node_pid=$!

stopping=
stop_all() {
    kill -TERM "$node_pid" 2>/dev/null
    kill -QUIT "$nginx_pid" 2>/dev/null
}
trap 'stopping=1; stop_all' TERM INT

while kill -0 "$nginx_pid" 2>/dev/null && kill -0 "$node_pid" 2>/dev/null; do
    sleep 1 &
    wait $!
done

stop_all
wait "$node_pid"
status=$?
wait "$nginx_pid"
if [ -z "$stopping" ] && [ "$status" -eq 0 ]; then
    status=1
fi
exit "$status"
