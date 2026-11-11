#!/bin/bash
# 常驻监听：看到 measure-out/request.txt 就跑一次自动量页面，结果写进 measure-out/。
# 启动方式（只需一次，窗口保持打开）：bash scripts/measure-watch.sh
cd "$(dirname "$0")/.." || exit 1
mkdir -p measure-out
echo "监听中：等待 measure-out/request.txt …（Ctrl+C 退出）"
while true; do
  if [ -f measure-out/request.txt ]; then
    names=$(cat measure-out/request.txt)
    rm -f measure-out/request.txt measure-out/done.txt
    echo "$(date +%H:%M:%S) 开始：$names"
    node scripts/auto-measure.mjs $names > measure-out/log.txt 2>&1
    echo "exit=$?" > measure-out/done.txt
    echo "$(date +%H:%M:%S) 完成"
  fi
  sleep 2
done
