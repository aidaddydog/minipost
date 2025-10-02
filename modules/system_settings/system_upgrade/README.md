# 系统更新（system_upgrade）

- L1：设置 → L2：系统设置 → L3：系统更新
- UI 复用壳层 Token 与交互模式（toolbar / table / footer-bar / modal）
- 覆盖策略：默认“仅有变动的文件”，不清数据库
- 数据存储：历史记录以 JSONL 写入 `data/system_upgrade/history.jsonl`

> 说明：当前版本提供“最佳努力”的 Git 真实执行；当容器内不存在 `.git` 或无法访问远端时，自动回落到模拟模式，保证 UI 与流程可用。
