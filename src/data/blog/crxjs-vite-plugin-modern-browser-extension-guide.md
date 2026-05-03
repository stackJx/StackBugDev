---
author: stackbug
pubDatetime: 2025-05-20T00:00:00+08:00
title: 使用 @crxjs/vite-plugin 创建现代化浏览器扩展的完整指南
slug: crxjs-vite-plugin-modern-browser-extension-guide
featured: false
draft: false
tags:
  - frontend
  - vite
  - browser-extension
description: 用 @crxjs/vite-plugin 配合 Vite 开发现代化 Chrome 扩展：HMR、manifest v3、构建打包。
---

## 前言

浏览器扩展可以增强网页浏览体验。通过 @crxjs/vite-plugin，可以结合 Vite 和 React 来构建浏览器扩展。本教程会一步步创建一个完整的 Chrome 扩展项目。

## 环境准备

确保你已安装:

- Node.js (16+)
- npm 或 pnpm

## 步骤一：创建 Vite 项目

首先创建一个新的 Vite + React + TypeScript 项目：

```bash
npm create vite@latest median -- --template react-ts
cd median

```

## 步骤二：安装依赖

安装必要的依赖，包括 @crxjs/vite-plugin：

```bash
npm install -D @crxjs/[email protected] @types/chrome
npm install antd

```

如果你想使用 TailwindCSS（可选）：

```bash
npm install tailwindcss @tailwindcss/vite

```

## 步骤三：配置 vite.config.ts

创建或修改`vite.config.ts`文件：

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { crx } from '@crxjs/vite-plugin'
import manifest from './manifest.json'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    crx({ manifest }),
    tailwindcss(),
  ],
})

