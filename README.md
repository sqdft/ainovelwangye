# 小羊老师的小说生成器（ai_novel2）

本地浏览器端 AI 网文写作台：**长篇流水线 + 短篇分段**，自备 API Key（OpenAI 兼容 / 商汤等中转 / Gemini）。

- 远程仓库：https://github.com/sqdft/ainovel2  
- 本地开发：`npm run dev` → **http://127.0.0.1:3033/**  
- 构建：`npm run build`（`tsx scripts/build.ts`）

## 核心能力

### 长篇
主题 → 书名 → 大纲/世界观 → 人物 → 境界（按题材）→ 目录 → 正文 → 导出  
含：作品记忆（章后自动更新、可手改）、质检提醒、补缺章、批量失败重试、续写/扩写/收束、定向改写、单章流式 + 顶栏停止（Abort）。

### 短篇
主题 → 标题 → 分段规划 → 正文/收束；字数进度与收束提示。

### 通用
- 多供应商卡片（URL + Key + 模型检测）
- 任务状态机（进行中 / 停止 / 失败重试）
- 改设定分级确认（仅正文 / 目录+正文 / 全下游）
- 导出：已写章 TXT/Word（封面信息）、分卷（约 30 章/卷）
- 本地双存储 + 备份/恢复

## 快速开始

```bash
npm install --ignore-scripts   # 若 better-sqlite3 原生编译失败可跳过
npm run dev
```

浏览器打开 http://127.0.0.1:3033/ ，先在 **设置** 配置 Base URL / API Key / 模型（开发态跨域走 Vite `/api-proxy`）。

## 技术栈

React 19 · TypeScript · Vite 6 · Tailwind CSS 4 · lucide-react · docx（导出时懒加载）

## 说明

- 数据默认存浏览器本地（IndexedDB + localStorage 双写），非云协作平台。
- 流式输出主要面向 OpenAI 兼容接口；Gemini 路径仍为整段返回。
- 项目包名：`ai-novel2`（原脚手架 `react-example` 已更名）。
