# 家里有数

家庭库存 PWA：React + TypeScript + Vite，后端使用 Firebase Auth、Firestore 和 Hosting。

## 本地开发

```bash
npm install
cp .env.example .env.local   # 填入 Firebase Web 配置
npm run dev
```

## 常用命令

| 命令 | 作用 |
| --- | --- |
| `npm test` | 运行业务逻辑测试 |
| `npm run test:rules` | 用官方 emulator 测试 Security Rules，需要 Java |
| `npm run build` | 类型检查并构建 |
| `npm run deploy` | 构建并部署 Hosting 和 Firestore Rules |

## 代码结构

- `src/data.ts`：所有 Firebase 读写都在这里。
- `src/logic.ts`：补货、临期、搜索和排序规则。
- `src/Inventory.tsx`：库存主页和弹窗。
- `src/Ledger.tsx`：共享记账，金额以分为单位保存。
- `src/Common.tsx`：顶部栏、成员管理、弹窗等公共组件。
- `src/AuthScreens.tsx`：登录、邮箱验证和创建家庭。
- `firestore.rules`：只有已验证邮箱且在 `memberEmails` 里的成员能访问数据。
- `tests/fakeData.ts`：`vite --mode fake` 使用的内存数据，只用于界面测试，地址加 `?seed=1` 可载入示例。
