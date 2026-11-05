# 小羊老师的小说生成器（ai_novel2）

本地浏览器端 AI 网文写作台：**长篇流水线 + 短篇分段**，自备 API Key，数据全部留在本地。面向网文创作者，从主题到成稿全流程辅助，支持多供应商模型切换、风格仿写、设定库管理和批量生成。

- 远程仓库：https://github.com/sqdft/ainovelwangye  
- 本地开发：`npm run dev` → **http://127.0.0.1:3033/**  
- 构建：`npm run build`（`tsx scripts/build.ts`）

## 功能总览

### 长篇小说流水线
从主题到成稿分步生成：主题 → 书名（AI 出多选含简介）→ 大纲/世界观 → 人物关系 → 境界体系（按题材自动判断是否启用）→ 大纲目录 → 章节正文 → 导出。

正文阶段支持：
- 单章流式输出 + 顶栏停止（Abort），失败可批量重试
- 续写 / 扩写 / 收束 / 定向改写 / 单章多稿比稿（多角度一次生成多版）
- 章节正文改动前自动存历史版本，可随时回滚
- 补缺章：目录生成只补缺号，不清空已有目录
- 章后自动更新作品记忆（梗概、人物状态、伏笔账本），可手动编辑
- 质检提醒：字数不足、记忆未更新等

### 短篇故事模式
主题 → 标题（AI 多选）→ 分段规划 → 分段正文/收束，带字数进度与收束提示。

### 风格工坊
粘贴 200 字以上范文，AI 提取"风格卡"（叙事、对话、情绪、句式特征）。生成正文时按启用的风格卡注入写作风格，可多卡并存、随时启停。

### 设定库（实体卡）
手动添加或 AI 从正文自动提取，五类实体卡：

| 类型 | 说明 |
|------|------|
| 人物 | 角色设定 |
| 地点 | 场景设定 |
| 物品/法宝 | 关键道具 |
| 势力/组织 | 门派、家族等 |
| 伏笔/约定 | 需要回收的伏笔 |

每张卡可设置关键词（命中才注入）或置顶（每章必注入），可独立启停。

### Prompt 工坊
设置面板内可配置全局创作偏好（注入所有生成任务）和按任务附加指令（章节/书籍信息/人物/目录/短篇正文分别覆盖），支持保存多套预设并一键切换。

### 多供应商接入
内置 8 个供应商预设，均为自带 API Key 模式：

| 供应商 | 默认 Base URL | 默认模型 |
|--------|---------------|----------|
| Google Gemini | - | gemini-3.1-pro-preview |
| DeepSeek | https://api.deepseek.com | deepseek-chat |
| 智谱清言 | https://open.bigmodel.cn/api/paas/v4 | glm-4 |
| Kimi (月之暗面) | https://api.moonshot.cn/v1 | moonshot-v1-8k |
| OpenAI | https://api.openai.com/v1 | gpt-4o |
| 自定义 (OpenAI 兼容) | 自填 | 自填 |
| 自定义代理 | 自填 | 自填 |
| 免费模型 | https://api-ai.7e.ink/v1 | Qwen3.5 |

- 多密钥轮询（免费供应商场景）
- 多配置档案：保存多套供应商配置，一键切换
- 模型列表自动检测（OpenAI 兼容接口拉取 `/v1/models`）
- 温度参数可调（0-2）

### 数据管理与统计
- 浏览器本地双存储：IndexedDB 主存储 + localStorage 备份
- 数据备份/恢复
- 写作统计：按日统计新增字数，直方图展示

### 导出
- 长篇：已写章 TXT / Word（docx，含封面信息），支持分卷（约 30 章/卷）
- 短篇：TXT / Word

### 任务状态机与安全确认
每个生成任务有独立状态（进行中 / 停止 / 失败），失败可批量重试。改设定时分级确认影响范围：仅正文 / 目录+正文 / 全下游，避免误清已完成内容。

## 快速开始

```bash
npm install --ignore-scripts   # 若 better-sqlite3 原生编译失败可跳过
npm run dev
```

浏览器打开 http://127.0.0.1:3033/ ，先在 **设置** 配置供应商、Base URL、API Key 和模型（开发态跨域走 Vite `/api-proxy` 中间件转发）。

Gemini 也可用 `.env` 注入 `GEMINI_API_KEY` 作为兜底（AI Studio 部署场景，`.env.example` 有模板）；`APP_URL` 供 AI Studio / Cloud Run 部署时注入服务地址。

## 项目结构

```
src/
├── App.tsx               # 主应用：状态管理、任务编排、模式切换
├── types.ts              # 全局类型定义
├── config/               # 供应商、模型、主题、长度、示例配置
├── lib/storage.ts        # IndexedDB + localStorage 双写
├── services/aiService.ts # AI 调用、JSON 修复、多供应商适配
├── orchestration/        # 任务状态机、下游清空、确认门控
├── features/             # 按功能域拆分的面板组件
│   ├── book/             # 书籍信息
│   ├── characters/       # 人物关系
│   ├── realms/           # 境界体系
│   ├── toc/              # 大纲目录
│   ├── chapters/         # 章节内容
│   ├── entities/         # 设定库
│   ├── examples/         # 风格工坊
│   ├── memory/           # 作品记忆
│   ├── settings/         # 设置面板（含 Prompt 工坊）
│   └── stats/            # 写作统计
└── components/           # 通用组件（布局、确认弹窗、多稿弹窗等）
```

## 技术栈

React 19 · TypeScript · Vite 6 · Tailwind CSS 4 · lucide-react · motion · docx（导出时懒加载）

## 说明

- 数据默认存浏览器本地（IndexedDB + localStorage 双写），非云协作平台。
- 流式输出主要面向 OpenAI 兼容接口；Gemini 路径仍为整段返回。
- 章节正文改动前会自动存历史版本，可在章节面板回滚。
- `better-sqlite3`、`express` 为脚手架遗留依赖，应用本身不使用；若原生编译失败，`npm install --ignore-scripts` 可跳过，不影响运行。
- 项目包名：`ai-novel2`（原脚手架 `react-example` 已更名）。