```

## 步骤四：创建 manifest.json

在项目根目录创建`manifest.json`文件，这是扩展的核心配置文件：

```text
{
  "manifest_version": 3,
  "name": "Median - 你的智能助手",
  "description": "基于 React 和 Vite 构建的现代化浏览器扩展",
  "version": "1.0.0",
  "action": {
    "default_popup": "index.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "32": "icons/icon32.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "permissions": [
    "storage",
    "tabs",
    "activeTab"
  ],
  "host_permissions": [
    "<all_urls>"
  ],
  "background": {
    "service_worker": "src/background.ts",
    "type": "module"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["src/content.ts"]
    }
  ],
  "icons": {
    "16": "icons/icon16.png",
    "32": "icons/icon32.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}

```

## 步骤五：配置 TailwindCSS

如果你选择使用 TailwindCSS，创建`tailwind.config.js`：

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}

```

创建`src/index.css`并添加 Tailwind 指令：

```text
@tailwind base;
@tailwind components;
@tailwind utilities;

```

## 步骤六：创建扩展必要的文件结构

### 1. 创建图标目录

```bash
mkdir -p public/icons

```

在这个目录中放置你的图标文件 (icon16.png, icon32.png, icon48.png, icon128.png)。你可以使用任何图像编辑工具创建这些图标。

### 2. 创建后台脚本 (background.ts)

```text
touch src/background.ts

```

编辑`src/background.ts`：

```js
// 后台脚本，在扩展启动时执行
console.log('Background script loaded');

// 监听扩展安装事件
chrome.runtime.onInstalled.addListener((details) => {
  console.log('Extension installed:', details.reason);
  
  // 初始化存储
  chrome.storage.local.set({ settings: { theme: 'light', notifications: true } });
});

// 监听来自内容脚本或弹出窗口的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Received message:', message, 'from:', sender);
  
  if (message.type === 'GET_DATA') {
    // 示例：获取数据并回复
    sendResponse({ success: true, data: { count: 42 } });
    return true; // 保持消息通道开放以进行异步响应
  }
});

// 添加右键菜单
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'median-context-menu',
    title: '使用 Median 处理此内容',
    contexts: ['selection']
  });
});

// 处理右键菜单点击
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'median-context-menu' && info.selectionText) {
    // 将选中的文本发送到当前标签页
    chrome.tabs.sendMessage(tab.id, {
      type: 'PROCESS_SELECTION',
      text: info.selectionText
    });
  }
});

```

### 3. 创建内容脚本 (content.ts)

```text
touch src/content.ts

```

编辑`src/content.ts`：

```js
// 内容脚本，在匹配的页面上下文中运行
console.log('Median content script loaded');

// 创建一个可拖动的浮动按钮
function createFloatingButton() {
  const button = document.createElement('div');
  button.innerHTML = 'M';
  button.style.cssText = `
    position: fixed;
    width: 50px;
    height: 50px;
    background: linear-gradient(135deg, #667eea, #764ba2);
    color: white;
    border-radius: 50%;
    bottom: 20px;
    right: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    font-size: 24px;
    cursor: pointer;
    z-index: 9999;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
    user-select: none;
  `;
  
  // 使按钮可拖动
  let isDragging = false;
  let startX: number, startY: number;
  let startLeft: number, startTop: number;
  
  button.addEventListener('mousedown', (e) => {
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    startLeft = button.offsetLeft;
    startTop = button.offsetTop;
  
    e.preventDefault();
  });
  
  document.addEventListener('mousemove', (e) => {
    if (isDragging) {
      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;
    
      button.style.right = `${document.documentElement.clientWidth - startLeft - button.offsetWidth - deltaX}px`;
      button.style.bottom = `${document.documentElement.clientHeight - startTop - button.offsetHeight - deltaY}px`;
    }
  });
  
  document.addEventListener('mouseup', () => {
    isDragging = false;
  });
  
  // 点击事件
  button.addEventListener('click', () => {
    if (!isDragging) {
      togglePanel();
    }
  });
  
  return button;
}

// 创建面板
function createPanel() {
  const panel = document.createElement('div');
  panel.id = 'median-panel';
  panel.style.cssText = `
    position: fixed;
    width: 320px;
    height: 420px;
    background-color: white;
    border-radius: 8px;
    bottom: 80px;
    right: 20px;
    z-index: 9998;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    display: none;
    flex-direction: column;
    overflow: hidden;
  `;
  
  // 面板标题
  const header = document.createElement('div');
  header.style.cssText = `
    padding: 12px 16px;
    background: linear-gradient(135deg, #667eea, #764ba2);
    color: white;
    font-weight: bold;
    display: flex;
    justify-content: space-between;
    align-items: center;
  `;
  header.innerHTML = `
    <span>Median 助手</span>
    <span style="cursor: pointer;" id="median-close">×</span>
  `;
  
  // 面板内容
  const content = document.createElement('div');
  content.style.cssText = `
    flex: 1;
    padding: 16px;
    overflow-y: auto;
  `;
  content.innerHTML = `
    <div style="margin-bottom: 16px;">
      <p>这是你的智能助手，可以帮助你完成以下任务：</p>
      <ul style="padding-left: 20px; margin-top: 8px;">
        <li>摘要当前页面内容</li>
        <li>提取重要信息</li>
        <li>保存笔记</li>
      </ul>
    </div>
    <div>
      <button id="median-summarize" style="
        background: linear-gradient(135deg, #667eea, #764ba2);
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 4px;
        cursor: pointer;
        margin-right: 8px;
      ">摘要页面</button>
      <button id="median-extract" style="
        background: white;
        color: #667eea;
        border: 1px solid #667eea;
        padding: 8px 16px;
        border-radius: 4px;
        cursor: pointer;
      ">提取信息</button>
    </div>
  `;
  
  panel.appendChild(header);
  panel.appendChild(content);
  
  // 关闭按钮事件
  setTimeout(() => {
    const closeBtn = document.getElementById('median-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        panel.style.display = 'none';
      });
    }
  
    // 摘要按钮事件
    const summarizeBtn = document.getElementById('median-summarize');
    if (summarizeBtn) {
      summarizeBtn.addEventListener('click', () => {
        const paragraphs = Array.from(document.querySelectorAll('p')).map(p => p.textContent).filter(Boolean);
        content.innerHTML = `<div style="font-size: 14px; line-height: 1.5;">
          <strong>页面摘要：</strong>
          <p>${paragraphs.slice(0, 3).join(' ')}</p>
          <button id="median-back" style="
            background: white;
            color: #667eea;
            border: 1px solid #667eea;
            padding: 6px 12px;
            border-radius: 4px;
            cursor: pointer;
            margin-top: 16px;
          ">返回</button>
        </div>`;
      
        setTimeout(() => {
          const backBtn = document.getElementById('median-back');
          if (backBtn) {
            backBtn.addEventListener('click', () => {
              panel.remove();
              document.body.appendChild(createPanel());
              togglePanel();
            });
          }
        }, 0);
      });
    }
  }, 0);
  
  return panel;
}

// 切换面板显示状态
function togglePanel() {
  const panel = document.getElementById('median-panel');
  if (panel) {
    panel.style.display = panel.style.display === 'none' ? 'flex' : 'none';
  } else {
    const newPanel = createPanel();
    document.body.appendChild(newPanel);
    newPanel.style.display = 'flex';
  }
}

// 监听来自后台脚本的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'PROCESS_SELECTION') {
    alert(`选中的文本: ${message.text}`);
    sendResponse({ success: true });
  }
  return true;
});

// 将浮动按钮添加到页面
window.addEventListener('load', () => {
  const floatingButton = createFloatingButton();
  document.body.appendChild(floatingButton);
});

```

### 4. 修改主 App 组件

编辑`src/App.tsx`：

```js
import { useState, useEffect } from 'react'
import { Button, Tabs, Switch, Card, List, Typography, Divider } from 'antd'
import './App.css'

const { TabPane } = Tabs;
const { Title, Text } = Typography;

interface SettingsType {
  theme: 'light' | 'dark';
  notifications: boolean;
}

function App() {
  const [settings, setSettings] = useState<SettingsType>({
    theme: 'light',
    notifications: true
  });
  const [currentUrl, setCurrentUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  
  // 获取设置和当前URL
  useEffect(() => {
    // 获取存储的设置
    chrome.storage.local.get(['settings'], (result) => {
      if (result.settings) {
        setSettings(result.settings);
      }
      setLoading(false);
    });
  
    // 获取当前标签页URL
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0].url) {
        setCurrentUrl(tabs[0].url);
      }
    });
  }, []);
  
  // 保存设置
  const saveSettings = (newSettings: SettingsType) => {
    chrome.storage.local.set({ settings: newSettings }, () => {
      setSettings(newSettings);
    });
  };
  
  const recentItems = [
    { title: '已保存的网页', url: 'https://example.com/page1', time: '2小时前' },
    { title: '研究资料', url: 'https://example.com/page2', time: '昨天' },
    { title: '技术博客', url: 'https://example.com/page3', time: '3天前' },
  ];

  return (
    <div className={`app-container ${settings.theme}`}>
      <header className="header">
        <Title level={4}>Median</Title>
        <Text type="secondary">你的智能浏览助手</Text>
      </header>
    
      <Tabs defaultActiveKey="1">
        <TabPane tab="主页" key="1">
          <Card className="current-card">
            <Text strong>当前页面:</Text>
            <Text>{currentUrl}</Text>
          
            <div className="action-buttons">
              <Button type="primary">保存页面</Button>
              <Button>生成摘要</Button>
            </div>
          </Card>
        
          <Divider orientation="left">最近活动</Divider>
        
          <List
            size="small"
            dataSource={recentItems}
            renderItem={item => (
              <List.Item>
                <div className="list-item">
                  <Text strong>{item.title}</Text>
                  <Text type="secondary">{item.time}</Text>
                </div>
              </List.Item>
            )}
          />
        </TabPane>
      
        <TabPane tab="设置" key="2">
          <div className="settings-item">
            <Text>深色模式</Text>
            <Switch 
              checked={settings.theme === 'dark'} 
              onChange={(checked) => saveSettings({
                ...settings,
                theme: checked ? 'dark' : 'light'
              })}
            />
          </div>
        
          <div className="settings-item">
            <Text>通知</Text>
            <Switch 
              checked={settings.notifications} 
              onChange={(checked) => saveSettings({
                ...settings,
                notifications: checked
              })}
            />
          </div>
        
          <div className="version-info">
            <Text type="secondary">版本: 1.0.0</Text>
          </div>
        </TabPane>
      </Tabs>
    </div>
  );
}

export default App

```

### 5. 添加样式

编辑`src/App.css`：

```yaml
.app-container {
  width: 380px;
  min-height: 480px;
  padding: 16px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

.app-container.dark {
  background-color: #1f1f1f;
  color: #fff;
}

.app-container.dark .ant-typography {
  color: #fff;
}

.app-container.dark .ant-card {
  background-color: #2d2d2d;
  border-color: #444;
}

.app-container.dark .ant-tabs-tab {
  color: #ccc;
}

.header {
  margin-bottom: 20px;
  text-align: center;
}

.current-card {
  margin-bottom: 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.action-buttons {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.list-item {
  display: flex;
  justify-content: space-between;
  width: 100%;
}

.settings-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid #f0f0f0;
}

.app-container.dark .settings-item {
  border-bottom-color: #333;
}

.version-info {
  margin-top: 24px;
  text-align: center;
}

```

### 6. 更新主入口文件

修改`src/main.tsx`：

```js
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

```

## 步骤七：开发与测试

启动开发服务器：

```bash
npm run dev

```

浏览器扩展会在`dist`目录中生成。要在 Chrome 中测试：

1. 打开 Chrome 浏览器
2. 进入`chrome://extensions/`
3. 开启右上角的"开发者模式"
4. 点击"加载已解压的扩展"
5. 选择你项目中的`dist`目录

现在，你应该能看到你的扩展已经安装。点击工具栏上的扩展图标，就能看到你的弹出窗口界面。

## 步骤八：添加选项页面（可选）

你可以添加一个更完整的选项页面，在`manifest.json`中添加：

```text
{
  // 其他配置...
  "options_page": "options.html"
}

```

然后创建`src/options.tsx`和`public/options.html`文件。

## 步骤九：构建发布版本

当你准备发布扩展时，运行构建命令：

```bash
npm run build

```

这将在`dist`目录生成优化后的扩展文件。

## 步骤十：打包与发布

打包扩展：

- 压缩`dist`目录中的所有文件（ZIP 格式）

发布到 Chrome 网上应用店：

- 访问 Chrome 开发者控制台
- 创建一个新的项目
- 上传你的 ZIP 文件
- 填写扩展的详情、截图等
- 提交审核

## 高级功能扩展（选做）

1. 添加标签页管理功能
2. 实现页面内容分析
3. 添加数据同步功能
4. 多语言支持
5. 键盘快捷键支持

## 总结

通过本教程，你已经学会了使用 @crxjs/vite-plugin 结合 React 和 TypeScript 创建 Chrome 扩展。

你现在可以基于这个框架开发更多功能，如网页内容分析、数据收集、界面美化等。
